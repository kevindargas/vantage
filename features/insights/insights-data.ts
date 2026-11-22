import { blockerCategoryLabels, goalStatusLabels } from "@/lib/constants"
import { formatDay } from "@/lib/format"
import { addDays, dayOf, daysSince, startOfWeek, today } from "@/lib/time"
import type {
  Blocker,
  BlockerCategory,
  Commitment,
  GoalStatus,
  Milestone,
  Person,
  Workspace,
} from "@/lib/types"
import { cadenceHealth, type CadenceHealth } from "@/lib/vantage/cadence"
import { daysSinceCareer } from "@/lib/vantage/nudges"
import {
  activePeople,
  followThrough,
  isOverdue,
  pulseSummary,
  type FollowThrough,
} from "@/lib/vantage/selectors"

/**
 * Everything Team Insights draws, computed from the workspace for one
 * reporting window. Pure: the view passes `workspace.use()` and a day count.
 */

export const CADENCE_SLOTS = 12

export type SlotStatus = "held" | "cancelled" | "none"

export interface CadenceRow {
  person: Person
  health: CadenceHealth
  /** Oldest first, padded on the left with `none`. */
  slots: { key: string; status: SlotStatus; day?: string }[]
  held: number
  cancelled: number
}

export interface WeekBucket {
  /** Monday of the week. */
  start: string
  label: string
}

export interface HeatRow {
  person: Person
  /** One entry per week; null when no pulse was shared that week. */
  cells: ({ energy: number; workload: number } | null)[]
}

export interface GapRow {
  person: Person
  days: number
  /** False when there is nothing on the record and the count runs from the start date. */
  hasRecord: boolean
}

export interface RankedBlocker {
  blocker: Blocker
  person?: Person
  count: number
}

