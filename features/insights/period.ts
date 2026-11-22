/** Reporting windows for Team Insights, resolved from `?period=`. */
export const insightPeriods = [
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "180d", label: "Last 180 days", days: 180 },
] as const

export type InsightPeriod = (typeof insightPeriods)[number]

export const DEFAULT_INSIGHT_PERIOD: InsightPeriod["value"] = "90d"

export function resolveInsightPeriod(raw: string | null): InsightPeriod {
  return (
    insightPeriods.find((p) => p.value === raw) ??
    insightPeriods.find((p) => p.value === DEFAULT_INSIGHT_PERIOD)!
  )
}
