/**
 * The one place the wall clock is read. Dates in the workspace come in two
 * shapes: `YYYY-MM-DD` day strings (start dates, due dates, validity ranges)
 * and full ISO instants (scheduled times, audit stamps). Everything here works
 * in the browser's local time zone, because a 1:1 at 10:00 means 10:00 where
 * the manager sits.
 */

export const DAY_MS = 86_400_000

let frozen: Date | null = null

/** Current instant. Tests pin it with `freezeClock`. */
export function now(): Date {
  return frozen ? new Date(frozen.getTime()) : new Date()
}

/** Test helper: pin `now()` to a fixed instant, or pass `null` to release. */
export function freezeClock(at: Date | string | null) {
  frozen = at === null ? null : new Date(at)
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** Local `YYYY-MM-DD` for a Date. */
export function toDay(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Today's local `YYYY-MM-DD`. */
export function today(): string {
  return toDay(now())
}

/** Parse a day string (or ISO instant) to a local Date. Day strings land on local midnight. */
export function parseDay(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

/** Day string of any day string or ISO instant. */
export function dayOf(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toDay(new Date(value))
}

/** Add whole days to a day string. */
export function addDays(day: string, days: number): string {
  const d = parseDay(dayOf(day))
  d.setDate(d.getDate() + days)
  return toDay(d)
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const a = parseDay(dayOf(from))
  const b = parseDay(dayOf(to))
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

/** Whole days since `value` (positive in the past). */
export function daysSince(value: string): number {
  return daysBetween(value, today())
}

/** Whole days until `value` (negative when overdue). */
export function daysUntil(value: string): number {
  return daysBetween(today(), value)
}

/** ISO instant for a local day plus an `HH:MM` time. */
export function atTime(day: string, time: string): string {
  const d = parseDay(day)
  const [h, m] = time.split(":").map(Number)
  d.setHours(h || 0, m || 0, 0, 0)
  return d.toISOString()
}

/** Local `HH:MM` of an ISO instant. */
export function timeOf(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Monday of the week containing `day`. */
export function startOfWeek(day: string): string {
  const d = parseDay(day)
  const offset = (d.getDay() + 6) % 7
  return addDays(day, -offset)
}

/** "2026-Q4" for a day string. */
export function quarterOf(day: string): string {
  const d = parseDay(dayOf(day))
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
}

/** First and last day of a quarter label such as "2026-Q4". */
export function quarterRange(quarter: string): { from: string; to: string } {
  const [y, q] = quarter.split("-Q").map(Number)
  const from = toDay(new Date(y, (q - 1) * 3, 1))
  const to = toDay(new Date(y, q * 3, 0))
  return { from, to }
}

/** True when `day` falls inside the inclusive range. */
export function inRange(day: string, from: string, to: string): boolean {
  const d = dayOf(day)
  return d >= from && d <= to
}
