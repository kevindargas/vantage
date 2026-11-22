"use client"

import * as React from "react"
import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  CheckIcon,
  MessageSquareHeartIcon,
  PenLineIcon,
  SendIcon,
  UsersIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  EmptyValue,
  TruncatedText,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { PageHeader, Section } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { FeedbackComposer } from "@/features/shared/feedback-composer"
import { PersonChip, PersonSelect } from "@/features/shared/person"
import { useQueryParam } from "@/hooks/use-query-param"
import {
  competencyLabels,
  FEEDBACK_GAP_DAYS,
  FEEDBACK_WINDOW_HOURS,
  feedbackKindLabels,
} from "@/lib/constants"
import { dayDistance, firstName, formatDay, formatPercent } from "@/lib/format"
import { daysSince } from "@/lib/time"
import type { CompetencyArea, FeedbackEntry, FeedbackKind } from "@/lib/types"
import { activePeople, getPerson } from "@/lib/vantage/selectors"
import { workspace } from "@/lib/vantage/store"
import {
  deliveryState,
  FeedbackEntrySheet,
  isDraft,
  markDelivered,
  pastWindow,
} from "./feedback-entry-sheet"

/** Look-back for the "recent" figures in the KPI row. */
const RECENT_DAYS = 30

const directionLabels: Record<FeedbackEntry["direction"], string> = {
  given: "Given",
  upward: "Upward",
}

const howTo = [
  {
    label: "Situation",
    rule: "Name the time and place, so you both picture the same moment.",
    example: "Thursday's incident review for the ingestion outage",
  },
  {
    label: "Behavior",
    rule: "Say what a camera would have captured. No labels, no motives.",
    example: "Asked for review three days after opening the pull request",
  },
  {
    label: "Impact",
    rule: "Say what it led to for the work, the team or you.",
    example:
      "Feedback arrived after the sprint closed, so the fix carried over",
  },
  {
    label: "Intent",
    rule: "Ask what they were going for, then listen.",
    example: "What would make asking sooner easier?",
  },
]

const col = createColumnHelper<DataTableFeatures, FeedbackEntry>()

const columns = col.columns([
  col.accessor("observedDate", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Observed" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} mode="absolute" />,
    enableHiding: false,
    meta: { width: "w-28", label: "Observed" },
  }),
  col.accessor("personId", {
    header: "Person",
    cell: ({ getValue }) => (
      <PersonChip personId={getValue()} size="xs" link={false} />
    ),
    enableSorting: false,
    meta: { width: "w-44" },
  }),
  col.accessor("kind", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Kind" />
    ),
    cell: ({ getValue }) => (
      <StateBadge size="sm" state={feedbackKindLabels[getValue()]} />
    ),
    meta: { width: "w-32", label: "Kind" },
  }),
  col.accessor("direction", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Direction" />
    ),
    cell: ({ getValue }) => (
      <StateBadge
        size="sm"
        dot={false}
        state={directionLabels[getValue()]}
        tone={getValue() === "upward" ? "brand" : "neutral"}
      />
    ),
    meta: { width: "w-28", label: "Direction" },
  }),
  col.accessor("behavior", {
    header: "Behavior",
    cell: ({ getValue }) => <TruncatedText>{getValue()}</TruncatedText>,
    enableSorting: false,
    meta: { width: "min-w-56 max-w-sm" },
  }),
  col.accessor("competency", {
    header: "Competency",
    cell: ({ getValue }) => {
      const value = getValue()
      return value ? (
        <span className="whitespace-nowrap text-muted-foreground">
          {competencyLabels[value]}
        </span>
      ) : (
        <EmptyValue />
      )
    },
    enableSorting: false,
    meta: { width: "w-44" },
  }),
  col.display({
    id: "delivery",
    header: "Delivery",
    cell: ({ row }) => {
      const state = deliveryState(row.original)
      return (
        <StateBadge
          size="sm"
          state={state}
          tone={state === "Received" ? "muted" : undefined}
        />
      )
    },
    enableSorting: false,
    meta: { width: "w-28", label: "Delivery" },
  }),
])

const facets: FacetDef<FeedbackEntry>[] = [
  {
    id: "kind",
    title: "Kind",
    options: (Object.keys(feedbackKindLabels) as FeedbackKind[]).map((k) => ({
      value: k,
      label: feedbackKindLabels[k],
    })),
    getValue: (f) => f.kind,
  },
  {
    id: "direction",
    title: "Direction",
    options: [
      { value: "given", label: directionLabels.given },
      { value: "upward", label: directionLabels.upward },
    ],
    getValue: (f) => f.direction,
  },
  {
    id: "competency",
    title: "Competency",
    options: [
      ...(Object.keys(competencyLabels) as CompetencyArea[]).map((c) => ({
        value: c,
        label: competencyLabels[c],
      })),
      { value: "none", label: "Not tagged" },
    ],
    getValue: (f) => f.competency ?? "none",
  },
  {
    id: "delivery",
    title: "Delivery",
    options: ["Draft", "Delivered", "Received"].map((s) => ({
      value: s,
      label: s,
    })),
    getValue: (f) => deliveryState(f),
  },
]

