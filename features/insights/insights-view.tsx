"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarIcon, ShieldCheckIcon, UsersIcon } from "lucide-react"

import { ChartCard } from "@/components/charts/chart-card"
import { CHART_HEIGHT, ChartEmpty } from "@/components/charts/chart-primitives"
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart"
import { StackedBarChart } from "@/components/charts/stacked-bar-chart"
import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader, Section } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PersonChip } from "@/features/shared/person"
import { useQueryParam } from "@/hooks/use-query-param"
import {
  blockerCategoryLabels,
  CAREER_GAP_DAYS,
  FEEDBACK_GAP_DAYS,
  pulseEnergyLabels,
  pulseWorkloadLabels,
} from "@/lib/constants"
import { formatDay, formatPercent, plural } from "@/lib/format"
import { cadenceStateLabels } from "@/lib/vantage/cadence"
import { workspace } from "@/lib/vantage/store"

import {
  CadenceLegend,
  CadenceStrip,
  GroupedColumnChart,
  GroupedRowChart,
  PulseHeatGrid,
  SegmentBar,
  ThresholdBars,
  TrendLineChart,
  type PulseMetric,
} from "./charts"
import { buildInsights, CADENCE_SLOTS } from "./insights-data"
import { insightPeriods, resolveInsightPeriod } from "./period"

const C1 = "var(--chart-1)"
const C2 = "var(--chart-2)"
const C3 = "var(--chart-3)"

function rate(value: number | null) {
  return value === null ? "n/a" : formatPercent(value)
}

function score(value: number | null) {
  return value === null ? "n/a" : value.toFixed(1)
}

