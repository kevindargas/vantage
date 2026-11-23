"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  BellIcon,
  CalendarIcon,
  HistoryIcon,
  ListChecksIcon,
  SearchIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useQueryParam } from "@/hooks/use-query-param"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge, toneClasses } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { focusLabels } from "@/lib/constants"
import { dayDistance, formatWhen } from "@/lib/format"
import type { Person, PersonFocus, Workspace } from "@/lib/types"
import {
  cadenceHealth,
  cadenceStateLabels,
  nextScheduled,
} from "@/lib/vantage/cadence"
import { buildNudges, type Nudge } from "@/lib/vantage/nudges"
import { isOverdue, openCommitments, pulsesFor } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { AddPersonWizard } from "./add-person-wizard"
import { focusOptions, PulseMeter, SimpleSelect, type Option } from "./parts"

type FocusFilter = "all" | PersonFocus

const focusFilterOptions: Option<FocusFilter>[] = [
  { value: "all", label: "All focus areas" },
  ...focusOptions,
]

export function PeopleView() {
  const ws = workspace.use()
  const [newParam, setNewParam] = useQueryParam("new")
  const [query, setQuery] = React.useState("")
  const [focus, setFocus] = React.useState<FocusFilter>("all")
  const [showArchived, setShowArchived] = React.useState(false)

  const nudges = React.useMemo(() => buildNudges(ws), [ws])
  const active = ws.people.filter((p) => p.status === "active")
  const archivedCount = ws.people.length - active.length
  const states = active.map((p) => cadenceHealth(p, ws.meetings).state)
  const onCadence = states.filter((s) => s === "healthy").length
  const offCadence = states.filter(
    (s) => s === "overdue" || s === "drifting"
  ).length
  const due = states.filter((s) => s === "due").length
  const notStarted = states.filter((s) => s === "new").length
  const onboarding = active.filter((p) => p.focus === "onboarding").length

  const needle = query.trim().toLowerCase()
  const visible = ws.people
    .filter((p) => showArchived || p.status === "active")
    .filter((p) => focus === "all" || p.focus === focus)
    .filter(
      (p) =>
        !needle ||
        [p.name, p.role, p.team, p.location, p.level]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle)
    )
    .sort(
      (a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name)
    )
  const filtered = needle !== "" || focus !== "all"

  const addButton = (
    <Button onClick={() => setNewParam("1")}>
      <UserPlusIcon /> Add person
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        nav="/people"
        description="Your direct reports and the running record for each. Open a person to see their 1:1s, commitments, goals and more."
        actions={addButton}
      />

      {ws.people.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="Add your first direct report"
          description="Adding a person sets up their profile, a 1:1 cadence that fits their role and a first conversation. Everything else you track hangs off that record."
          action={
            <>
              {addButton}
              <Button
                variant="outline"
                onClick={() => {
                  actions.loadSample()
                  toast.success("Sample team loaded", {
                    description:
                      "Explore with made-up people. Clear them in Settings when you are ready.",
                  })
                }}
              >
                Load the sample team
              </Button>
            </>
          }
        />
      ) : (
        <>
          <StatGrid columns={4}>
            <StatCard
              label="Direct reports"
              value={active.length}
              hint={
                archivedCount ? `${archivedCount} archived` : "Active people"
              }
            />
            <StatCard
              label="On cadence"
              value={onCadence}
              unit={`/ ${active.length}`}
              hint={
                notStarted
                  ? `${notStarted} not started yet`
                  : "Meeting as often as planned"
              }
            />
            <StatCard
              label="Overdue or drifting"
              value={offCadence}
              hint={due ? `${due} more due now` : "Series that need a look"}
            />
            <StatCard
              label="In onboarding"
              value={onboarding}
              hint="Focus set to onboarding"
            />
          </StatGrid>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                aria-label="Search people"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, role or team"
                className="pl-8"
              />
            </div>
            <SimpleSelect
              aria-label="Filter by focus"
              value={focus}
              onChange={setFocus}
              options={focusFilterOptions}
              className="sm:w-52"
            />
            <div className="flex items-center gap-2 sm:ml-auto">
              <Switch
                id="people-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="people-archived" className="text-sm font-normal">
                Show archived
                {archivedCount > 0 && (
                  <span className="text-muted-foreground">
                    ({archivedCount})
                  </span>
                )}
              </Label>
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<SearchIcon />}
              title={filtered ? "No one matches" : "Everyone here is archived"}
              description={
                filtered
                  ? "Try a different search or focus."
                  : "Turn on Show archived to see them, or add a person."
              }
              action={
                filtered ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery("")
                      setFocus("all")
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowArchived(true)}
                  >
                    Show archived
                  </Button>
                )
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((person) => (
                <li key={person.id} className="min-w-0">
                  <PersonCard ws={ws} person={person} nudges={nudges} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <AddPersonWizard
        open={newParam === "1"}
        onOpenChange={(open) => setNewParam(open ? "1" : null)}
      />
    </div>
  )
}

