"use client"

import * as React from "react"
import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  CalendarPlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react"

import {
  DataTable,
  DataTableColumnHeader,
  EmptyValue,
  TruncatedText,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PersonChip } from "@/features/shared/person"
import { ScheduleMeetingDialog } from "@/features/shared/schedule-dialog"
import { setQueryParams, useQueryParam } from "@/hooks/use-query-param"
import { meetingTypeLabels } from "@/lib/constants"
import {
  firstName,
  formatDay,
  formatDayLong,
  formatMinutes,
  formatPercent,
  formatRelativeDay,
  formatTime,
  plural,
} from "@/lib/format"
import { addDays, dayOf, startOfWeek, today } from "@/lib/time"
import type { Meeting, Workspace } from "@/lib/types"
import { getPerson, upcomingMeetings } from "@/lib/vantage/selectors"
import { workspace } from "@/lib/vantage/store"
import {
  isMeetingType,
  meetingStatusLabels,
  meetingTypes,
  TypeBadge,
} from "./parts"

const VIEWS = ["upcoming", "week", "past"] as const
type View = (typeof VIEWS)[number]

/** Look-back window for the held and cancelled figures, in days. */
const WINDOW_DAYS = 30

export function MeetingsView() {
  const ws = workspace.use()
  const [viewParam, setViewParam] = useQueryParam("view")
  const [personParam, setPersonParam] = useQueryParam("person")
  const [newParam] = useQueryParam("new")
  const [typeParam] = useQueryParam("type")
  // True when the dialog was opened from the header, so closing it keeps the
  // person filter the manager already had in place.
  const [keepPerson, setKeepPerson] = React.useState(false)

  const view: View = VIEWS.includes(viewParam as View)
    ? (viewParam as View)
    : "upcoming"
  const person = personParam ? getPerson(ws, personParam) : undefined
  const scoped = person
    ? ws.meetings.filter((m) => m.personId === person.id)
    : ws.meetings
  const scheduling = newParam === "1"

  function openSchedule() {
    setKeepPerson(true)
    setQueryParams({ new: "1" })
  }

  function closeSchedule(open: boolean) {
    if (open) return
    setQueryParams({
      new: null,
      type: null,
      ...(keepPerson ? {} : { person: null }),
    })
    setKeepPerson(false)
  }

  const scheduleButton = (
    <Button onClick={openSchedule} disabled={!ws.people.length}>
      <CalendarPlusIcon /> Schedule 1:1
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        nav="/meetings"
        description="Every conversation with your direct reports: what is coming up, the week at a glance and the record of what was held."
        actions={scheduleButton}
      />

      {!ws.people.length ? (
        <EmptyState
          icon={<UserPlusIcon />}
          title="Add a direct report first"
          description="A 1:1 needs someone on the other side. Add a person and their first 1:1 is scheduled from their cadence."
          action={
            <Button render={<Link href="/people?new=1" />}>
              <UserPlusIcon /> Add a person
            </Button>
          }
        />
      ) : (
        <>
          <Kpis meetings={scoped} />

          {person && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Showing 1:1s with</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pr-1 pl-1.5">
                <PersonAvatar name={person.name} size="xs" />
                <span className="font-medium">{person.name}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="rounded-full"
                  aria-label={`Clear the filter on ${person.name}`}
                  onClick={() => setPersonParam(null)}
                >
                  <XIcon />
                </Button>
              </span>
            </div>
          )}

          {!scoped.length ? (
            <EmptyState
              icon={<CalendarPlusIcon />}
              title={
                person
                  ? `No 1:1s with ${firstName(person.name)} yet`
                  : "No 1:1s yet"
              }
              description="Schedule the first one. The suggested time comes from the person's cadence."
              action={scheduleButton}
            />
          ) : (
            <Tabs
              value={view}
              onValueChange={(v) =>
                setViewParam(v === "upcoming" ? null : String(v))
              }
              className="gap-4"
            >
              <TabsList>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="past">Past</TabsTrigger>
              </TabsList>
              <TabsContent value="upcoming">
                <UpcomingList
                  ws={ws}
                  personId={person?.id}
                  action={scheduleButton}
                />
              </TabsContent>
              <TabsContent value="week">
                <WeekGrid ws={ws} meetings={scoped} />
              </TabsContent>
              <TabsContent value="past">
                <PastTable ws={ws} meetings={scoped} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}

      {scheduling && (
        <ScheduleMeetingDialog
          open
          onOpenChange={closeSchedule}
          personId={person?.id}
          type={isMeetingType(typeParam) ? typeParam : undefined}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------- KPIs */

function Kpis({ meetings }: { meetings: Meeting[] }) {
  const day = today()
  const weekStart = startOfWeek(day)
  const weekEnd = addDays(weekStart, 6)
  const windowStart = addDays(day, -WINDOW_DAYS)
  const live = meetings.filter((m) => m.status !== "cancelled")
  const onDay = live.filter((m) => dayOf(m.scheduledAt) === day)
  const inWeek = live.filter((m) => {
    const d = dayOf(m.scheduledAt)
    return d >= weekStart && d <= weekEnd
  })
  const inWindow = meetings.filter((m) => {
    const d = dayOf(m.scheduledAt)
    return d >= windowStart && d <= day
  })
  const held = inWindow.filter((m) => m.status === "completed").length
  const cancelled = inWindow.filter((m) => m.status === "cancelled").length
  const slots = held + cancelled

  return (
    <StatGrid columns={5}>
      <StatCard
        label="Today"
        value={onDay.length}
        hint={
          onDay.length
            ? `${plural(onDay.filter((m) => m.status === "completed").length, "held", "held")} so far`
            : "Nothing on the calendar"
        }
      />
      <StatCard
        label="This week"
        value={inWeek.length}
        hint={`${formatDay(weekStart)} to ${formatDay(weekEnd)}`}
      />
      <StatCard
        label="Held"
        value={held}
        hint={`In the last ${WINDOW_DAYS} days`}
      />
      <StatCard
        label="Cancelled"
        value={cancelled}
        hint={`In the last ${WINDOW_DAYS} days`}
      />
      <StatCard
        label="Share held"
        value={slots ? formatPercent((held / slots) * 100) : "None yet"}
        hint={
          slots
            ? `${held} of ${plural(slots, "slot")} in the last ${WINDOW_DAYS} days`
            : `No slots in the last ${WINDOW_DAYS} days`
        }
      />
    </StatGrid>
  )
}

/* ---------------------------------------------------------------- upcoming */

function UpcomingList({
  ws,
  personId,
  action,
}: {
  ws: Workspace
  personId?: string
  action: React.ReactNode
}) {
  const upcoming = upcomingMeetings(ws, personId)
  if (!upcoming.length)
    return (
      <EmptyState
        title="Nothing scheduled"
        description="No 1:1 is on the calendar. Schedule the next one so the cadence does not lapse."
        action={action}
      />
    )

  const days = new Map<string, Meeting[]>()
  for (const m of upcoming) {
    const d = dayOf(m.scheduledAt)
    days.set(d, [...(days.get(d) ?? []), m])
  }
  const day = today()

  return (
    <div className="flex flex-col gap-6">
      {[...days.entries()].map(([d, list]) => (
        <section key={d} className="flex flex-col gap-2">
          <h2 className="flex flex-wrap items-baseline gap-2 text-sm font-semibold tracking-tight">
            {formatRelativeDay(d)}
            <span className="text-xs font-normal text-muted-foreground">
              {formatDayLong(d)}
              {d < day ? ", not held yet" : ""}
            </span>
          </h2>
          <Card className="py-0">
            <CardContent className="px-0">
              <ul className="divide-y">
                {list.map((m) => (
                  <UpcomingRow key={m.id} meeting={m} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  )
}

function UpcomingRow({ meeting }: { meeting: Meeting }) {
  const theirs = meeting.agenda.filter((a) => a.owner === "report").length
  return (
    <li>
      <Link
        href={`/meetings/session?id=${meeting.id}`}
        className="flex flex-col gap-2 px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 sm:flex-row sm:items-center sm:gap-4"
      >
        <PersonChip
          personId={meeting.personId}
          size="md"
          showRole
          link={false}
          className="sm:w-56 sm:shrink-0"
        />
        <span className="text-sm tabular-nums sm:w-36 sm:shrink-0">
          {formatTime(meeting.scheduledAt)}
          <span className="text-muted-foreground">
            , {formatMinutes(meeting.durationMin)}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <TypeBadge type={meeting.type} />
          {meeting.status === "in-progress" && (
            <StateBadge state="In progress" pulse />
          )}
          <span className="text-xs text-muted-foreground">
            {plural(meeting.agenda.length, "agenda item")}
          </span>
          {theirs === 0 && (
            <span className="text-xs text-warning-text">
              Their agenda is empty
            </span>
          )}
        </span>
        <ChevronRightIcon
          aria-hidden
          className="hidden size-4 shrink-0 text-muted-foreground sm:block"
        />
      </Link>
    </li>
  )
}

/* -------------------------------------------------------------------- week */

function WeekGrid({ ws, meetings }: { ws: Workspace; meetings: Meeting[] }) {
  const [offset, setOffset] = React.useState(0)
  const day = today()
  const monday = addDays(startOfWeek(day), offset * 7)
  const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i))
  const weekend = meetings.filter((m) => {
    const d = dayOf(m.scheduledAt)
    return d === addDays(monday, 5) || d === addDays(monday, 6)
  }).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          {formatDay(days[0])} to {formatDay(days[4])}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => setOffset((o) => o - 1)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(0)}
          >
            This week
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next week"
            onClick={() => setOffset((o) => o + 1)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {days.map((d) => {
          const list = meetings
            .filter((m) => dayOf(m.scheduledAt) === d)
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
          const isToday = d === day
          return (
            <section
              key={d}
              aria-label={formatDayLong(d)}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "flex min-h-28 flex-col gap-2 rounded-xl border bg-card p-3 md:min-h-64",
                isToday && "border-brand/40 bg-brand/5"
              )}
            >
              <h3 className="flex items-center justify-between gap-2 text-xs font-medium">
                <span className={cn(isToday && "text-brand")}>
                  {formatDay(d, { weekday: "short" })}
                </span>
                {isToday && <StateBadge state="Today" size="sm" dot={false} />}
              </h3>
              {list.length ? (
                <ul className="flex flex-col gap-2">
                  {list.map((m) => (
                    <WeekEntry key={m.id} ws={ws} meeting={m} />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No 1:1s</p>
              )}
            </section>
          )
        })}
      </div>
      {weekend > 0 && (
        <p className="text-xs text-muted-foreground">
          {plural(weekend, "1:1")} on the weekend of this week{" "}
          {weekend === 1 ? "is" : "are"} not shown in the grid.
        </p>
      )}
    </div>
  )
}

function WeekEntry({ ws, meeting }: { ws: Workspace; meeting: Meeting }) {
  const person = getPerson(ws, meeting.personId)
  const cancelled = meeting.status === "cancelled"
  return (
    <li>
      <Link
        href={`/meetings/session?id=${meeting.id}`}
        className={cn(
          "flex flex-col gap-1 rounded-lg border bg-background px-2.5 py-2 text-xs transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
          cancelled && "border-dashed text-muted-foreground"
        )}
      >
        <span className="flex items-center gap-1.5">
          <PersonAvatar name={person?.name ?? "?"} size="xs" />
          <span
            className={cn(
              "truncate text-sm font-medium",
              cancelled && "line-through"
            )}
          >
            {person ? firstName(person.name) : "Removed person"}
          </span>
        </span>
        <span className="text-muted-foreground tabular-nums">
          {formatTime(meeting.scheduledAt)},{" "}
          {formatMinutes(meeting.durationMin)}
        </span>
        <span className="truncate text-muted-foreground">
          {meetingTypeLabels[meeting.type]}
        </span>
        {meeting.status !== "scheduled" && (
          <StateBadge
            state={meetingStatusLabels[meeting.status]}
            size="sm"
            className="mt-0.5"
          />
        )}
      </Link>
    </li>
  )
}

/* -------------------------------------------------------------------- past */

interface PastRow {
  id: string
  scheduledAt: string
  person: string
  personId: string
  type: Meeting["type"]
  status: "completed" | "cancelled"
  topics: string[]
  talkShare: number | null
  commitments: number
}

const col = createColumnHelper<DataTableFeatures, PastRow>()

const pastColumns = col.columns([
  col.accessor("scheduledAt", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap tabular-nums">
        {formatDay(getValue())}
        <span className="text-muted-foreground">
          , {formatTime(getValue())}
        </span>
      </span>
    ),
    meta: { label: "Date", width: "w-44" },
  }),
  col.accessor("person", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Person" />
    ),
    cell: ({ row }) => (
      <PersonChip personId={row.original.personId} link={false} />
    ),
    meta: { label: "Person" },
  }),
  col.accessor((r) => meetingTypeLabels[r.type], {
    id: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Conversation" />
    ),
    cell: ({ row }) => <TypeBadge type={row.original.type} />,
    meta: { label: "Conversation" },
  }),
  col.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ getValue }) => (
      <StateBadge state={meetingStatusLabels[getValue()]} />
    ),
    meta: { label: "Status" },
  }),
  col.accessor((r) => r.topics.join(", "), {
    id: "topics",
    header: "Topics",
    enableSorting: false,
    cell: ({ getValue }) =>
      getValue() ? (
        <TruncatedText className="max-w-64">{getValue()}</TruncatedText>
      ) : (
        <EmptyValue />
      ),
    meta: { label: "Topics" },
  }),
  col.accessor("talkShare", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Their talk share"
        align="right"
        hint="Share of the words spoken by the direct report, from the transcript when one was added."
      />
    ),
    cell: ({ getValue }) => {
      const share = getValue()
      return share === null ? <EmptyValue /> : formatPercent(share)
    },
    meta: { label: "Their talk share", numeric: true, align: "right" },
  }),
  col.accessor("commitments", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Commitments"
        align="right"
      />
    ),
    cell: ({ getValue }) => getValue(),
    meta: { label: "Commitments", numeric: true, align: "right" },
  }),
])

