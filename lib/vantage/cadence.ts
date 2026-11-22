import {
  CANCEL_DRIFT_COUNT,
  CANCEL_DRIFT_WINDOW_DAYS,
  cadenceProfiles,
  ONBOARDING_DAYS,
} from "@/lib/constants"
import {
  addDays,
  atTime,
  dayOf,
  daysBetween,
  daysSince,
  now,
  parseDay,
  today,
} from "@/lib/time"
import type {
  CadenceConfig,
  CadenceProfile,
  Meeting,
  Person,
  WorkMode,
} from "@/lib/types"

/** Days between two 1:1s for a frequency. */
export function intervalDays(cadence: Pick<CadenceConfig, "frequency">) {
  return cadence.frequency === "weekly" ? 7 : 14
}

/**
 * Default cadence for a new direct report. Mornings are preferred, and remote
 * or hybrid senior contributors move to weekly because the 1:1 replaces the
 * hallway context they do not get.
 */
export function recommendCadence(
  profile: CadenceProfile,
  workMode: WorkMode,
  weekday = 2
): CadenceConfig {
  const base = cadenceProfiles[profile].cadence
  const remoteSenior = profile === "senior-ic" && workMode !== "onsite"
  return {
    frequency: remoteSenior ? "weekly" : base.frequency,
    durationMin: remoteSenior ? 30 : base.durationMin,
    weekday,
    time: "10:00",
  }
}

/** Profile to suggest from tenure and whether the person manages others. */
export function suggestProfile(
  startDate: string,
  managesPeople: boolean,
  senior: boolean
): CadenceProfile {
  if (daysSince(startDate) < ONBOARDING_DAYS) return "new-hire"
  if (managesPeople) return "team-lead"
  return senior ? "senior-ic" : "established-ic"
}

/** First day on or after `fromDay` that falls on `weekday`. */
export function nextWeekday(fromDay: string, weekday: number): string {
  const offset = (weekday - parseDay(fromDay).getDay() + 7) % 7
  return addDays(fromDay, offset)
}

/**
 * Day of the next 1:1 in the series. With a previous meeting the next one is
 * one interval later, snapped to the configured weekday; otherwise it is the
 * next matching weekday. Never earlier than `notBefore`.
 */
export function nextOccurrence(
  cadence: CadenceConfig,
  lastHeldDay?: string,
  notBefore: string = today()
): string {
  if (!lastHeldDay) return nextWeekday(notBefore, cadence.weekday)
  const earliest = addDays(lastHeldDay, intervalDays(cadence) - 3)
  const from = earliest > notBefore ? earliest : notBefore
  return nextWeekday(from, cadence.weekday)
}

/** ISO instant of the next 1:1 for a person, from their series. */
export function nextOccurrenceAt(person: Person, meetings: Meeting[]): string {
  const last = lastHeld(meetings, person.id)
  const day = nextOccurrence(
    person.cadence,
    last ? dayOf(last.scheduledAt) : undefined,
    last && dayOf(last.scheduledAt) === today() ? addDays(today(), 1) : today()
  )
  const at = atTime(day, person.cadence.time)
  // Today's slot has already passed: take the next one in the series.
  if (new Date(at).getTime() > now().getTime()) return at
  return atTime(
    nextOccurrence(person.cadence, undefined, addDays(day, 1)),
    person.cadence.time
  )
}

export function lastHeld(
  meetings: Meeting[],
  personId: string
): Meeting | undefined {
  return meetings
    .filter((m) => m.personId === personId && m.status === "completed")
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))[0]
}

export function nextScheduled(
  meetings: Meeting[],
  personId: string
): Meeting | undefined {
  return meetings
    .filter(
      (m) =>
        m.personId === personId &&
        (m.status === "scheduled" || m.status === "in-progress")
    )
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]
}

export type CadenceState = "new" | "healthy" | "due" | "overdue" | "drifting"

export interface CadenceHealth {
  state: CadenceState
  lastHeldDay?: string
  daysSinceLast?: number
  /** Expected gap in days from the person's cadence. */
  expectedDays: number
  nextDay?: string
  /** Cancellations inside the drift window. */
  recentCancellations: number
  /** Share of the last eight scheduled slots that were actually held, 0 to 100. */
  heldRate: number | null
}

/**
 * How well the series is holding. `overdue` means more than one and a half
 * intervals have passed without a conversation; `drifting` means the meetings
 * are being cancelled even though the last one is recent.
 */
export function cadenceHealth(
  person: Person,
  meetings: Meeting[]
): CadenceHealth {
  const mine = meetings.filter((m) => m.personId === person.id)
  const last = lastHeld(mine, person.id)
  const next = nextScheduled(mine, person.id)
  const expectedDays = intervalDays(person.cadence)
  const recentCancellations = mine.filter(
    (m) =>
      m.status === "cancelled" &&
      daysSince(m.scheduledAt) >= 0 &&
      daysSince(m.scheduledAt) <= CANCEL_DRIFT_WINDOW_DAYS
  ).length
  const past = mine
    .filter((m) => m.status === "completed" || m.status === "cancelled")
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
    .slice(0, 8)
  const heldRate = past.length
    ? Math.round(
        (past.filter((m) => m.status === "completed").length / past.length) *
          100
      )
    : null
  const base = {
    expectedDays,
    nextDay: next ? dayOf(next.scheduledAt) : undefined,
    recentCancellations,
    heldRate,
  }
  if (!last) return { state: "new", ...base }
  const lastHeldDay = dayOf(last.scheduledAt)
  const daysSinceLast = daysBetween(lastHeldDay, today())
  let state: CadenceState = "healthy"
  if (daysSinceLast > expectedDays * 1.5) state = "overdue"
  else if (recentCancellations >= CANCEL_DRIFT_COUNT) state = "drifting"
  else if (daysSinceLast > expectedDays && !next) state = "due"
  return { state, lastHeldDay, daysSinceLast, ...base }
}

export const cadenceStateLabels: Record<CadenceState, string> = {
  new: "Not started",
  healthy: "On cadence",
  due: "Due",
  overdue: "Overdue",
  drifting: "Drifting",
}
