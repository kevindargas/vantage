"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import { ArrowRightIcon, CalendarPlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { MetricTile } from "@/components/shared/metric-tile"
import {
  StateBadge,
  StatusDot,
  toneClasses,
} from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  BLOCKER_RECURRENCE_TRIGGER,
  careerTrackLabels,
  goalStatusLabels,
  HIGH_WORKLOAD_THRESHOLD,
  LOW_ENERGY_THRESHOLD,
  meetingTypeLabels,
  PULSE_WINDOW,
  readinessLabels,
  recognitionLabels,
} from "@/lib/constants"
import {
  dayDistance,
  firstName,
  formatDay,
  formatMinutes,
  formatWhen,
  plural,
} from "@/lib/format"
import type { Person } from "@/lib/types"
import { cadenceHealth, nextScheduled } from "@/lib/vantage/cadence"
import { nudgesFor, type NudgeSeverity } from "@/lib/vantage/nudges"
import {
  currentAspiration,
  followThrough,
  isOverdue,
  openCommitments,
  pulsesFor,
  pulseSummary,
} from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { ScheduleMeetingDialog } from "@/features/shared/schedule-dialog"

const severityLabel: Record<NudgeSeverity, string> = {
  danger: "Urgent",
  warning: "Attention",
  info: "Suggestion",
}

const TOP = 4

function TabLink({
  person,
  tab,
  children,
}: {
  person: Person
  tab: string
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="xs"
      className="text-muted-foreground"
      render={<Link href={`/people/profile?id=${person.id}&tab=${tab}`} />}
    >
      {children} <ArrowRightIcon />
    </Button>
  )
}

