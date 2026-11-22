import type { NudgeSeverity } from "@/lib/vantage/nudges"

/** Display names for nudge severities. They match the tones in `StateBadge`. */
export const severityLabels: Record<NudgeSeverity, string> = {
  danger: "Urgent",
  warning: "Attention",
  info: "Suggestion",
}

export const severityOrder: NudgeSeverity[] = ["danger", "warning", "info"]
