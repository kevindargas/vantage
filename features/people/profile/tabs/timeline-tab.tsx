"use client"

import * as React from "react"
import { cn } from "cn"
import {
  AnchorIcon,
  CalendarIcon,
  GaugeIcon,
  HandshakeIcon,
  HistoryIcon,
  MessageSquareTextIcon,
  OctagonAlertIcon,
  TargetIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { Section } from "@/components/shared/page-header"
import {
  StateBadge,
  toneClasses,
  type Tone,
} from "@/components/shared/status-badge"
import { useQueryParam } from "@/hooks/use-query-param"
import {
  blockerCategoryLabels,
  careerTrackLabels,
  goalStatusLabels,
  milestoneKindLabels,
  milestoneStatusLabels,
  stayDriverLabels,
} from "@/lib/constants"
import { firstName, formatDay, plural } from "@/lib/format"
import { addDays, today } from "@/lib/time"
import type { BlockerStatus, MilestoneStatus, Person } from "@/lib/types"
import {
  snapshotAsOf,
  timelineFor,
  type Snapshot,
  type TimelineEvent,
  type TimelinePillar,
} from "@/lib/vantage/selectors"
import { workspace } from "@/lib/vantage/store"
import { SourceLink } from "./parts/common"

const pillars: Record<
  TimelinePillar,
  { label: string; tone: Tone; icon: LucideIcon }
> = {
  meeting: { label: "1:1s", tone: "muted", icon: CalendarIcon },
  commitment: { label: "Commitments", tone: "neutral", icon: HandshakeIcon },
  goal: { label: "Goals", tone: "info", icon: TargetIcon },
  blocker: { label: "Blockers", tone: "danger", icon: OctagonAlertIcon },
  feedback: { label: "Feedback", tone: "success", icon: MessageSquareTextIcon },
  career: { label: "Career", tone: "brand", icon: TrendingUpIcon },
  workload: { label: "Workload", tone: "warning", icon: GaugeIcon },
  retention: { label: "Retention", tone: "progress", icon: AnchorIcon },
}
const pillarKeys = Object.keys(pillars) as TimelinePillar[]

const blockerStatusLabels: Record<BlockerStatus, string> = {
  open: "Open",
  escalated: "Escalated",
  resolved: "Resolved",
}
const milestoneTone: Record<MilestoneStatus, Tone> = {
  planned: "muted",
  "in-progress": "progress",
  demonstrated: "success",
}
const JUMPS = [30, 90, 180] as const
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** The longitudinal record: every dated change, and the record as of any day. */
export function TimelineTab({ person }: { person: Person }) {
  const ws = workspace.use()
  const [asofParam, setAsof] = useQueryParam("asof")
  const [filter, setFilter] = React.useState<TimelinePillar | "all">("all")
  const now = today()
  const name = firstName(person.name)

  const day =
    asofParam && DAY_PATTERN.test(asofParam) && asofParam < now
      ? asofParam
      : now
  const past = day < now
  const events = timelineFor(ws, person.id)
  const counts = new Map<TimelinePillar, number>()
  for (const e of events) counts.set(e.pillar, (counts.get(e.pillar) ?? 0) + 1)
  const shown = events.filter((e) => filter === "all" || e.pillar === filter)
  const months = groupByMonth(shown)
  const jumps = JUMPS.map((n) => ({ n, day: addDays(now, -n) })).filter(
    (j) => j.day >= person.startDate
  )
  const later = past ? shown.filter((e) => e.date > day).length : 0

  return (
    <div className="flex flex-col gap-6">
      <Card size="sm">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timeline-asof">As of</Label>
            <Input
              id="timeline-asof"
              type="date"
              value={day}
              max={now}
              onChange={(e) => {
                const next = e.target.value
                setAsof(next && next < now ? next : null)
              }}
              className="w-full sm:w-44"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {jumps.map((j) => (
              <Button
                key={j.n}
                size="sm"
                variant={day === j.day ? "secondary" : "outline"}
                aria-pressed={day === j.day}
                onClick={() => setAsof(j.day)}
              >
                {j.n} days ago
              </Button>
            ))}
            {past && (
              <Button size="sm" variant="ghost" onClick={() => setAsof(null)}>
                Back to today
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {past && (
        <SnapshotPanel
          snapshot={snapshotAsOf(ws, person.id, day)}
          name={name}
          onReset={() => setAsof(null)}
        />
      )}

      <Section
        title="Timeline"
        count={events.length}
        description={
          past
            ? `Everything on ${name}'s record. ${
                later
                  ? `${plural(later, "event")} after ${formatDay(day)} ${later === 1 ? "is" : "are"} dimmed.`
                  : `Nothing was recorded after ${formatDay(day)}.`
              }`
            : `Every dated change on ${name}'s record, newest first.`
        }
      >
        {events.length === 0 ? (
          <EmptyState
            icon={<HistoryIcon />}
            title="Nothing on the record yet"
            description={`The timeline fills in as you hold 1:1s with ${name} and record commitments, goals, feedback and the rest.`}
          />
        ) : (
          <>
            <div
              role="group"
              aria-label="Filter by pillar"
              className="flex flex-wrap gap-1.5"
            >
              <FilterChip
                active={filter === "all"}
                onClick={() => setFilter("all")}
                label="All"
                count={events.length}
              />
              {pillarKeys.map((p) => (
                <FilterChip
                  key={p}
                  active={filter === p}
                  onClick={() => setFilter(p)}
                  label={pillars[p].label}
                  count={counts.get(p) ?? 0}
                  icon={pillars[p].icon}
                />
              ))}
            </div>
            {shown.length === 0 ? (
              <EmptyState
                size="sm"
                title={`No ${filter === "all" ? "" : pillars[filter].label.toLowerCase() + " "}events yet`}
                description="Pick another pillar to see the rest of the record."
              />
            ) : (
              <div className="flex flex-col gap-6">
                {months.map((month) => (
                  <section key={month.key} aria-label={month.label}>
                    <div className="flex items-center gap-2 py-1.5">
                      <Eyebrow as="h3">{month.label}</Eyebrow>
                      <CountPill count={month.events.length} />
                    </div>
                    <ol className="mt-1 flex flex-col">
                      {month.events.map((e) => (
                        <EventRow key={e.id} event={e} dimmed={e.date > day} />
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  )
}

function groupByMonth(events: TimelineEvent[]) {
  const months: { key: string; label: string; events: TimelineEvent[] }[] = []
  for (const e of events) {
    const key = e.date.slice(0, 7)
    const last = months[months.length - 1]
    if (last?.key === key) last.events.push(e)
    else
      months.push({
        key,
        label: formatDay(`${key}-01`, {
          month: "long",
          year: "numeric",
          day: undefined,
        }),
        events: [e],
      })
  }
  return months
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  icon?: LucideIcon
}) {
  return (
    <Button
      size="sm"
      variant={active ? "secondary" : "outline"}
      aria-pressed={active}
      onClick={onClick}
    >
      {Icon && <Icon data-icon="inline-start" />}
      {label}
      <CountPill count={count} tone={active ? "inverse" : "muted"} />
    </Button>
  )
}

function EventRow({
  event: e,
  dimmed,
}: {
  event: TimelineEvent
  dimmed: boolean
}) {
  const pillar = pillars[e.pillar]
  const Icon = pillar.icon
  return (
    <li
      data-after-asof={dimmed || undefined}
      className={cn(
        "group/event relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0",
        dimmed && "opacity-45"
      )}
    >
      <span
        aria-hidden
        className="absolute top-7 bottom-0 left-[0.84rem] w-px bg-border group-last/event:hidden"
      />
      <span
        role="img"
        aria-label={pillar.label}
        className={cn(
          "flex size-7 items-center justify-center rounded-full",
          toneClasses[pillar.tone].soft
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 space-y-0.5 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-sm font-medium">{e.title}</p>
          <time
            dateTime={e.date}
            className="text-xs text-muted-foreground tabular-nums"
          >
            {formatDay(e.date)}
          </time>
          {dimmed && (
            <span className="text-xs text-muted-foreground">
              After the chosen day
            </span>
          )}
        </div>
        {e.detail && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {e.detail}
          </p>
        )}
        <SourceLink meetingId={e.sourceMeetingId} />
      </div>
    </li>
  )
}

/* ---------------------------------------------------------------- snapshot */

function SnapshotPanel({
  snapshot,
  name,
  onReset,
}: {
  snapshot: Snapshot
  name: string
  onReset: () => void
}) {
  const empty =
    !snapshot.aspiration &&
    snapshot.goals.length +
      snapshot.blockers.length +
      snapshot.milestones.length +
      snapshot.stayDrivers.length +
      snapshot.openCommitments.length ===
      0
  return (
    <Card className="ring-brand/30">
      <CardHeader>
        <CardTitle>
          The record as it stood on {formatDay(snapshot.day)}
        </CardTitle>
        <CardDescription>
          What was in force for {name} on that day, with the status each item
          had then. Later changes are left out.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {empty ? (
          <EmptyState
            bare
            size="sm"
            icon={<HistoryIcon />}
            title="Nothing was on the record yet"
            description={`No aspiration, goal, blocker, milestone, stay driver or open commitment existed for ${name} on that day.`}
            action={
              <Button size="sm" variant="outline" onClick={onReset}>
                Back to today
              </Button>
            }
          />
        ) : (
          <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
            <SnapshotGroup title="Aspiration in force" count={null}>
              {snapshot.aspiration ? (
                <li className="space-y-0.5">
                  <p className="text-sm">{snapshot.aspiration.statement}</p>
                  <p className="text-xs text-muted-foreground">
                    {careerTrackLabels[snapshot.aspiration.track]}
                    {snapshot.aspiration.targetRole
                      ? `, toward ${snapshot.aspiration.targetRole}`
                      : ""}
                    , held since {formatDay(snapshot.aspiration.validFrom)}
                  </p>
                </li>
              ) : null}
            </SnapshotGroup>
            <SnapshotGroup title="Goals" count={snapshot.goals.length}>
              {snapshot.goals.map((g) => (
                <SnapshotItem key={g.id} text={g.title} meta={g.quarter}>
                  <StateBadge
                    size="sm"
                    state={goalStatusLabels[g.statusThen]}
                  />
                </SnapshotItem>
              ))}
            </SnapshotGroup>
            <SnapshotGroup title="Blockers" count={snapshot.blockers.length}>
              {snapshot.blockers.map((b) => (
                <SnapshotItem
                  key={b.id}
                  text={b.title}
                  meta={`${blockerCategoryLabels[b.category]}, raised ${plural(b.countThen, "time")} by then`}
                >
                  <StateBadge
                    size="sm"
                    state={blockerStatusLabels[b.statusThen]}
                  />
                </SnapshotItem>
              ))}
            </SnapshotGroup>
            <SnapshotGroup
              title="Milestones"
              count={snapshot.milestones.length}
            >
              {snapshot.milestones.map((m) => (
                <SnapshotItem
                  key={m.id}
                  text={m.title}
                  meta={milestoneKindLabels[m.kind]}
                >
                  <StateBadge
                    size="sm"
                    state={milestoneStatusLabels[m.statusThen]}
                    tone={milestoneTone[m.statusThen]}
                  />
                </SnapshotItem>
              ))}
            </SnapshotGroup>
            <SnapshotGroup
              title="Stay drivers in force"
              count={snapshot.stayDrivers.length}
            >
              {snapshot.stayDrivers.map((s) => (
                <SnapshotItem
                  key={s.id}
                  text={s.text}
                  meta={stayDriverLabels[s.kind]}
                />
              ))}
            </SnapshotGroup>
            <SnapshotGroup
              title="Commitments open then"
              count={snapshot.openCommitments.length}
            >
              {snapshot.openCommitments.map((c) => (
                <SnapshotItem
                  key={c.id}
                  text={c.text}
                  meta={
                    c.dueDate ? `Due ${formatDay(c.dueDate)}` : "No due date"
                  }
                >
                  <StateBadge
                    size="sm"
                    state={c.owner === "manager" ? "You owe" : "They owe"}
                  />
                </SnapshotItem>
              ))}
            </SnapshotGroup>
          </div>
        )}
        {!empty && (
          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={onReset}
          >
            Back to today
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function SnapshotGroup({
  title,
  count,
  children,
}: {
  title: string
  /** Null hides the count, for single-value groups. */
  count: number | null
  children: React.ReactNode
}) {
  const hasItems = React.Children.toArray(children).length > 0
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Eyebrow as="h3">{title}</Eyebrow>
        {count !== null && <CountPill count={count} />}
      </div>
      {hasItems ? (
        <ul className="flex flex-col gap-2">{children}</ul>
      ) : (
        <p className="text-xs text-muted-foreground">None on that day.</p>
      )}
    </div>
  )
}

function SnapshotItem({
  text,
  meta,
  children,
}: {
  text: string
  meta?: string
  children?: React.ReactNode
}) {
  return (
    <li className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm leading-snug">{text}</p>
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </li>
  )
}