function Block({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card size="sm" className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/** The person at a glance, with a way into every other tab. */
export function OverviewTab({ person }: { person: Person }) {
  const ws = workspace.use()
  const [scheduling, setScheduling] = React.useState(false)
  const name = firstName(person.name)
  const archived = person.status === "archived"

  const nudges = nudgesFor(ws, person.id)
  const next = nextScheduled(ws.meetings, person.id)
  const health = cadenceHealth(person, ws.meetings)
  const mine = followThrough(ws.commitments, "manager", person.id)
  const theirs = followThrough(ws.commitments, "report", person.id)
  const pulse = pulseSummary(pulsesFor(ws, person.id))
  const aspiration = currentAspiration(ws, person.id)
  const open = openCommitments(ws, person.id)
  const goals = ws.goals.filter(
    (g) =>
      g.personId === person.id && g.status !== "done" && g.status !== "dropped"
  )
  const blockers = ws.blockers
    .filter((b) => b.personId === person.id && b.status !== "resolved")
    .sort((a, b) => b.occurrences.length - a.occurrences.length)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Block
          title="Needs your attention"
          description={
            nudges.length
              ? `${plural(nudges.length, "nudge")} from ${name}'s record`
              : undefined
          }
          className="lg:col-span-2"
        >
          {nudges.length === 0 ? (
            <EmptyState
              bare
              size="sm"
              title="Nothing needs your attention"
              description={`No open nudges for ${name}. They appear here when the record calls for a conversation.`}
            />
          ) : (
            <ul className="flex flex-col divide-y">
              {nudges.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StateBadge state={severityLabel[n.severity]} size="sm" />
                      <span className="text-sm font-medium">{n.title}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {n.detail}
                    </p>
                    {n.basis && (
                      <p className="text-2xs text-muted-foreground">
                        Basis: {n.basis}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={n.href} />}
                    >
                      {n.actionLabel}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Dismiss: ${n.title}`}
                      title="Dismiss"
                      onClick={() => {
                        actions.dismissNudge(n.id)
                        toast.success("Nudge dismissed", {
                          description: n.title,
                        })
                      }}
                    >
                      <XIcon />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block
          title="Next 1:1"
          action={
            <TabLink person={person} tab="meetings">
              All 1:1s
            </TabLink>
          }
        >
          {next ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="font-heading text-base font-semibold tracking-tight">
                  {formatWhen(next.scheduledAt)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {meetingTypeLabels[next.type]},{" "}
                  {formatMinutes(next.durationMin)}
                  {next.agenda.length > 0 &&
                    `, ${plural(next.agenda.length, "agenda item")}`}
                </p>
              </div>
              <Button
                size="sm"
                className="self-start"
                render={<Link href={`/meetings/session?id=${next.id}`} />}
              >
                Open <ArrowRightIcon />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Nothing scheduled.
                {health.lastHeldDay &&
                  ` The last 1:1 was ${dayDistance(health.lastHeldDay)}.`}
              </p>
              <Button
                size="sm"
                className="self-start"
                disabled={archived}
                onClick={() => setScheduling(true)}
              >
                <CalendarPlusIcon /> Schedule 1:1
              </Button>
            </div>
          )}
        </Block>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricTile
          label="You follow through"
          value={mine.rate ?? "n/a"}
          unit={mine.rate === null ? undefined : "%"}
          hint={`${mine.done} done, ${mine.missed} overdue`}
        />
        <MetricTile
          label={`${name} follows through`}
          value={theirs.rate ?? "n/a"}
          unit={theirs.rate === null ? undefined : "%"}
          hint={`${theirs.done} done, ${theirs.missed} overdue`}
        />
        <MetricTile
          label="1:1s held"
          value={health.heldRate ?? "n/a"}
          unit={health.heldRate === null ? undefined : "%"}
          hint={
            health.recentCancellations
              ? `${plural(health.recentCancellations, "recent cancellation")}`
              : "Of the last eight slots"
          }
        />
        <MetricTile
          label="Since last 1:1"
          value={health.daysSinceLast ?? "n/a"}
          unit={
            health.daysSinceLast === undefined
              ? undefined
              : health.daysSinceLast === 1
                ? "day"
                : "days"
          }
          tone={health.state === "overdue" ? "danger" : undefined}
          hint={`Planned every ${health.expectedDays} days`}
        />
        <MetricTile
          label="Energy"
          value={pulse.energy ?? "n/a"}
          unit={pulse.energy === null ? undefined : "/ 5"}
          tone={
            pulse.energy !== null && pulse.energy <= LOW_ENERGY_THRESHOLD
              ? "warning"
              : undefined
          }
          hint={
            pulse.count
              ? `Average of last ${Math.min(pulse.count, PULSE_WINDOW)} pulses`
              : "No pulse logged yet"
          }
        />
        <MetricTile
          label="Workload"
          value={pulse.workload ?? "n/a"}
          unit={pulse.workload === null ? undefined : "/ 5"}
          tone={
            pulse.workload !== null && pulse.workload >= HIGH_WORKLOAD_THRESHOLD
              ? "warning"
              : undefined
          }
          hint={
            <Link href={`/people/profile?id=${person.id}&tab=wellbeing`}>
              Self-reported. See wellbeing
            </Link>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block
          title="Open commitments"
          description={
            open.length
              ? `You owe ${mine.open}, ${name} owes ${theirs.open}`
              : undefined
          }
          action={
            <TabLink person={person} tab="commitments">
              All commitments
            </TabLink>
          }
        >
          {open.length === 0 ? (
            <EmptyState
              bare
              size="sm"
              title="Nothing open"
              description="Commitments either of you make in a 1:1 show up here until they are done."
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {open.slice(0, TOP).map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <StateBadge
                    state={c.owner === "manager" ? "You owe" : "They owe"}
                    size="sm"
                    dot={false}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{c.text}</p>
                    <p
                      className={cn(
                        "text-xs text-muted-foreground",
                        isOverdue(c) &&
                          cn("font-medium", toneClasses.danger.text)
                      )}
                    >
                      {c.dueDate
                        ? `${isOverdue(c) ? "Overdue, was due" : "Due"} ${formatDay(c.dueDate)}`
                        : "No due date"}
                    </p>
                  </div>
                </li>
              ))}
              {open.length > TOP && (
                <li className="text-xs text-muted-foreground">
                  and {open.length - TOP} more
                </li>
              )}
            </ul>
          )}
        </Block>

        <Block
          title="Active goals"
          action={
            <TabLink person={person} tab="goals">
              All goals
            </TabLink>
          }
        >
          {goals.length === 0 ? (
            <EmptyState
              bare
              size="sm"
              title="No active goals"
              description={`Add a goal to tie ${name}'s day-to-day work to an outcome for the quarter.`}
            />
          ) : (
            <ul className="flex flex-col gap-3.5">
              {goals.slice(0, TOP).map((g) => (
                <li key={g.id} className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm leading-snug font-medium">
                      {g.title}
                    </p>
                    <StateBadge state={goalStatusLabels[g.status]} size="sm" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Progress
                      value={g.progress}
                      aria-label={`Progress on ${g.title}`}
                      className="flex-1"
                    />
                    <span className="w-9 text-right text-xs tabular-nums">
                      {g.progress}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {g.readiness}: lead by{" "}
                    {readinessLabels[g.readiness].style.toLowerCase()}
                  </p>
                </li>
              ))}
              {goals.length > TOP && (
                <li className="text-xs text-muted-foreground">
                  and {goals.length - TOP} more
                </li>
              )}
            </ul>
          )}
        </Block>

        <Block
          title="Open blockers"
          action={
            <TabLink person={person} tab="blockers">
              All blockers
            </TabLink>
          }
        >
          {blockers.length === 0 ? (
            <EmptyState
              bare
              size="sm"
              title="No open blockers"
              description={`When ${name} raises something that is in the way, log it so repeats are counted.`}
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {blockers.slice(0, TOP).map((b) => {
                const recurring =
                  b.occurrences.length >= BLOCKER_RECURRENCE_TRIGGER
                return (
                  <li key={b.id} className="flex items-start gap-2.5">
                    <StatusDot
                      tone={recurring ? "danger" : "warning"}
                      className="mt-1.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{b.title}</p>
                      <p
                        className={cn(
                          "text-xs text-muted-foreground",
                          recurring &&
                            cn("font-medium", toneClasses.danger.text)
                        )}
                      >
                        Raised {plural(b.occurrences.length, "time")}
                        {b.status === "escalated" && b.escalatedTo
                          ? `, escalated to ${b.escalatedTo}`
                          : ""}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Block>

        <Block
          title="Where they are headed"
          action={
            <TabLink person={person} tab="career">
              Career
            </TabLink>
          }
        >
          {aspiration ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm leading-relaxed">{aspiration.statement}</p>
              <p className="text-xs text-muted-foreground">
                {careerTrackLabels[aspiration.track]}
                {aspiration.targetRole &&
                  `, aiming for ${aspiration.targetRole}`}
                . Recorded {formatDay(aspiration.validFrom)}.
              </p>
            </div>
          ) : (
            <EmptyState
              bare
              size="sm"
              title="No aspiration recorded"
              description={`Ask ${name} where they want to be in a year or two and record it on the Career tab.`}
            />
          )}
        </Block>
      </div>

      <Block
        title={`How ${name} likes to work`}
        action={
          <TabLink person={person} tab="feedback">
            Feedback
          </TabLink>
        }
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Recognition</dt>
            <dd className="mt-0.5 text-sm">
              {recognitionLabels[person.recognitionPref]}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Feedback</dt>
            <dd
              className={cn(
                "mt-0.5 text-sm whitespace-pre-line",
                !person.feedbackStyle && "text-muted-foreground"
              )}
            >
              {person.feedbackStyle ??
                "Not recorded yet. Ask, then add it under Edit details."}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Rapport notes <StateBadge state="Private" size="sm" />
            </dt>
            <dd
              className={cn(
                "mt-0.5 text-sm whitespace-pre-line",
                !person.rapportNotes && "text-muted-foreground"
              )}
            >
              {person.rapportNotes ?? "None yet."}
            </dd>
          </div>
        </dl>
      </Block>

      <ScheduleMeetingDialog
        open={scheduling}
        onOpenChange={setScheduling}
        personId={person.id}
      />
    </div>
  )
}
