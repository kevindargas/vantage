"use client"

import * as React from "react"
import { MessageSquareTextIcon, PenLineIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { MetricTile } from "@/components/shared/metric-tile"
import { Section } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { FeedbackComposer } from "@/features/shared/feedback-composer"
import {
  competencyLabels,
  FEEDBACK_GAP_DAYS,
  FEEDBACK_WINDOW_HOURS,
  recognitionLabels,
} from "@/lib/constants"
import { firstName, formatDay, plural } from "@/lib/format"
import { daysBetween, daysSince } from "@/lib/time"
import type { CompetencyArea, FeedbackEntry, Person } from "@/lib/types"
import { actions, workspace } from "@/lib/vantage/store"
import { SourceLink } from "./parts/common"

type Filter = "all" | "recognition" | "developmental" | "upward"

const filterLabels: Record<Filter, string> = {
  all: "All",
  recognition: "Recognition",
  developmental: "Developmental",
  upward: "Upward",
}

const competencies = Object.keys(competencyLabels) as CompetencyArea[]

function modeOf(entry: FeedbackEntry): Exclude<Filter, "all"> {
  return entry.direction === "upward" ? "upward" : entry.kind
}

/** The SBII ledger for one person. */
export function FeedbackTab({ person }: { person: Person }) {
  const ws = workspace.use()
  const [composing, setComposing] = React.useState(false)
  const [filter, setFilter] = React.useState<Filter>("all")
  const [deleting, setDeleting] = React.useState<string | null>(null)
  const name = firstName(person.name)

  const entries = ws.feedback
    .filter((f) => f.personId === person.id)
    .sort(
      (a, b) =>
        b.observedDate.localeCompare(a.observedDate) ||
        b.recordedAt.localeCompare(a.recordedAt)
    )
  const given = entries.filter((f) => f.direction === "given")
  const counts: Record<Filter, number> = {
    all: entries.length,
    recognition: given.filter((f) => f.kind === "recognition").length,
    developmental: given.filter((f) => f.kind === "developmental").length,
    upward: entries.length - given.length,
  }
  const drafts = given.filter((f) => !f.deliveredDate)
  const lastDelivered = given
    .map((f) => f.deliveredDate)
    .filter((d): d is string => !!d)
    .sort()
    .pop()
  const gap = lastDelivered ? daysSince(lastDelivered) : null
  const delivered = given.filter((f) => f.deliveredDate)
  const untagged = delivered.filter((f) => !f.competency).length
  const shown = entries.filter((f) => filter === "all" || modeOf(f) === filter)
  const target = entries.find((f) => f.id === deleting)

  const writeButton = (
    <Button size="sm" onClick={() => setComposing(true)}>
      <PenLineIcon data-icon="inline-start" />
      Write feedback
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <Card size="sm">
        <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="space-y-1">
            <Eyebrow>Recognition preference</Eyebrow>
            <p className="text-sm font-medium">
              {recognitionLabels[person.recognitionPref]}
            </p>
          </div>
          <div className="space-y-1">
            <Eyebrow>How {name} likes feedback</Eyebrow>
            <p className="text-sm">
              {person.feedbackStyle ?? (
                <span className="text-muted-foreground">
                  Not recorded yet. Ask in your next 1:1 and add it on the
                  retention tab.
                </span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <StatGrid columns={5}>
        <StatCard
          label="Recognition given"
          value={counts.recognition}
          hint="Specific praise on the record"
        />
        <StatCard
          label="Developmental given"
          value={counts.developmental}
          hint="Behavior and impact, with an intent question"
        />
        <StatCard
          label="Upward received"
          value={counts.upward}
          hint={`From ${name} to you`}
        />
        <StatCard
          label="Undelivered drafts"
          value={drafts.length}
          hint={
            drafts.length
              ? `Say it within ${FEEDBACK_WINDOW_HOURS} hours of the event`
              : "Nothing waiting to be said"
          }
        />
        <StatCard
          label="Days since last feedback"
          value={gap ?? "None yet"}
          hint={
            gap === null
              ? "No delivered feedback on the record"
              : gap >= FEEDBACK_GAP_DAYS
                ? `Past the ${FEEDBACK_GAP_DAYS} day reminder line`
                : `Inside the ${FEEDBACK_GAP_DAYS} day rhythm`
          }
        />
      </StatGrid>

      <Section
        title="Evidence coverage"
        description="Delivered feedback per competency area, so thin areas show up before review time."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {competencies.map((c) => {
            const n = delivered.filter((f) => f.competency === c).length
            return (
              <MetricTile
                key={c}
                label={competencyLabels[c]}
                value={n}
                tone={n === 0 ? "warning" : undefined}
                hint={
                  n === 0
                    ? "No delivered evidence yet"
                    : plural(n, "delivered entry", "delivered entries")
                }
              />
            )
          })}
        </div>
        {untagged > 0 && (
          <p className="text-xs text-muted-foreground">
            {plural(untagged, "delivered entry", "delivered entries")} not
            tagged to a competency area.
          </p>
        )}
      </Section>

      <Section
        title="Ledger"
        count={entries.length}
        description="Newest first. Each entry names the situation, the behavior and its impact."
        actions={writeButton}
      >
        {entries.length === 0 ? (
          <EmptyState
            icon={<MessageSquareTextIcon />}
            title="No feedback on the record"
            description={`Write the first entry for ${name}: one situation, what they did and the effect it had.`}
            action={writeButton}
          />
        ) : (
          <>
            <ToggleGroup
              value={[filter]}
              onValueChange={(v) => {
                const next = v[0] as Filter | undefined
                if (next) setFilter(next)
              }}
              variant="outline"
              size="sm"
              aria-label="Filter by kind"
              className="max-w-full flex-wrap"
            >
              {(Object.keys(filterLabels) as Filter[]).map((f) => (
                <ToggleGroupItem key={f} value={f}>
                  {filterLabels[f]}
                  <CountPill count={counts[f]} />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {shown.length === 0 ? (
              <EmptyState
                size="sm"
                title={`No ${filterLabels[filter].toLowerCase()} feedback yet`}
                description="Pick another kind or write a new entry."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {shown.map((entry) => (
                  <li key={entry.id}>
                    <EntryCard
                      entry={entry}
                      name={name}
                      onDelete={() => setDeleting(entry.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>

      <FeedbackComposer
        open={composing}
        onOpenChange={setComposing}
        personId={person.id}
      />

      <AlertDialog
        open={!!target}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this feedback entry?</AlertDialogTitle>
            <AlertDialogDescription>
              The entry leaves {name}&apos;s ledger, the timeline and any review
              evidence built from it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!target) return
                actions.remove("feedback", target.id)
                toast.success("Feedback entry deleted")
                setDeleting(null)
              }}
            >
              Delete entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Part({ label, children }: { label: string; children: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-3">
      <dt>
        <Eyebrow as="span">{label}</Eyebrow>
      </dt>
      <dd className="text-sm leading-relaxed">{children}</dd>
    </div>
  )
}

function EntryCard({
  entry,
  name,
  onDelete,
}: {
  entry: FeedbackEntry
  name: string
  onDelete: () => void
}) {
  const mode = modeOf(entry)
  const draft = entry.direction === "given" && !entry.deliveredDate
  const waitedDays = daysSince(entry.observedDate)
  const late = waitedDays * 24 > FEEDBACK_WINDOW_HOURS
  const lag = entry.deliveredDate
    ? daysBetween(entry.observedDate, entry.deliveredDate)
    : 0

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <StateBadge state={filterLabels[mode]} />
          {entry.competency && (
            <StateBadge
              state={competencyLabels[entry.competency]}
              tone="neutral"
              dot={false}
            />
          )}
          {draft ? (
            <StateBadge state="Not delivered" />
          ) : (
            entry.direction === "given" && <StateBadge state="Delivered" />
          )}
          <span className="text-xs text-muted-foreground">
            Observed {formatDay(entry.observedDate)}
            {entry.deliveredDate &&
              (entry.direction === "upward"
                ? `, logged ${formatDay(entry.deliveredDate)}`
                : `, delivered ${formatDay(entry.deliveredDate)}${
                    lag > 0 ? ` (${plural(lag, "day")} later)` : ""
                  }`)}
          </span>
        </div>

        <dl className="flex flex-col gap-2">
          <Part label="Situation">{entry.situation}</Part>
          <Part label="Behavior">{entry.behavior}</Part>
          <Part label="Impact">{entry.impact}</Part>
          {entry.intent && <Part label="Intent">{entry.intent}</Part>}
        </dl>

        {draft && (
          <p
            className={
              late
                ? "rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning-text"
                : "rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            }
          >
            {waitedDays === 0
              ? "Observed today."
              : `Observed ${plural(waitedDays, "day")} ago.`}{" "}
            {late
              ? `That is past the ${FEEDBACK_WINDOW_HOURS} hour window. Say it to ${name} in private now.`
              : `Still inside the ${FEEDBACK_WINDOW_HOURS} hour window.`}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <SourceLink meetingId={entry.sourceMeetingId} />
          <div className="ml-auto flex items-center gap-1.5">
            {draft && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  actions.markFeedbackDelivered(entry.id)
                  toast.success("Feedback marked as delivered")
                }}
              >
                Mark as delivered
              </Button>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete entry"
              onClick={onDelete}
            >
              <Trash2Icon />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
