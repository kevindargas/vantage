"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import { cn } from "cn"

import {
  CHART_HEIGHT,
  CHART_MARGIN,
  ChartEmpty,
  Y_AXIS_WIDTH,
  axisTick,
  barCursor,
  gridStroke,
  lineCursor,
} from "@/components/charts/chart-primitives"
import { StateBadge } from "@/components/shared/status-badge"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { PersonChip } from "@/features/shared/person"
import { formatDay, plural } from "@/lib/format"

import type { CadenceRow, GapRow, HeatRow, WeekBucket } from "./insights-data"

export interface Series {
  key: string
  label: string
  color: string
}

function toConfig(series: Series[]): ChartConfig {
  return Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }])
  )
}

const legend = (
  <ChartLegend
    verticalAlign="top"
    align="right"
    content={
      <ChartLegendContent className="justify-end pt-0 pb-2 text-xs text-muted-foreground" />
    }
  />
)

/** Side by side columns per category, for measures that are not parts of a whole. */
export function GroupedColumnChart({
  data,
  series,
  height = CHART_HEIGHT.md,
  emptyDescription,
}: {
  data: Record<string, string | number>[]
  series: Series[]
  height?: number
  emptyDescription?: string
}) {
  const total = data.reduce(
    (sum, row) => sum + series.reduce((s, x) => s + Number(row[x.key] ?? 0), 0),
    0
  )
  if (total === 0)
    return <ChartEmpty height={height} description={emptyDescription} />
  return (
    <ChartContainer
      config={toConfig(series)}
      className="aspect-auto w-full"
      style={{ height }}
    >
      <BarChart
        accessibilityLayer
        data={data}
        margin={CHART_MARGIN}
        barCategoryGap="24%"
        barGap={2}
      >
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tick={axisTick}
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={Y_AXIS_WIDTH}
          tickMargin={6}
          allowDecimals={false}
          tick={axisTick}
        />
        <ChartTooltip cursor={barCursor} content={<ChartTooltipContent />} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={`var(--color-${s.key})`}
            radius={[4, 4, 0, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
        ))}
        {legend}
      </BarChart>
    </ChartContainer>
  )
}

/** Two bars per row on a shared 0 to 100 scale. A missing value draws no bar. */
export function GroupedRowChart({
  data,
  series,
  labelWidth = 120,
  emptyDescription,
}: {
  data: Record<string, string | number | null>[]
  series: Series[]
  labelWidth?: number
  emptyDescription?: string
}) {
  const height = Math.max(120, data.length * 44 + 40)
  if (data.length === 0)
    return (
      <ChartEmpty height={CHART_HEIGHT.sm} description={emptyDescription} />
    )
  return (
    <ChartContainer
      config={toConfig(series)}
      className="aspect-auto w-full"
      style={{ height }}
    >
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 16, top: 2, bottom: 2 }}
        barCategoryGap={10}
        barGap={2}
      >
        <CartesianGrid horizontal={false} stroke={gridStroke} />
        <XAxis
          type="number"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickLine={false}
          axisLine={false}
          tick={axisTick}
          tickFormatter={(v: number) => `${v}%`}
        />
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          axisLine={false}
          width={labelWidth}
          tickMargin={8}
          tick={{ ...axisTick, fontSize: 12, fill: "var(--foreground)" }}
          interval={0}
        />
        <ChartTooltip
          cursor={barCursor}
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <>
                  <span
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{ background: item.color }}
                  />
                  <span className="flex-1 text-muted-foreground">
                    {series.find((s) => s.key === name)?.label ?? name}
                  </span>
                  <span className="font-medium text-foreground tabular-nums">
                    {Number(value)}%
                  </span>
                </>
              )}
            />
          }
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={`var(--color-${s.key})`}
            radius={[0, 4, 4, 0]}
            maxBarSize={12}
            isAnimationActive={false}
          />
        ))}
        {legend}
      </BarChart>
    </ChartContainer>
  )
}

