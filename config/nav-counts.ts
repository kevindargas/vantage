import { today } from "@/lib/time"
import type { Workspace } from "@/lib/types"
import { buildNudges } from "@/lib/vantage/nudges"
import { isOverdue, meetingsOn } from "@/lib/vantage/selectors"
import type { NavCounts } from "./nav"

/**
 * Sidebar badge numbers, from the same selectors the target pages use. Called
 * in the app frame with the live workspace, so a badge moves the moment the
 * record changes.
 */
export function getNavCounts(ws: Workspace): NavCounts {
  const active = new Set(
    ws.people.filter((p) => p.status === "active").map((p) => p.id)
  )
  return {
    nudges: buildNudges(ws).length,
    meetingsToday: meetingsOn(ws, today()).length,
    overdue: ws.commitments.filter(
      (c) => active.has(c.personId) && c.owner === "manager" && isOverdue(c)
    ).length,
    undelivered: ws.feedback.filter(
      (f) =>
        active.has(f.personId) && f.direction === "given" && !f.deliveredDate
    ).length,
  }
}