const pastFacets: FacetDef<PastRow>[] = [
  {
    id: "type",
    title: "Conversation",
    options: meetingTypes.map((t) => ({
      value: t,
      label: meetingTypeLabels[t],
    })),
    getValue: (r) => r.type,
  },
  {
    id: "status",
    title: "Status",
    options: [
      { value: "completed", label: meetingStatusLabels.completed },
      { value: "cancelled", label: meetingStatusLabels.cancelled },
    ],
    getValue: (r) => r.status,
  },
]

function PastTable({ ws, meetings }: { ws: Workspace; meetings: Meeting[] }) {
  const rows = React.useMemo<PastRow[]>(
    () =>
      meetings
        .filter((m) => m.status === "completed" || m.status === "cancelled")
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
        .map((m) => ({
          id: m.id,
          scheduledAt: m.scheduledAt,
          person: getPerson(ws, m.personId)?.name ?? "Removed person",
          personId: m.personId,
          type: m.type,
          status: m.status as PastRow["status"],
          topics: m.summary?.topics ?? [],
          talkShare: m.stats ? m.stats.reportShare : null,
          commitments: ws.commitments.filter((c) => c.sourceMeetingId === m.id)
            .length,
        })),
    [meetings, ws]
  )

  return (
    <DataTable
      columns={pastColumns}
      data={rows}
      getRowId={(r) => r.id}
      getSearchText={(r) =>
        [r.person, meetingTypeLabels[r.type], ...r.topics].join(" ")
      }
      searchPlaceholder="Search past 1:1s"
      facets={pastFacets}
      rowHref={(r) => `/meetings/session?id=${r.id}`}
      totalLabel="1:1s"
      emptyTitle="No past 1:1s"
      emptyMessage="Held and cancelled 1:1s appear here once there are some."
    />
  )
}