/** Lines that share one fixed scale, e.g. two 1 to 5 pulse averages. */
export function TrendLineChart({
  data,
  series,
  domain,
  ticks,
  height = CHART_HEIGHT.md,
  emptyDescription,
}: {
  data: Record<string, string | number | null>[]
  series: Series[]
  domain: [number, number]
  ticks?: number[]
  height?: number
  emptyDescription?: string
}) {
  const hasData = data.some((row) =>
    series.some((s) => typeof row[s.key] === "number")
  )
  if (!hasData)
    return <ChartEmpty height={height} description={emptyDescription} />
  return (
    <ChartContainer
      config={toConfig(series)}
      className="aspect-auto w-full"
      style={{ height }}
    >
      <LineChart accessibilityLayer data={data} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tick={axisTick}
          minTickGap={16}
        />
        <YAxis
          domain={domain}
          ticks={ticks}
          tickLine={false}
          axisLine={false}
          width={Y_AXIS_WIDTH}
          tickMargin={6}
          tick={axisTick}
        />
        <ChartTooltip
          cursor={lineCursor}
          content={<ChartTooltipContent indicator="line" />}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            dot={{ r: 2.5, strokeWidth: 0, fill: `var(--color-${s.key})` }}
            activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
        {legend}
      </LineChart>
    </ChartContainer>
  )
}

/* ------------------------------------------------------------ cadence strip */

const slotLabel = { held: "Held", cancelled: "Cancelled", none: "No 1:1" }

/** The last few 1:1 slots for one person. Cancelled slots are shorter, so the strip reads without colour. */
export function CadenceStrip({ row }: { row: CadenceRow }) {
  return (
    <div
      role="img"
      aria-label={`${row.held} held and ${row.cancelled} cancelled in the last ${plural(row.held + row.cancelled, "slot")}`}
      className="flex h-6 w-full items-end gap-0.5"
    >
      {row.slots.map((slot) => (
        <span
          key={slot.key}
          title={
            slot.day
              ? `${formatDay(slot.day)}: ${slotLabel[slot.status]}`
              : slotLabel[slot.status]
          }
          className={cn(
            "flex-1 rounded-[2px]",
            slot.status === "held" && "h-full bg-success",
            slot.status === "cancelled" && "h-1/2 bg-destructive",
            slot.status === "none" && "h-full bg-muted"
          )}
        />
      ))}
    </div>
  )
}

export function CadenceLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-1.5 rounded-[2px] bg-success" /> Held
      </li>
      <li className="flex items-end gap-1.5">
        <span className="h-1.5 w-1.5 rounded-[2px] bg-destructive" /> Cancelled
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-1.5 rounded-[2px] bg-muted" /> No 1:1 on record
      </li>
    </ul>
  )
}

/* ---------------------------------------------------------- threshold bars */