/* -------------------------------------------------------------------- card */

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="mt-px shrink-0 text-muted-foreground [&_svg]:size-3.5">
        {icon}
      </span>
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-foreground">{children}</dd>
    </div>
  )
}

function PersonCard({
  ws,
  person,
  nudges,
}: {
  ws: Workspace
  person: Person
  nudges: Nudge[]
}) {
  const archived = person.status === "archived"
  const health = cadenceHealth(person, ws.meetings)
  const next = nextScheduled(ws.meetings, person.id)
  const open = openCommitments(ws, person.id)
  const mine = open.filter((c) => c.owner === "manager")
  const theirs = open.filter((c) => c.owner === "report")
  const mineOverdue = mine.filter(isOverdue).length
  const theirsOverdue = theirs.filter(isOverdue).length
  const pulse = pulsesFor(ws, person.id).at(-1)
  const personNudges = nudges.filter((n) => n.personId === person.id)
  const urgent = personNudges.some((n) => n.severity === "danger")
  const place = [person.team, person.location].filter(Boolean).join(" · ")

  return (
    <Link
      href={`/people/profile?id=${person.id}`}
      className={cn(
        "group/person flex h-full lift flex-col gap-4 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10 outline-none hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring",
        archived && "opacity-75"
      )}
    >
      <div className="flex items-start gap-3">
        <PersonAvatar name={person.name} size="lg" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-heading text-base font-semibold tracking-tight">
            {person.name}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {person.role}
          </p>
          {place && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {place}
            </p>
          )}
        </div>
        {personNudges.length > 0 && (
          <span
            className={cn(
              "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-2xs font-medium tabular-nums",
              toneClasses[urgent ? "danger" : "warning"].soft
            )}
          >
            <BellIcon aria-hidden className="size-3" />
            {personNudges.length}
            <span className="sr-only">
              {personNudges.length === 1 ? "nudge" : "nudges"}
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {archived && <StateBadge state="Archived" size="sm" />}
        <StateBadge state={focusLabels[person.focus]} size="sm" />
        {!archived && (
          <StateBadge state={cadenceStateLabels[health.state]} size="sm" />
        )}
      </div>

      <dl className="flex flex-col gap-2 border-t pt-3">
        <Row icon={<CalendarIcon />} label="Next 1:1">
          {next ? (
            <span className="font-medium">{formatWhen(next.scheduledAt)}</span>
          ) : (
            <span className="text-muted-foreground">Nothing scheduled</span>
          )}
        </Row>
        <Row icon={<HistoryIcon />} label="Last 1:1">
          {health.lastHeldDay ? (
            <span
              className={cn(
                health.state === "overdue" &&
                  cn("font-medium", toneClasses.danger.text)
              )}
            >
              {dayDistance(health.lastHeldDay)}
            </span>
          ) : (
            <span className="text-muted-foreground">None held yet</span>
          )}
        </Row>
        <Row icon={<ListChecksIcon />} label="Commitments">
          {open.length === 0 ? (
            <span className="text-muted-foreground">Nothing open</span>
          ) : (
            <span className="flex flex-wrap gap-x-1.5">
              <span>
                You owe{" "}
                <span className="font-medium tabular-nums">{mine.length}</span>
              </span>
              <span aria-hidden className="text-muted-foreground">
                /
              </span>
              <span>
                they owe{" "}
                <span className="font-medium tabular-nums">
                  {theirs.length}
                </span>
              </span>
              {mineOverdue + theirsOverdue > 0 && (
                <span className={cn("font-medium", toneClasses.danger.text)}>
                  {mineOverdue > 0 && `${mineOverdue} of yours overdue`}
                  {mineOverdue > 0 && theirsOverdue > 0 && ", "}
                  {theirsOverdue > 0 && `${theirsOverdue} of theirs overdue`}
                </span>
              )}
            </span>
          )}
        </Row>
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3">
        {pulse ? (
          <>
            <PulseMeter kind="energy" value={pulse.energy} />
            <PulseMeter kind="workload" value={pulse.workload} />
            <span className="ml-auto text-2xs text-muted-foreground">
              {dayDistance(pulse.date)}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            No pulse logged yet
          </span>
        )}
      </div>
    </Link>
  )
}
