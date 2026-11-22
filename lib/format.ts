import { siteConfig } from "@/config/site"
import { dayOf, daysBetween, now, parseDay, today } from "@/lib/time"

/**
 * The only formatters in the app. Dates render in the browser's local time
 * zone. Functions take either a `YYYY-MM-DD` day or an ISO instant.
 */

const { locale } = siteConfig

const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

/** "3 days ago", "in 2 hours", "yesterday". */
export function timeAgo(value: string, base: Date = now()) {
  const diffMs = parseDay(value).getTime() - base.getTime()
  const abs = Math.abs(diffMs)
  if (abs < 60_000) return "just now"
  if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), "minute")
  if (abs < 86_400_000)
    return rtf.format(Math.round(diffMs / 3_600_000), "hour")
  const days = Math.round(diffMs / 86_400_000)
  if (abs < 30 * 86_400_000) return rtf.format(days, "day")
  if (abs < 365 * 86_400_000) return rtf.format(Math.round(days / 30), "month")
  return rtf.format(Math.round(days / 365), "year")
}

/** Whole-day distance in words: "today", "tomorrow", "3 days ago", "in 2 weeks". */
export function dayDistance(value: string) {
  const days = daysBetween(today(), dayOf(value))
  if (Math.abs(days) < 14) return rtf.format(days, "day")
  if (Math.abs(days) < 60) return rtf.format(Math.round(days / 7), "week")
  if (Math.abs(days) < 365) return rtf.format(Math.round(days / 30), "month")
  return rtf.format(Math.round(days / 365), "year")
}

/** "Nov 22, 2026". The year is dropped for dates in the current year. */
export function formatDay(value: string, opts?: Intl.DateTimeFormatOptions) {
  const date = parseDay(value)
  const sameYear = date.getFullYear() === now().getFullYear()
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    ...opts,
  })
}

/** "Sunday, November 22". */
export function formatDayLong(value: string) {
  return parseDay(value).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

/** "Today", "Tomorrow", "Yesterday", otherwise "Mon, Nov 23". */
export function formatRelativeDay(value: string) {
  const days = daysBetween(today(), dayOf(value))
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  if (days === -1) return "Yesterday"
  return parseDay(dayOf(value)).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

/** "9:30 AM" for an ISO instant. */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  })
}

/** "Nov 22, 9:30 AM". */
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Alias kept for the shared table cells. */
export const formatDate = formatDay

/** "Mon, Nov 23 at 9:30 AM", with Today and Tomorrow spelled out. */
export function formatWhen(iso: string) {
  return `${formatRelativeDay(iso)} at ${formatTime(iso)}`
}

/** Minutes to "45 min", "1h", "1h 30m". */
export function formatMinutes(minutes: number) {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`
}

/** Seconds to "45s", "2m 05s". */
export function formatSeconds(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`
}

/** Tenure from a start day: "38 days", "5 months", "2 years 6 months". */
export function formatTenure(startDate: string) {
  const days = Math.max(0, daysBetween(startDate, today()))
  if (days < 60) return `${days} ${days === 1 ? "day" : "days"}`
  const months = Math.floor(days / 30.44)
  if (months < 12) return `${months} months`
  const years = Math.floor(months / 12)
  const rest = months % 12
  const y = `${years} ${years === 1 ? "year" : "years"}`
  return rest ? `${y} ${rest} ${rest === 1 ? "month" : "months"}` : y
}

export function formatNumber(n: number, compact = false) {
  return new Intl.NumberFormat(locale, {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n)
}

export function formatPercent(n: number, digits = 0) {
  return `${n.toFixed(digits)}%`
}

/** Signed delta with a unit, e.g. +12%, −3.5pt. Uses a true minus sign. */
export function formatDelta(delta: number, unit = "%", digits = 1) {
  const abs = Math.abs(delta)
  const n = Number.isInteger(abs) ? abs.toString() : abs.toFixed(digits)
  return `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${n}${unit}`
}

/** "Maya Chen" to "MC". */
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

/** "Maya Chen" to "Maya". */
export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? ""
}

/** "1 item", "3 items". */
export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}
