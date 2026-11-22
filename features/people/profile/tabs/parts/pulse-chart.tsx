"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  axisTick,
  CHART_HEIGHT,
  CHART_MARGIN,
  gridStroke,
  lineCursor,
  Y_AXIS_WIDTH,
} from "@/components/charts/chart-primitives"
import {
  HIGH_WORKLOAD_THRESHOLD,
  LOW_ENERGY_THRESHOLD,
  pulseEnergyLabels,
  pulseWorkloadLabels,
} from "@/lib/constants"
import { formatDay, formatDayLong } from "@/lib/format"
import type { Pulse } from "@/lib/types"

const config = {
  energy: { label: "Energy", color: "var(--chart-1)" },
  workload: { label: "Workload", color: "var(--chart-2)" },
} satisfies ChartConfig

const scaleLabels = {
  energy: pulseEnergyLabels,
  workload: pulseWorkloadLabels,
} as const

const thresholdLabel = {
  fill: "var(--muted-foreground)",
  fontSize: 10,
} as const

/**
 * Self-reported energy and workload on one fixed 1 to 5 axis. Dashed lines
 * mark the two check-in thresholds in the colour of the series they apply to.
 */
export function PulseChart({ pulses }: { pulses: Pulse[] }) {
  const data = pulses.map((p) => ({
    date: p.date,
    energy: p.energy,
    workload: p.workload,
  }))
  const dots = data.length <= 16
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: CHART_HEIGHT.md }}
    >
      <LineChart
        accessibilityLayer
        data={data}
        margin={{ ...CHART_MARGIN, right: 16 }}
      >
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={40}
          tick={axisTick}
          tickFormatter={(v: string) => formatDay(v)}
        />
        <YAxis
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={Y_AXIS_WIDTH}
          tickMargin={6}
          tick={axisTick}
        />
        <ReferenceLine
          y={HIGH_WORKLOAD_THRESHOLD}
          stroke="var(--color-workload)"
          strokeOpacity={0.6}
          strokeDasharray="4 4"
          label={{
            ...thresholdLabel,
            value: `Workload check-in line: ${HIGH_WORKLOAD_THRESHOLD}`,
            position: "insideTopLeft",
          }}
        />
        <ReferenceLine
          y={LOW_ENERGY_THRESHOLD}
          stroke="var(--color-energy)"
          strokeOpacity={0.6}
          strokeDasharray="4 4"
          label={{
            ...thresholdLabel,
            value: `Energy check-in line: ${LOW_ENERGY_THRESHOLD}`,
            position: "insideBottomLeft",
          }}
        />
        <ChartTooltip
          cursor={lineCursor}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(_, payload) =>
                formatDayLong(String(payload?.[0]?.payload?.date ?? ""))
              }
              formatter={(value, name, item) => {
                const key = String(name) as keyof typeof scaleLabels
                return (
                  <>
                    <span
                      className="h-full w-0.5 shrink-0 rounded-full"
                      style={{ background: item.color }}
                    />
                    <span className="flex-1 text-muted-foreground">
                      {config[key]?.label ?? name}
                    </span>
                    <span className="font-medium text-foreground tabular-nums">
                      {String(value)}
                      <span className="ml-1 font-normal text-muted-foreground">
                        {scaleLabels[key]?.[Number(value) - 1]}
                      </span>
                    </span>
                  </>
                )
              }}
            />
          }
        />
        {(["energy", "workload"] as const).map((key) => (
          <Line
            key={key}
            dataKey={key}
            type="monotone"
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            isAnimationActive={false}
            dot={
              dots
                ? {
                    r: 4,
                    fill: `var(--color-${key})`,
                    stroke: "var(--card)",
                    strokeWidth: 2,
                  }
                : false
            }
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          />
        ))}
        <ChartLegend
          verticalAlign="top"
          align="right"
          content={
            <ChartLegendContent className="justify-end pt-0 pb-2 text-xs text-muted-foreground" />
          }
        />
      </LineChart>
    </ChartContainer>
  )
}