export function FeedbackView() {
  const ws = workspace.use()
  const [newParam, setNewParam] = useQueryParam("new")
  const [personParam, setPersonParam] = useQueryParam("person")
  const [entryParam, setEntryParam] = useQueryParam("entry")
  const [composer, setComposer] = React.useState<{ personId?: string } | null>(
    null
  )

  const people = activePeople(ws)
  const personId =
    personParam && people.some((p) => p.id === personParam)
      ? personParam
      : undefined
  const scoped = ws.feedback.filter((f) =>
    personId ? f.personId === personId : people.some((p) => p.id === f.personId)
  )
  const given = scoped.filter((f) => f.direction === "given")
  const delivered = given.filter((f) => !!f.deliveredDate)
  const recent = delivered.filter(
    (f) => daysSince(f.deliveredDate ?? f.observedDate) <= RECENT_DAYS
  )
  const recentRecognition = recent.filter((f) => f.kind === "recognition")
  const drafts = given
    .filter(isDraft)
    .sort((a, b) => a.observedDate.localeCompare(b.observedDate))
  const upward = scoped.filter((f) => f.direction === "upward")

  const coverage = (
    personId ? people.filter((p) => p.id === personId) : people
  ).map((p) => {
    const mine = ws.feedback.filter(
      (f) => f.personId === p.id && f.direction === "given" && f.deliveredDate
    )
    const last = mine
      .map((f) => f.deliveredDate ?? "")
      .sort()
      .pop()
    return {
      person: p,
      last,
      overdue: !last || daysSince(last) > FEEDBACK_GAP_DAYS,
      recognition: mine.filter((f) => f.kind === "recognition").length,
      developmental: mine.filter((f) => f.kind === "developmental").length,
    }
  })
  const gaps = coverage.filter((row) => row.overdue)

  const ledger = [...scoped].sort((a, b) =>
    b.observedDate.localeCompare(a.observedDate)
  )
  const entry = entryParam
    ? ws.feedback.find((f) => f.id === entryParam)
    : undefined
  const composerPerson = composer?.personId ?? personId

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        nav="/feedback"
        description="Every piece of feedback as situation, behavior, impact and intent: what you gave, what is still unsaid and what came back to you."
        actions={
          <>
            <label htmlFor="feedback-person" className="sr-only">
              Filter by person
            </label>
            <PersonSelect
              id="feedback-person"
              className="w-44"
              value={personId ?? "all"}
              allLabel="Everyone"
              onChange={(v) => setPersonParam(v === "all" ? null : v)}
            />
            <Button
              onClick={() => setComposer({})}
              disabled={people.length === 0}
            >
              <PenLineIcon />
              Write feedback
            </Button>
          </>
        }
      />

      {people.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="No one to give feedback to yet"
          description="Add a direct report first. Feedback you write will build a ledger here."
          action={
            <Button render={<Link href="/people?new=1" />}>Add a person</Button>
          }
        />
      ) : (
        <>
          <StatGrid columns={5}>
            <StatCard
              label={`Given in the last ${RECENT_DAYS} days`}
              value={recent.length}
              hint={`${delivered.length} delivered in total`}
            />
            <StatCard
              label="Recognition share"
              value={
                recent.length
                  ? formatPercent(
                      Math.round(
                        (recentRecognition.length / recent.length) * 100
                      )
                    )
                  : "n/a"
              }
              hint={`${recentRecognition.length} of ${recent.length} in the last ${RECENT_DAYS} days`}
            />
            <StatCard
              label="Undelivered drafts"
              value={drafts.length}
              hint={`${drafts.filter(pastWindow).length} past the ${FEEDBACK_WINDOW_HOURS} hour window`}
            />
            <StatCard
              label={`No feedback in ${FEEDBACK_GAP_DAYS} days`}
              value={gaps.length}
              hint={`Of ${coverage.length} ${coverage.length === 1 ? "person" : "people"}`}
            />
            <StatCard
              label="Upward feedback received"
              value={upward.length}
              hint="What your people told you"
            />
          </StatGrid>

          <Section
            title="Needs delivery"
            count={drafts.length}
            description={`Written down and not yet said. Corrective feedback lands best inside ${FEEDBACK_WINDOW_HOURS} hours, in private.`}
          >
            {drafts.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<SendIcon />}
                title="Nothing is waiting to be said"
                description="Feedback you save as a draft stays here until you mark it as delivered."
              />
            ) : (
              <Card className="py-0">
                <ul
                  aria-label="Needs delivery"
                  className="divide-y divide-border/70"
                >
                  {drafts.map((f) => {
                    const name = firstName(
                      getPerson(ws, f.personId)?.name ?? ""
                    )
                    const late = pastWindow(f)
                    return (
                      <li
                        key={f.id}
                        className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1 basis-64 space-y-1.5">
                          <p className="text-sm leading-snug font-medium text-pretty">
                            {f.behavior}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                            <StateBadge
                              size="sm"
                              state={feedbackKindLabels[f.kind]}
                            />
                            <PersonChip personId={f.personId} size="xs" />
                            <span className="whitespace-nowrap">
                              Observed {formatDay(f.observedDate)},{" "}
                              {dayDistance(f.observedDate)}
                            </span>
                            <span
                              className={cn(
                                "whitespace-nowrap",
                                late
                                  ? "font-medium text-danger-text"
                                  : "text-success-text"
                              )}
                            >
                              {late ? "Past" : "Inside"} the{" "}
                              {FEEDBACK_WINDOW_HOURS} hour window
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEntryParam(f.id)}
                          >
                            Open
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Mark as delivered: ${f.behavior}`}
                            onClick={() => markDelivered(f, name)}
                          >
                            <CheckIcon />
                            Mark as delivered
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )}
          </Section>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Section
              title="Coverage by person"
              description={`When each person last heard feedback from you. Anyone past ${FEEDBACK_GAP_DAYS} days is highlighted.`}
            >
              {ws.settings.worksCouncilMode ? (
                <Card>
                  <CardContent className="text-sm text-muted-foreground">
                    Works council mode is on, so feedback is not compared person
                    by person. The team figures above still apply. You can
                    change this in Settings.
                  </CardContent>
                </Card>
              ) : (
                <Card className="py-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Person</TableHead>
                        <TableHead>Last feedback</TableHead>
                        <TableHead className="text-right">
                          Recognition
                        </TableHead>
                        <TableHead className="text-right">
                          Developmental
                        </TableHead>
                        <TableHead className="pr-4">
                          <span className="sr-only">Write</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coverage.map((row) => (
                        <TableRow key={row.person.id}>
                          <TableCell className="pl-4">
                            <PersonChip personId={row.person.id} size="xs" />
                          </TableCell>
                          <TableCell
                            className={cn(
                              "whitespace-nowrap",
                              row.overdue
                                ? "font-medium text-warning-text"
                                : "text-muted-foreground"
                            )}
                          >
                            {row.last ? dayDistance(row.last) : "None yet"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.recognition}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.developmental}
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Write feedback for ${row.person.name}`}
                              onClick={() =>
                                setComposer({ personId: row.person.id })
                              }
                            >
                              <PenLineIcon />
                              Write
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </Section>

            <Card>
              <CardHeader>
                <CardTitle>How to write it</CardTitle>
                <CardDescription>
                  Four parts, one or two sentences each. Give corrective
                  feedback within {FEEDBACK_WINDOW_HOURS} hours and in private,
                  not saved up for the next 1:1.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-3">
                  {howTo.map((part) => (
                    <li key={part.label}>
                      <Eyebrow as="h3">{part.label}</Eyebrow>
                      <p className="mt-0.5 text-sm">{part.rule}</p>
                      <p className="mt-1 border-l-2 border-border pl-2.5 text-xs text-muted-foreground">
                        {part.example}
                      </p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>

          <Section title="Ledger" count={ledger.length}>
            <DataTable
              columns={columns}
              data={ledger}
              getRowId={(f) => f.id}
              getSearchText={(f) =>
                [
                  getPerson(ws, f.personId)?.name,
                  f.situation,
                  f.behavior,
                  f.impact,
                  f.intent,
                ].join(" ")
              }
              searchPlaceholder="Search feedback"
              facets={facets}
              initialSorting={[{ id: "observedDate", desc: true }]}
              onRowClick={(f) => setEntryParam(f.id)}
              totalLabel="entries"
              caption="Feedback ledger"
              emptyIcon={<MessageSquareHeartIcon />}
              emptyTitle="No feedback recorded yet"
              emptyMessage="Write the first entry: one situation, one behavior and its impact."
              emptyAction={
                <Button variant="outline" onClick={() => setComposer({})}>
                  <PenLineIcon />
                  Write feedback
                </Button>
              }
              pageSize={10}
            />
          </Section>
        </>
      )}

      <FeedbackComposer
        open={composer !== null || newParam === "1"}
        personId={composerPerson}
        onOpenChange={(next) => {
          if (next) return
          setComposer(null)
          setNewParam(null)
        }}
      />
      <FeedbackEntrySheet entry={entry} onClose={() => setEntryParam(null)} />
    </div>
  )
}