export interface Insights {
  from: string
  to: string
  weeks: WeekBucket[]
  people: Person[]
  kpis: {
    heldRate: number | null
    held: number
    cancelled: number
    manager: FollowThrough
    report: FollowThrough
    openBlockers: number
    energy: number | null
    workload: number | null
    peopleWithPulses: number
  }
  cadence: CadenceRow[]
  heldPerWeek: { name: string; held: number; cancelled: number }[]
  followByPerson: { name: string; you: number | null; them: number | null }[]
  openVsOverdue: { name: string; onTime: number; overdue: number }[]
  commitmentsPerWeek: { name: string; created: number; closed: number }[]
  blockerCategories: { name: string; value: number }[]
  rankedBlockers: RankedBlocker[]
  blockerStatus: { open: number; escalated: number; resolved: number }
  heat: HeatRow[]
  pulseTrend: { name: string; energy: number | null; workload: number | null }[]
  pulseCount: number
  feedbackPerWeek: {
    name: string
    recognition: number
    developmental: number
  }[]
  feedbackCount: number
  feedbackGaps: GapRow[]
  careerGaps: GapRow[]
  milestones: { milestone: Milestone; person?: Person; day: string }[]
  goalsByStatus: { name: string; value: number }[]
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function average(values: number[]): number | null {
  return values.length
    ? round1(values.reduce((s, v) => s + v, 0) / values.length)
    : null
}

/** Commitments that were live at some point in the window. */
function inWindow(c: Commitment, from: string) {
  return (
    c.status === "open" ||
    dayOf(c.createdAt) >= from ||
    (!!c.completedAt && dayOf(c.completedAt) >= from)
  )
}

export function buildInsights(ws: Workspace, days: number): Insights {
  const to = today()
  const from = addDays(to, -(days - 1))
  const inPeriod = (value: string) => {
    const d = dayOf(value)
    return d >= from && d <= to
  }
  const people = activePeople(ws)
  const ids = new Set(people.map((p) => p.id))
  const byId = new Map(people.map((p) => [p.id, p]))

  const weeks: WeekBucket[] = []
  for (let w = startOfWeek(from); w <= to; w = addDays(w, 7))
    weeks.push({ start: w, label: formatDay(w) })
  const weekIndex = (value: string) => {
    if (!inPeriod(value)) return -1
    return weeks.findIndex((w) => w.start === startOfWeek(dayOf(value)))
  }
  const perWeek = <T extends Record<string, number>>(zero: T) =>
    weeks.map((w) => ({ name: w.label, ...zero }))

  /* cadence */
  const past = ws.meetings.filter(
    (m) =>
      ids.has(m.personId) &&
      (m.status === "completed" || m.status === "cancelled") &&
      inPeriod(m.scheduledAt)
  )
  const held = past.filter((m) => m.status === "completed").length
  const cancelled = past.length - held
  const heldPerWeek = perWeek({ held: 0, cancelled: 0 })
  for (const m of past) {
    const i = weekIndex(m.scheduledAt)
    if (i < 0) continue
    if (m.status === "completed") heldPerWeek[i].held += 1
    else heldPerWeek[i].cancelled += 1
  }
  const cadence: CadenceRow[] = people.map((person) => {
    const mine = past
      .filter((m) => m.personId === person.id)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(-CADENCE_SLOTS)
    const slots: CadenceRow["slots"] = mine.map((m) => ({
      key: m.id,
      status: m.status === "completed" ? "held" : "cancelled",
      day: dayOf(m.scheduledAt),
    }))
    while (slots.length < CADENCE_SLOTS)
      slots.unshift({ key: `none-${slots.length}`, status: "none" })
    return {
      person,
      health: cadenceHealth(person, ws.meetings),
      slots,
      held: mine.filter((m) => m.status === "completed").length,
      cancelled: mine.filter((m) => m.status === "cancelled").length,
    }
  })

  /* commitments */
  const commitments = ws.commitments.filter(
    (c) => ids.has(c.personId) && inWindow(c, from)
  )
  const manager = followThrough(commitments, "manager")
  const report = followThrough(commitments, "report")
  const followByPerson = people
    .map((p) => ({
      name: p.name,
      you: followThrough(commitments, "manager", p.id).rate,
      them: followThrough(commitments, "report", p.id).rate,
    }))
    .filter((row) => row.you !== null || row.them !== null)
  const open = commitments.filter((c) => c.status === "open")
  const openVsOverdue = (["manager", "report"] as const).map((owner) => {
    const list = open.filter((c) => c.owner === owner)
    const overdue = list.filter(isOverdue).length
    return {
      name: owner === "manager" ? "You owe" : "They owe",
      onTime: list.length - overdue,
      overdue,
    }
  })
  const commitmentsPerWeek = perWeek({ created: 0, closed: 0 })
  for (const c of commitments) {
    const made = weekIndex(c.createdAt)
    if (made >= 0) commitmentsPerWeek[made].created += 1
    if (c.completedAt && c.status === "done") {
      const closed = weekIndex(c.completedAt)
      if (closed >= 0) commitmentsPerWeek[closed].closed += 1
    }
  }

  /* blockers */
  const blockers = ws.blockers.filter((b) => ids.has(b.personId))
  const categoryCounts = new Map<BlockerCategory, number>()
  for (const b of blockers) {
    const n = b.occurrences.filter((o) => inPeriod(o.date)).length
    if (n)
      categoryCounts.set(b.category, (categoryCounts.get(b.category) ?? 0) + n)
  }
  const blockerCategories = [...categoryCounts.entries()]
    .map(([category, value]) => ({
      name: blockerCategoryLabels[category],
      value,
    }))
    .sort((a, b) => b.value - a.value)
  const touched = blockers.filter(
    (b) =>
      b.occurrences.some((o) => inPeriod(o.date)) ||
      b.history.some((h) => inPeriod(h.date))
  )
  const blockerStatus = {
    open: touched.filter((b) => b.status === "open").length,
    escalated: touched.filter((b) => b.status === "escalated").length,
    resolved: touched.filter((b) => b.status === "resolved").length,
  }
  const rankedBlockers: RankedBlocker[] = blockers
    .filter((b) => b.status !== "resolved" && b.occurrences.length > 1)
    .map((b) => ({
      blocker: b,
      person: byId.get(b.personId),
      count: b.occurrences.length,
    }))
    .sort(
      (a, b) =>
        b.count - a.count || a.blocker.title.localeCompare(b.blocker.title)
    )
    .slice(0, 6)

  /* workload: voluntary pulses only */
  const pulses = ws.pulses.filter(
    (p) => ids.has(p.personId) && inPeriod(p.date)
  )
  const summaries = people
    .map((p) => pulseSummary(pulses.filter((x) => x.personId === p.id)))
    .filter((s) => s.count > 0)
  const heat: HeatRow[] = people
    .map((person) => ({
      person,
      cells: weeks.map((_, i) => {
        const inWeek = pulses.filter(
          (p) => p.personId === person.id && weekIndex(p.date) === i
        )
        if (!inWeek.length) return null
        return {
          energy: average(inWeek.map((p) => p.energy))!,
          workload: average(inWeek.map((p) => p.workload))!,
        }
      }),
    }))
    .filter((row) => row.cells.some(Boolean))
  const pulseTrend = weeks.map((w, i) => {
    const inWeek = pulses.filter((p) => weekIndex(p.date) === i)
    return {
      name: w.label,
      energy: average(inWeek.map((p) => p.energy)),
      workload: average(inWeek.map((p) => p.workload)),
    }
  })

  /* feedback */
  const given = ws.feedback.filter(
    (f) => ids.has(f.personId) && f.direction === "given"
  )
  const feedbackPerWeek = perWeek({ recognition: 0, developmental: 0 })
  let feedbackCount = 0
  for (const f of given) {
    const i = weekIndex(f.deliveredDate ?? f.observedDate)
    if (i < 0) continue
    feedbackPerWeek[i][f.kind] += 1
    feedbackCount += 1
  }
  const feedbackGaps: GapRow[] = people
    .map((person) => {
      const last = given
        .filter((f) => f.personId === person.id && f.deliveredDate)
        .map((f) => f.deliveredDate!)
        .sort()
        .pop()
      return {
        person,
        days: Math.max(0, daysSince(last ?? person.startDate)),
        hasRecord: !!last,
      }
    })
    .sort((a, b) => b.days - a.days)

  /* growth */
  const careerGaps: GapRow[] = people
    .map((person) => ({
      person,
      days: Math.max(0, daysSinceCareer(ws, person)),
      hasRecord:
        ws.meetings.some(
          (m) =>
            m.personId === person.id &&
            m.type === "career" &&
            m.status === "completed"
        ) || ws.aspirations.some((a) => a.personId === person.id),
    }))
    .sort((a, b) => b.days - a.days)
  const milestones = ws.milestones
    .filter((m) => ids.has(m.personId) && m.status === "demonstrated")
    .map((milestone) => ({
      milestone,
      person: byId.get(milestone.personId),
      day:
        [...milestone.history]
          .reverse()
          .find((h) => h.status === "demonstrated")?.date ?? "",
    }))
    .filter((m) => m.day && inPeriod(m.day))
    .sort((a, b) => b.day.localeCompare(a.day))
  const goalOrder: GoalStatus[] = [
    "on-track",
    "at-risk",
    "off-track",
    "done",
    "dropped",
  ]
  const goals = ws.goals.filter(
    (g) => ids.has(g.personId) && (!g.validTo || g.validTo >= from)
  )
  const goalsByStatus = goalOrder
    .map((status) => ({
      name: goalStatusLabels[status],
      value: goals.filter((g) => g.status === status).length,
    }))
    .filter((row) => row.value > 0)

  return {
    from,
    to,
    weeks,
    people,
    kpis: {
      heldRate: past.length ? Math.round((held / past.length) * 100) : null,
      held,
      cancelled,
      manager,
      report,
      openBlockers: blockers.filter((b) => b.status !== "resolved").length,
      energy: average(
        summaries.map((s) => s.energy).filter((v): v is number => v !== null)
      ),
      workload: average(
        summaries.map((s) => s.workload).filter((v): v is number => v !== null)
      ),
      peopleWithPulses: summaries.length,
    },
    cadence,
    heldPerWeek,
    followByPerson,
    openVsOverdue,
    commitmentsPerWeek,
    blockerCategories,
    rankedBlockers,
    blockerStatus,
    heat,
    pulseTrend,
    pulseCount: pulses.length,
    feedbackPerWeek,
    feedbackCount,
    feedbackGaps,
    careerGaps,
    milestones,
    goalsByStatus,
  }
}