function InsightPeriodSelect({ value }: { value: string }) {
  const [, setPeriod] = useQueryParam("period")
  const items = insightPeriods.map((p) => ({ value: p.value, label: p.label }))
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => setPeriod(String(next))}
    >
      <SelectTrigger aria-label="Reporting period" className="min-w-40">
        <CalendarIcon className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {items.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function InsightsView() {
  const ws = workspace.use()
  const [rawPeriod] = useQueryParam("period")
  const period = resolveInsightPeriod(rawPeriod)
  const [metric, setMetric] = React.useState<PulseMetric>("workload")
  const data = React.useMemo(
    () => buildInsights(ws, period.days),
    [ws, period.days]
  )
  const aggregateOnly = ws.settings.worksCouncilMode
  const span = `${formatDay(data.from)} to ${formatDay(data.to)}`

  const header = (
    <PageHeader
      nav="/insights"
      description="Progress and drift across your team over time. Counts and dates from the record, never a rating of a person."
      actions={<InsightPeriodSelect value={period.value} />}
    />
  )

  if (data.people.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState
          icon={<UsersIcon />}
          title="No team to chart yet"
          description="Add the people who report to you. Insights fill in as you hold 1:1s and keep the record."
          action={
            <Button nativeButton={false} render={<Link href="/people?new=1" />}>
              Add a person
            </Button>
          }
        />
      </div>
    )
  }

  const { kpis } = data
  const blockerTotal =
    data.blockerStatus.open +
    data.blockerStatus.escalated +
    data.blockerStatus.resolved

  return (
    <div className="flex flex-col gap-8">
      {header}

      {aggregateOnly && (
        <div
          role="note"
          data-testid="works-council-note"
          className="flex items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3"
        >
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              Works council mode is on.
            </span>{" "}
            Breakdowns by person are hidden and every chart shows the team as a
            whole. You can change this in{" "}
            <Link href="/settings" className="underline underline-offset-4">
              Settings
            </Link>
            .
          </p>
        </div>
      )}

      <StatGrid columns={6}>
        <StatCard
          label="1:1s held"
          value={rate(kpis.heldRate)}
          hint={
            kpis.heldRate === null
              ? "No 1:1s in this period"
              : `${kpis.held} held, ${kpis.cancelled} cancelled`
          }
        />
        <StatCard
          label="Your follow-through"
          value={rate(kpis.manager.rate)}
          hint={`${kpis.manager.done} kept, ${kpis.manager.missed} past due`}
        />
        <StatCard
          label="Their follow-through"
          value={rate(kpis.report.rate)}
          hint={`${kpis.report.done} kept, ${kpis.report.missed} past due`}
        />
        <StatCard
          label="Open blockers"
          value={kpis.openBlockers}
          hint="Open or escalated right now"
        />
        <StatCard
          label="Average energy"
          value={score(kpis.energy)}
          unit={kpis.energy === null ? undefined : "/ 5"}
          hint={
            kpis.peopleWithPulses
              ? `Recent pulses from ${plural(kpis.peopleWithPulses, "person", "people")}`
              : "No pulses shared"
          }
        />
        <StatCard
          label="Average workload"
          value={score(kpis.workload)}
          unit={kpis.workload === null ? undefined : "/ 5"}
          hint={
            kpis.peopleWithPulses
              ? `Recent pulses from ${plural(kpis.peopleWithPulses, "person", "people")}`
              : "No pulses shared"
          }
        />
      </StatGrid>

      {/* ------------------------------------------------------- cadence */}
      <Section
        id="cadence"
        title="Cadence health"
        description={`Whether the conversations are happening, ${span}.`}
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {!aggregateOnly && (
            <ChartCard
              title={`Last ${CADENCE_SLOTS} 1:1 slots for each person`}
              description="Oldest on the left. A cancelled slot is drawn at half height."
              footer={<CadenceLegend />}
            >
              <ul
                className="flex flex-col divide-y"
                data-testid="cadence-by-person"
              >
                {data.cadence.map((row) => (
                  <li
                    key={row.person.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-2.5 first:pt-0 last:pb-0 md:grid-cols-[10rem_minmax(0,1fr)_auto]"
                  >
                    <PersonChip personId={row.person.id} size="sm" />
                    <div className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto">
                      <CadenceStrip row={row} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StateBadge
                        state={cadenceStateLabels[row.health.state]}
                        tone={
                          row.health.state === "overdue" ? "danger" : undefined
                        }
                        size="sm"
                      />
                      <span className="text-2xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {row.health.daysSinceLast === undefined
                          ? "No 1:1 held yet"
                          : `${plural(row.health.daysSinceLast, "day")} since last`}
                        {row.cancelled > 0 && `, ${row.cancelled} cancelled`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </ChartCard>
          )}
          <ChartCard
            title="1:1s held and cancelled per week"
            description="Every person on the team, by the week the 1:1 was scheduled."
            className={aggregateOnly ? "xl:col-span-2" : undefined}
          >
            {kpis.held + kpis.cancelled === 0 ? (
              <ChartEmpty
                title="No 1:1s in this period"
                description="Held and cancelled conversations show up here week by week."
              />
            ) : (
              <StackedBarChart
                data={data.heldPerWeek}
                series={[
                  { key: "held", label: "Held", color: C1 },
                  { key: "cancelled", label: "Cancelled", color: C2 },
                ]}
                height={CHART_HEIGHT.md}
              />
            )}
          </ChartCard>
        </div>
      </Section>

      {/* --------------------------------------------------- commitments */}
      <Section
        id="commitments"
        title="Commitments"
        description="Follow-through is the share kept out of everything that has come due, for commitments live in the period."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {!aggregateOnly && (
            <ChartCard
              title="Follow-through by person, you and them"
              description="A missing bar means nothing has come due on that side."
              className="xl:row-span-2"
            >
              <div data-testid="follow-by-person">
                <GroupedRowChart
                  data={data.followByPerson}
                  series={[
                    { key: "you", label: "You", color: C1 },
                    { key: "them", label: "Them", color: C2 },
                  ]}
                  emptyDescription="Rates appear once a commitment reaches its due date."
                />
              </div>
            </ChartCard>
          )}
          <ChartCard
            title="Open commitments: on time against overdue"
            description="What is still open on each side right now."
          >
            {data.openVsOverdue.every((r) => r.onTime + r.overdue === 0) ? (
              <ChartEmpty
                height={CHART_HEIGHT.sm}
                title="Nothing open"
                description="Open commitments on either side show up here."
              />
            ) : (
              <StackedBarChart
                data={data.openVsOverdue}
                series={[
                  { key: "onTime", label: "On time", color: C1 },
                  { key: "overdue", label: "Overdue", color: C2 },
                ]}
                height={CHART_HEIGHT.sm}
                maxBarSize={56}
              />
            )}
          </ChartCard>
          <ChartCard
            title="Commitments made and kept per week"
            description="Both sides together. Kept counts the week a commitment was marked done."
          >
            <GroupedColumnChart
              data={data.commitmentsPerWeek}
              series={[
                { key: "created", label: "Made", color: C1 },
                { key: "closed", label: "Kept", color: C2 },
              ]}
              height={CHART_HEIGHT.sm}
              emptyDescription="No commitments were made or kept in this period."
            />
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------ blockers */}
      <Section
        id="blockers"
        title="Blockers"
        description="Where friction keeps coming from, counted by how often it was raised."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            title="Times a blocker was raised, by category"
            description={`Every mention in a 1:1, ${span}.`}
          >
            {data.blockerCategories.length === 0 ? (
              <ChartEmpty
                height={CHART_HEIGHT.sm}
                title="No blockers raised"
                description={`Categories such as ${blockerCategoryLabels["cross-team"].toLowerCase()} or ${blockerCategoryLabels.tooling.toLowerCase()} show up here.`}
              />
            ) : (
              <HorizontalBarChart
                data={data.blockerCategories}
                label="Times raised"
                labelWidth={156}
              />
            )}
          </ChartCard>
          <ChartCard
            title="Blockers resolved against still open"
            description="Blockers raised or changed in the period, by where they stand now."
          >
            {blockerTotal === 0 ? (
              <ChartEmpty
                height={CHART_HEIGHT.sm}
                title="No blockers in this period"
              />
            ) : (
              <SegmentBar
                segments={[
                  {
                    label: "Resolved",
                    value: data.blockerStatus.resolved,
                    color: C1,
                  },
                  {
                    label: "Still open",
                    value: data.blockerStatus.open,
                    color: C2,
                  },
                  {
                    label: "Escalated",
                    value: data.blockerStatus.escalated,
                    color: C3,
                  },
                ]}
              />
            )}
          </ChartCard>
          {!aggregateOnly && (
            <ChartCard
              title="Most repeated open blockers"
              description="Raised more than once and not yet resolved."
              className="xl:col-span-2"
            >
              {data.rankedBlockers.length === 0 ? (
                <EmptyState
                  size="sm"
                  bare
                  title="No repeated blockers"
                  description="A blocker raised more than once is listed here until it is resolved."
                />
              ) : (
                <ol
                  className="flex flex-col divide-y"
                  data-testid="ranked-blockers"
                >
                  {data.rankedBlockers.map(({ blocker, person, count }, i) => (
                    <li
                      key={blocker.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span className="w-4 text-xs text-muted-foreground tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 basis-56">
                        <Link
                          href={`/people/profile?id=${blocker.personId}&tab=blockers`}
                          className="text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {blocker.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {blockerCategoryLabels[blocker.category]}
                          {blocker.status === "escalated" &&
                            blocker.escalatedTo &&
                            `, escalated to ${blocker.escalatedTo}`}
                        </p>
                      </div>
                      {person && <PersonChip personId={person.id} size="xs" />}
                      {blocker.status === "escalated" && (
                        <StateBadge state="Escalated" size="sm" />
                      )}
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CountPill count={count} size="default" />
                        times raised
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </ChartCard>
          )}
        </div>
      </Section>

      {/* ------------------------------------------------------ workload */}
      <Section
        id="workload"
        title="Workload"
        description="From voluntary 1 to 5 pulses only: numbers people chose to share in a 1:1. Nothing here is inferred."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {!aggregateOnly && (
            <ChartCard
              title={
                metric === "workload"
                  ? "Workload pulse by person and week"
                  : "Energy pulse by person and week"
              }
              description="Weekly average of the pulses each person shared. A stronger tint is a higher number."
              action={
                <ToggleGroup
                  aria-label="Pulse measure"
                  variant="outline"
                  size="sm"
                  spacing={0}
                  value={[metric]}
                  onValueChange={(next) => {
                    const picked = next[0] as PulseMetric | undefined
                    if (picked) setMetric(picked)
                  }}
                >
                  <ToggleGroupItem value="workload">Workload</ToggleGroupItem>
                  <ToggleGroupItem value="energy">Energy</ToggleGroupItem>
                </ToggleGroup>
              }
            >
              {data.heat.length === 0 ? (
                <ChartEmpty
                  title="No pulses shared"
                  description="When someone shares a pulse in a 1:1, their weeks fill in here."
                />
              ) : (
                <div data-testid="pulse-heat">
                  <PulseHeatGrid
                    rows={data.heat}
                    weeks={data.weeks}
                    metric={metric}
                    color={metric === "workload" ? C1 : C2}
                    scaleLabels={
                      metric === "workload"
                        ? [pulseWorkloadLabels[0], pulseWorkloadLabels[4]]
                        : [pulseEnergyLabels[0], pulseEnergyLabels[4]]
                    }
                  />
                </div>
              )}
            </ChartCard>
          )}
          <ChartCard
            title="Team average energy and workload per week"
            description={`Both on the same 1 to 5 scale, from ${plural(data.pulseCount, "pulse")}.`}
            className={aggregateOnly ? "xl:col-span-2" : undefined}
          >
            <TrendLineChart
              data={data.pulseTrend}
              series={[
                { key: "workload", label: "Workload", color: C1 },
                { key: "energy", label: "Energy", color: C2 },
              ]}
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              emptyDescription="Team averages appear once pulses are shared."
            />
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------ feedback */}
      <Section
        id="feedback"
        title="Feedback rhythm"
        description="How regularly you give feedback, and the balance between recognition and developmental."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            title="Recognition and developmental feedback per week"
            description="Feedback you gave, by the week it was delivered or observed."
            className={aggregateOnly ? "xl:col-span-2" : undefined}
          >
            {data.feedbackCount === 0 ? (
              <ChartEmpty
                title="No feedback in this period"
                description="Feedback you write shows up here week by week."
              />
            ) : (
              <StackedBarChart
                data={data.feedbackPerWeek}
                series={[
                  { key: "recognition", label: "Recognition", color: C1 },
                  { key: "developmental", label: "Developmental", color: C2 },
                ]}
                height={CHART_HEIGHT.md}
              />
            )}
          </ChartCard>
          {!aggregateOnly && (
            <ChartCard
              title="Days since you last gave each person feedback"
              description={`A reminder appears after ${FEEDBACK_GAP_DAYS} days without any.`}
            >
              <div data-testid="feedback-gaps">
                <ThresholdBars
                  rows={data.feedbackGaps}
                  threshold={FEEDBACK_GAP_DAYS}
                  noRecordLabel="counted from their start date"
                />
              </div>
            </ChartCard>
          )}
        </div>
      </Section>

      {/* -------------------------------------------------------- growth */}
      <Section
        id="growth"
        title="Growth"
        description="Career conversations, milestones and goals."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {!aggregateOnly && (
            <ChartCard
              title="Days since the last career conversation"
              description={`One is suggested after ${CAREER_GAP_DAYS} days.`}
              className="xl:row-span-2"
            >
              <div data-testid="career-gaps">
                <ThresholdBars
                  rows={data.careerGaps}
                  threshold={CAREER_GAP_DAYS}
                  noRecordLabel="counted from their start date"
                />
              </div>
            </ChartCard>
          )}
          <ChartCard
            title="Goals by status"
            description="Goals in force during the period, by where they stand now."
          >
            {data.goalsByStatus.length === 0 ? (
              <ChartEmpty
                height={CHART_HEIGHT.sm}
                title="No goals yet"
                description="Goals you set with your people are counted here."
              />
            ) : (
              <HorizontalBarChart
                data={data.goalsByStatus}
                label="Goals"
                labelWidth={84}
              />
            )}
          </ChartCard>
          <ChartCard
            title="Milestones demonstrated in the period"
            description={`${plural(data.milestones.length, "milestone")} marked as demonstrated, ${span}.`}
          >
            {data.milestones.length === 0 ? (
              <EmptyState
                size="sm"
                bare
                title="None in this period"
                description="A milestone counts once you mark it demonstrated on a person's career tab."
              />
            ) : aggregateOnly ? (
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {data.milestones.length}
              </p>
            ) : (
              <ul className="flex flex-col divide-y" data-testid="milestones">
                {data.milestones.slice(0, 6).map(({ milestone, day }) => (
                  <li
                    key={milestone.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 flex-1 basis-48 text-sm">
                      {milestone.title}
                    </span>
                    <PersonChip personId={milestone.personId} size="xs" />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDay(day)}
                    </span>
                  </li>
                ))}
                {data.milestones.length > 6 && (
                  <li className="pt-2 text-xs text-muted-foreground">
                    And {data.milestones.length - 6} more.
                  </li>
                )}
              </ul>
            )}
          </ChartCard>
        </div>
      </Section>
    </div>
  )
}
