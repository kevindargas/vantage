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
  axisTick,
  CHART_HEIGHT,
  CHART_MARGIN,
  gridStroke,
  lineCursor,
  Y_AXIS_WIDTH,
} from "@/components/charts/chart-primitives"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { TALK_SHARE_MAX, TALK_SHARE_MIN } from "@/lib/constants"
import { formatDay } from "@/lib/format"
import type { Meeting } from "@/lib/types"

/**
 * The direct report's share of words over their recent conversations, with
 * the target band shaded. One series, one axis fixed at 0 to 100, so the
 * title names the line and no legend is needed.
 */
export function TalkShareTrend({
  meetings,
  name,
  currentId,
}: {
  /** Conversations with stats, oldest first. */
  meetings: Meeting[]
  name: string
  /** The conversation this card belongs to, marked in the table view. */
  currentId?: string
}) {
  const config = {
    share: { label: `${name}'s share`, color: "var(--chart-1)" },
  } satisfies ChartConfig
  const points = meetings.map((m) => ({
    id: m.id,
    day: formatDay(m.scheduledAt),
    share: m.stats?.reportShare ?? 0,
  }))

  return (
    <figure className="flex flex-col gap-2">
      <ChartContainer
        config={config}
        className="aspect-auto w-full"
        style={{ height: CHART_HEIGHT.sm }}
        aria-hidden
      >
        <LineChart data={points} margin={CHART_MARGIN}>
          <CartesianGrid vertical={false} stroke={gridStroke} />
          <ReferenceArea
            y1={TALK_SHARE_MIN}
            y2={TALK_SHARE_MAX}
            fill="var(--success)"
            fillOpacity={0.12}
            stroke="none"
          />
          <XAxis
            dataKey="id"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={24}
            tick={axisTick}
            tickFormatter={(id: string) =>
              points.find((p) => p.id === id)?.day ?? ""
            }
            padding={{ left: 16, right: 16 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={Y_AXIS_WIDTH + 8}
            tickMargin={6}
            domain={[0, 100]}
            ticks={[0, TALK_SHARE_MIN, TALK_SHARE_MAX, 100]}
            tick={axisTick}
            tickFormatter={(v: number) => `${v}%`}
          />
          <ChartTooltip
            cursor={lineCursor}
            content={
              <ChartTooltipContent
                indicator="line"
                labelFormatter={(_, payload) =>
                  String(payload?.[0]?.payload?.day ?? "")
                }
                formatter={(value) => (
                  <>
                    <span
                      className="h-full w-0.5 shrink-0 rounded-full"
                      style={{ background: "var(--color-share)" }}
                    />
                    <span className="flex-1 text-muted-foreground">
                      {name}&apos;s share
                    </span>
                    <span className="font-medium text-foreground tabular-nums">
                      {Number(value)}%
                    </span>
                  </>
                )}
              />
            }
          />
          <Line
            dataKey="share"
            type="monotone"
            stroke="var(--color-share)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            isAnimationActive={false}
            dot={{
              r: 4,
              fill: "var(--color-share)",
              stroke: "var(--card)",
              strokeWidth: 2,
            }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </LineChart>
      </ChartContainer>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-4 rounded-sm border-y border-success/60 bg-success/15"
          />
          Target range, {TALK_SHARE_MIN} to {TALK_SHARE_MAX}%
        </span>
        <span>Share of words spoken by {name}, oldest to newest.</span>
      </figcaption>
      <table className="sr-only">
        <caption>{name}&apos;s share of words by conversation</caption>
        <thead>
          <tr>
            <th scope="col">Conversation</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.id}>
              <td>
                {p.day}
                {p.id === currentId ? " (this conversation)" : ""}
              </td>
              <td>{p.share}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