/** Days per person against a limit. The limit is a tick on every track. */
export function ThresholdBars({
  rows,
  threshold,
  noRecordLabel,
}: {
  rows: GapRow[]
  threshold: number
  /** Shown when the count runs from the start date because nothing is on the record. */
  noRecordLabel: string
}) {
  const max = Math.max(threshold * 1.5, ...rows.map((r) => r.days))
  const mark = (threshold / max) * 100
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const over = row.days >= threshold
          return (
            <li
              key={row.person.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
              title={`${row.person.name}: ${plural(row.days, "day")}${row.hasRecord ? "" : `, ${noRecordLabel}`}`}
            >
              <PersonChip personId={row.person.id} size="xs" />
              <div className="relative col-span-2 row-start-2 h-2 rounded-full bg-muted sm:col-span-1 sm:row-start-auto">
                <div
                  className="h-full rounded-full bg-chart-1"
                  style={{ width: `${Math.max(1, (row.days / max) * 100)}%` }}
                />
                <span
                  aria-hidden
                  className="absolute -top-1 -bottom-1 w-px bg-foreground/60"
                  style={{ left: `${mark}%` }}
                />
              </div>
              <div className="flex items-center justify-end gap-1.5 text-xs tabular-nums sm:min-w-28">
                {over && (
                  <StateBadge
                    state="Past limit"
                    tone="warning"
                    size="sm"
                    dot={false}
                  />
                )}
                <span className="font-medium">{plural(row.days, "day")}</span>
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-2xs text-muted-foreground">
        The tick on each bar marks {threshold} days.
      </p>
    </div>
  )
}

/* --------------------------------------------------------------- heat grid */

export type PulseMetric = "workload" | "energy"

/** One hue, five steps: a higher value is a stronger tint. The number is always printed. */
function tint(value: number, color: string) {
  const step = Math.min(5, Math.max(1, value))
  return `color-mix(in oklch, ${color} ${Math.round(step * 12)}%, transparent)`
}

export function PulseHeatGrid({
  rows: allRows,
  weeks: allWeeks,
  metric,
  color,
  scaleLabels,
}: {
  rows: HeatRow[]
  weeks: WeekBucket[]
  metric: PulseMetric
  color: string
  /** Labels for 1 and 5. */
  scaleLabels: [string, string]
}) {
  // Weeks before the first shared pulse carry nothing, so the grid starts there.
  const first = Math.max(
    0,
    allWeeks.findIndex((_, i) => allRows.some((row) => row.cells[i]))
  )
  const weeks = allWeeks.slice(first)
  const rows = allRows.map((row) => ({ ...row, cells: row.cells.slice(first) }))
  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-x-auto">
        <table
          aria-label={`Average ${metric} from voluntary pulses, by person and week, on a 1 to 5 scale`}
          className="w-full border-separate border-spacing-0.5 text-xs"
        >
          <thead>
            <tr>
              <th scope="col" aria-label="Person"></th>
              {weeks.map((w) => (
                <th
                  key={w.start}
                  scope="col"
                  className="min-w-9 px-0.5 pb-1 text-center text-3xs font-normal whitespace-nowrap text-muted-foreground"
                >
                  {w.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.person.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 max-w-36 min-w-32 bg-card pr-2 text-left font-normal"
                >
                  <PersonChip personId={row.person.id} size="xs" />
                </th>
                {row.cells.map((cell, i) => (
                  <td
                    key={weeks[i].start}
                    aria-label={cell ? undefined : "No pulse shared"}
                    title={
                      cell
                        ? `${row.person.name}, week of ${weeks[i].label}: ${metric} ${cell[metric]} of 5`
                        : `${row.person.name}, week of ${weeks[i].label}: no pulse shared`
                    }
                    className={cn(
                      "h-8 rounded-[3px] text-center font-medium tabular-nums",
                      !cell && "bg-muted/40 text-muted-foreground/60"
                    )}
                    style={
                      cell
                        ? { backgroundColor: tint(cell[metric], color) }
                        : undefined
                    }
                  >
                    {cell ? cell[metric] : <span aria-hidden>·</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-2xs text-muted-foreground">
        <span>1, {scaleLabels[0]}</span>
        <span className="flex gap-0.5" aria-hidden>
          {[1, 2, 3, 4, 5].map((v) => (
            <span
              key={v}
              className="size-3 rounded-[2px]"
              style={{ backgroundColor: tint(v, color) }}
            />
          ))}
        </span>
        <span>5, {scaleLabels[1]}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- segment bar */

/** One bar split into labelled parts, with the counts printed underneath. */
export function SegmentBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[]
}) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={segments.map((s) => `${s.value} ${s.label}`).join(", ")}
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
      >
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span
              key={s.label}
              title={`${s.label}: ${s.value}`}
              className="h-full"
              style={{
                width: `${(s.value / total) * 100}%`,
                backgroundColor: s.color,
              }}
            />
          ))}
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 rounded-[2px]"
              style={{ backgroundColor: s.color }}
            />
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
