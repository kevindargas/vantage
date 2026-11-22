"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  XAxis,
  YAxis,
} from "recharts"

import {
  CHART_HEIGHT,
  CHART_MARGIN,
  Y_AXIS_WIDTH,
  axisTick,
  gridStroke,
  lineCursor,
} from "@/components/charts/chart-primitives"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { TALK_SHARE_MAX, TALK_SHARE_MIN } from "@/lib/constants"

export interface TalkSharePoint {
  /** Meeting id: the x category. */
  id: string
  dateLabel: string
  personName: string
  share: number
}

const config = {
  share: { label: "Their share", color: "var(--chart-1)" },
} satisfies ChartConfig

/**
 * The direct report's share of each conversation, oldest to newest, with the
 * target range shaded behind the line. One series, so the title names it.
 */
export function TalkShareChart({ points }: { points: TalkSharePoint[] }) {
  const byId = new Map(points.map((p) => [p.id, p]))
  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: CHART_HEIGHT.lg }}
    >
      <LineChart accessibilityLayer data={points} margin={CHART_MARGIN}>
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <ReferenceArea
          y1={TALK_SHARE_MIN}
          y2={TALK_SHARE_MAX}
          fill="var(--color-share)"
          fillOpacity={0.08}
          stroke="none"
          label={{
            value: `Target range, ${TALK_SHARE_MIN} to ${TALK_SHARE_MAX}%`,
            position: "insideTopLeft",
            fill: "var(--muted-foreground)",
            fontSize: 11,
          }}
        />
        <XAxis
          dataKey="id"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tick={axisTick}
          minTickGap={28}
          tickFormatter={(id: string) => byId.get(id)?.dateLabel ?? ""}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickLine={false}
          axisLine={false}
          width={Y_AXIS_WIDTH + 6}
          tickMargin={6}
          tick={axisTick}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ChartTooltip
          cursor={lineCursor}
          content={({ active, payload }) => {
            const point = active
              ? (payload?.[0]?.payload as TalkSharePoint | undefined)
              : undefined
            if (!point) return null
            return (
              <div className="grid min-w-36 gap-1 rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
                <span className="font-medium">{point.personName}</span>
                <span className="text-muted-foreground">{point.dateLabel}</span>
                <span className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Their share</span>
                  <span className="font-medium tabular-nums">
                    {point.share}%
                  </span>
                </span>
              </div>
            )
          }}
        />
        <Line
          dataKey="share"
          type="linear"
          stroke="var(--color-share)"
          strokeWidth={2}
          dot={{ r: 2.5, strokeWidth: 0, fill: "var(--color-share)" }}
          activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
