import {
  blockerCategoryLabels,
  careerTrackLabels,
  goalStatusLabels,
  stayDriverLabels,
} from "@/lib/constants"
import { dayDistance, formatDay, plural } from "@/lib/format"
import {
  addDays,
  dayOf,
  inRange,
  parseDay,
  quarterOf,
  quarterRange,
  startOfWeek,
  toDay,
  today,
} from "@/lib/time"
import type { Person, Workspace } from "@/lib/types"
import { cadenceHealth, cadenceStateLabels } from "./cadence"
import {
  activePeople,
  currentAspiration,
  followThrough,
  isOverdue,
  pulseSummary,
  pulsesFor,
} from "./selectors"

/**
 * Ask Vantage: questions across the whole team, answered from the record.
 * This is a rule-based query engine, not a language model. It recognizes a
 * topic, an optional person and an optional time range, runs the matching
 * query and returns rows that link back to their source. When it does not
 * recognize the topic it falls back to a text search.
 */

export interface AskRow {
  id: string
  personId?: string
  text: string
  meta?: string
  href: string
  /** Day used for ordering and display. */
  date?: string
  tone?: "neutral" | "warning" | "danger" | "success" | "info"
}

export interface AskResult {
  query: string
  topic: string
  /** One-sentence answer. */
  summary: string
  /** How the question was read, so the manager can see the filters applied. */
  interpretation: string[]
  rows: AskRow[]
}

export const askExamples = [
  "List every cross-team dependency raised by my reports this month",
  "What do I owe people that is overdue?",
  "Who is carrying the heaviest workload?",
  "What blocked Maya this quarter?",
  "Which goals are at risk?",
  "Who haven't I met with recently?",
  "What recognition have I given in the last 30 days?",
  "Where does everyone want to be in two years?",
  "What keeps people here, and what might make them leave?",
]

interface Range {
  from: string
  to: string
  label: string
}

/** Time range named in a question, if any. */
export function parseRange(query: string): Range | undefined {
  const q = query.toLowerCase()
  const day = today()
  const date = parseDay(day)
  const lastN = /\b(?:last|past)\s+(\d{1,3})\s+(day|week|month)s?\b/.exec(q)
  if (lastN) {
    const n =
      Number(lastN[1]) * (lastN[2] === "day" ? 1 : lastN[2] === "week" ? 7 : 30)
    return {
      from: addDays(day, -n),
      to: day,
      label: `last ${lastN[1]} ${lastN[2]}s`,
    }
  }
  if (/\bthis week\b/.test(q))
    return { from: startOfWeek(day), to: day, label: "this week" }
  if (/\blast week\b/.test(q)) {
    const from = addDays(startOfWeek(day), -7)
    return { from, to: addDays(from, 6), label: "last week" }
  }
  if (/\bthis month\b/.test(q))
    return {
      from: toDay(new Date(date.getFullYear(), date.getMonth(), 1)),
      to: day,
      label: "this month",
    }
  if (/\blast month\b/.test(q))
    return {
      from: toDay(new Date(date.getFullYear(), date.getMonth() - 1, 1)),
      to: toDay(new Date(date.getFullYear(), date.getMonth(), 0)),
      label: "last month",
    }
  if (/\bthis quarter\b/.test(q)) {
    const r = quarterRange(quarterOf(day))
    return { from: r.from, to: day, label: "this quarter" }
  }
  if (/\blast quarter\b/.test(q)) {
    const start = parseDay(quarterRange(quarterOf(day)).from)
    const prev = quarterOf(
      toDay(new Date(start.getFullYear(), start.getMonth() - 1, 15))
    )
    return { ...quarterRange(prev), label: "last quarter" }
  }
  const named = /\bq([1-4])(?:\s+(\d{4}))?\b/.exec(q)
  if (named) {
    const year = named[2] ? Number(named[2]) : date.getFullYear()
    const label = `${year}-Q${named[1]}`
    return { ...quarterRange(label), label: `Q${named[1]} ${year}` }
  }
  if (/\b(recent|recently|lately)\b/.test(q))
    return { from: addDays(day, -30), to: day, label: "last 30 days" }
  return undefined
}

function findPerson(ws: Workspace, query: string): Person | undefined {
  const q = query.toLowerCase()
  return ws.people.find((p) => {
    const first = p.name.split(" ")[0].toLowerCase()
    return (
      q.includes(p.name.toLowerCase()) || new RegExp(`\\b${first}\\b`).test(q)
    )
  })
}

const has = (q: string, re: RegExp) => re.test(q)

export function ask(ws: Workspace, query: string): AskResult {
  const q = query.toLowerCase().trim()
  const person = findPerson(ws, q)
  const range = parseRange(q)
  const people = person ? [person] : activePeople(ws)
  const ids = new Set(people.map((p) => p.id))
  const nameOf = (id: string) =>
    ws.people.find((p) => p.id === id)?.name ?? "Unknown"
  const interpretation = [
    person ? `Person: ${person.name}` : "Everyone on the team",
    range ? `Period: ${range.label}` : "Any time",
  ]
  const within = (day: string) => !range || inRange(day, range.from, range.to)
  const result = (
    topic: string,
    summary: string,
    rows: AskRow[]
  ): AskResult => ({
    query,
    topic,
    summary,
    interpretation: [`Topic: ${topic}`, ...interpretation],
    rows,
  })

  /* cadence */
  if (
    has(q, /\b(haven'?t i met|not met|overdue 1:?1|cadence|skipped|cancel)/)
  ) {
    const rows = people
      .map((p) => ({ p, h: cadenceHealth(p, ws.meetings) }))
      .sort((a, b) => (b.h.daysSinceLast ?? 999) - (a.h.daysSinceLast ?? 999))
      .map(({ p, h }) => ({
        id: p.id,
        personId: p.id,
        text:
          h.daysSinceLast === undefined
            ? "No 1:1 held yet"
            : `Last 1:1 ${dayDistance(h.lastHeldDay!)}, every ${h.expectedDays} days expected`,
        meta: `${cadenceStateLabels[h.state]}${h.recentCancellations ? `, ${plural(h.recentCancellations, "cancellation")}` : ""}`,
        href: `/people/profile?id=${p.id}&tab=meetings`,
        tone:
          h.state === "overdue"
            ? ("danger" as const)
            : h.state === "healthy"
              ? ("success" as const)
              : ("warning" as const),
      }))
    const late = rows.filter((r) => r.tone === "danger").length
    return result(
      "1:1 cadence",
      late
        ? `${plural(late, "person", "people")} overdue for a 1:1.`
        : "Everyone has had a 1:1 inside their cadence.",
      rows
    )
  }

  /* workload */
  if (
    has(
      q,
      /\b(workload|energy|burn ?out|pulse|overload|heaviest|stretched|tired)/
    )
  ) {
    const rows = people
      .map((p) => {
        const s = pulseSummary(pulsesFor(ws, p.id))
        const markers = ws.workloadMarkers.filter(
          (w) => w.personId === p.id && !w.resolvedDate
        )
        return { p, s, markers }
      })
      .filter(({ s }) => s.count > 0)
      .sort(
        (a, b) =>
          (b.s.workload ?? 0) - (a.s.workload ?? 0) ||
          (a.s.energy ?? 5) - (b.s.energy ?? 5)
      )
      .map(({ p, s, markers }) => ({
        id: p.id,
        personId: p.id,
        text: `Workload ${s.workload} of 5, energy ${s.energy} of 5 across recent pulses`,
        meta: markers.length
          ? `Stated: ${markers.map((m) => m.note).join("; ")}`
          : "No stated pressure on record",
        href: `/people/profile?id=${p.id}&tab=wellbeing`,
        tone:
          (s.workload ?? 0) >= 4 || (s.energy ?? 5) <= 2.5
            ? ("danger" as const)
            : ("neutral" as const),
      }))
    const top = rows[0]
    return result(
      "Workload and energy",
      top
        ? `${nameOf(top.personId!)} reports the heaviest load. Figures come from voluntary pulses and what people said, nothing inferred.`
        : "No pulses have been logged yet.",
      rows
    )
  }

  /* commitments */
  if (has(q, /\b(owe|commit|action item|follow[- ]?through|promise|overdue)/)) {
    const mineOnly = has(
      q,
      /\b(i owe|do i owe|my commitment|i promised|i committed)/
    )
    const theirs = has(q, /\b(they owe|owe me|their commitment)/)
    const overdueOnly = has(q, /\boverdue|late|past due/)
    const rows = ws.commitments
      .filter((c) => ids.has(c.personId) && c.status === "open")
      .filter((c) =>
        mineOnly ? c.owner === "manager" : theirs ? c.owner === "report" : true
      )
      .filter((c) => (overdueOnly ? isOverdue(c) : true))
      .filter((c) => within(dayOf(c.createdAt)))
      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
      .map((c) => ({
        id: c.id,
        personId: c.personId,
        text: c.text,
        meta: `${c.owner === "manager" ? "You owe" : "They owe"}${c.dueDate ? `, due ${dayDistance(c.dueDate)}` : ""}`,
        href: `/commitments?person=${c.personId}`,
        date: c.dueDate,
        tone: isOverdue(c) ? ("danger" as const) : ("neutral" as const),
      }))
    const mine = followThrough(
      ws.commitments.filter((c) => ids.has(c.personId)),
      "manager"
    )
    return result(
      "Commitments",
      `${plural(rows.length, "open commitment")}${overdueOnly ? " past due" : ""}. Your follow-through is ${mine.rate === null ? "not measurable yet" : `${mine.rate}%`}.`,
      rows
    )
  }

  /* blockers */
  if (has(q, /\b(block|depend|friction|stuck|obstacle|in (the|their) way)/)) {
    const crossOnly = has(q, /\b(cross[- ]?team|depend)/)
    const rows = ws.blockers
      .filter((b) => ids.has(b.personId))
      .filter((b) => (crossOnly ? b.category === "cross-team" : true))
      .filter((b) =>
        range
          ? b.occurrences.some((o) => within(o.date))
          : b.status !== "resolved"
      )
      .sort((a, b) => b.occurrences.length - a.occurrences.length)
      .map((b) => {
        const hits = range
          ? b.occurrences.filter((o) => within(o.date))
          : b.occurrences
        return {
          id: b.id,
          personId: b.personId,
          text: b.title,
          meta: `${blockerCategoryLabels[b.category]}, raised ${plural(hits.length, "time")}${range ? ` in ${range.label}` : ""}, ${b.status}`,
          href: `/people/profile?id=${b.personId}&tab=blockers`,
          date: hits[hits.length - 1]?.date,
          tone:
            b.status === "resolved"
              ? ("success" as const)
              : hits.length >= 3
                ? ("danger" as const)
                : ("warning" as const),
        }
      })
    return result(
      crossOnly ? "Cross-team dependencies" : "Blockers",
      rows.length
        ? `${plural(rows.length, crossOnly ? "cross-team dependency" : "blocker", crossOnly ? "cross-team dependencies" : "blockers")} ${range ? `raised in ${range.label}` : "currently open"}.`
        : `Nothing ${range ? `raised in ${range.label}` : "open"}.`,
      rows
    )
  }

  /* goals */
  if (has(q, /\b(goal|okr|objective|at risk|off track)/)) {
    const riskOnly = has(q, /\b(at risk|off track|risk|behind)/)
    const rows = ws.goals
      .filter((g) => ids.has(g.personId) && !g.validTo)
      .filter((g) =>
        riskOnly ? g.status === "at-risk" || g.status === "off-track" : true
      )
      .sort((a, b) => a.progress - b.progress)
      .map((g) => ({
        id: g.id,
        personId: g.personId,
        text: g.title,
        meta: `${goalStatusLabels[g.status]}, ${g.progress}% complete, readiness ${g.readiness}`,
        href: `/people/profile?id=${g.personId}&tab=goals`,
        tone:
          g.status === "off-track"
            ? ("danger" as const)
            : g.status === "at-risk"
              ? ("warning" as const)
              : ("neutral" as const),
      }))
    return result(
      "Goals",
      `${plural(rows.length, riskOnly ? "goal at risk" : "active goal", riskOnly ? "goals at risk" : "active goals")}.`,
      rows
    )
  }

  /* feedback */
  if (has(q, /\b(feedback|recognition|recogni[sz]ed|praise|sbi)/)) {
    const recognitionOnly = has(q, /\b(recognition|recogni[sz]ed|praise)/)
    const upwardOnly = has(q, /\b(upward|about me|for me|to me)/)
    const rows = ws.feedback
      .filter((f) => ids.has(f.personId))
      .filter((f) =>
        upwardOnly
          ? f.direction === "upward"
          : recognitionOnly
            ? f.kind === "recognition" && f.direction === "given"
            : true
      )
      .filter((f) => within(f.deliveredDate ?? f.observedDate))
      .sort((a, b) =>
        (b.deliveredDate ?? b.observedDate).localeCompare(
          a.deliveredDate ?? a.observedDate
        )
      )
      .map((f) => ({
        id: f.id,
        personId: f.personId,
        text: f.behavior,
        meta: `${f.direction === "upward" ? "Upward" : f.kind === "recognition" ? "Recognition" : "Developmental"}, ${f.deliveredDate ? formatDay(f.deliveredDate) : "not yet delivered"}`,
        href: `/feedback?entry=${f.id}`,
        date: f.deliveredDate ?? f.observedDate,
        tone: f.deliveredDate ? ("neutral" as const) : ("warning" as const),
      }))
    const without = people.filter((p) => !rows.some((r) => r.personId === p.id))
    return result(
      "Feedback",
      `${plural(rows.length, "entry", "entries")}${range ? ` in ${range.label}` : ""}.${without.length && !person ? ` Nothing for ${without.map((p) => p.name.split(" ")[0]).join(", ")}.` : ""}`,
      rows
    )
  }

  /* career */
  if (
    has(
      q,
      /\b(career|aspiration|promotion|promote|growth|two years|next level|want to be)/
    )
  ) {
    const rows = people.map((p) => {
      const a = currentAspiration(ws, p.id)
      const shown = ws.milestones.filter(
        (m) => m.personId === p.id && m.status === "demonstrated"
      ).length
      return {
        id: p.id,
        personId: p.id,
        text: a ? a.statement : "No aspiration recorded yet",
        meta: a
          ? `${careerTrackLabels[a.track]}${a.targetRole ? `, toward ${a.targetRole}` : ""}, recorded ${formatDay(a.validFrom)}, ${plural(shown, "milestone")} demonstrated`
          : "Ask in the next career conversation",
        href: `/people/profile?id=${p.id}&tab=career`,
        tone: a ? ("neutral" as const) : ("warning" as const),
      }
    })
    return result(
      "Career direction",
      `${rows.filter((r) => r.tone === "neutral").length} of ${rows.length} people have an aspiration on record.`,
      rows
    )
  }

  /* retention */
  if (
    has(
      q,
      /\b(stay|retention|leave|leaving|keeps? (people|them)|quit|attrition)/
    )
  ) {
    const rows = ws.stayDrivers
      .filter((s) => ids.has(s.personId) && !s.validTo)
      .sort((a, b) => a.kind.localeCompare(b.kind))
      .map((s) => ({
        id: s.id,
        personId: s.personId,
        text: s.text,
        meta: `${stayDriverLabels[s.kind]}${s.action ? `. Action: ${s.action}` : ""}`,
        href: `/people/profile?id=${s.personId}&tab=retention`,
        tone:
          s.kind === "leave-trigger"
            ? ("danger" as const)
            : s.kind === "friction"
              ? ("warning" as const)
              : ("success" as const),
      }))
    const risks = rows.filter((r) => r.tone !== "success").length
    return result(
      "Stay drivers",
      `${plural(rows.length, "driver")} on record, ${risks} of them friction or a reason someone considered leaving.`,
      rows
    )
  }

  /* fallback: text search over the record */
  const terms = q.split(/\s+/).filter((t) => t.length > 2)
  const match = (text: string) =>
    terms.length > 0 && terms.every((t) => text.toLowerCase().includes(t))
  const rows: AskRow[] = []
  for (const c of ws.commitments)
    if (ids.has(c.personId) && match(c.text))
      rows.push({
        id: c.id,
        personId: c.personId,
        text: c.text,
        meta: "Commitment",
        href: `/commitments?person=${c.personId}`,
      })
  for (const g of ws.goals)
    if (ids.has(g.personId) && match(g.title))
      rows.push({
        id: g.id,
        personId: g.personId,
        text: g.title,
        meta: "Goal",
        href: `/people/profile?id=${g.personId}&tab=goals`,
      })
  for (const b of ws.blockers)
    if (ids.has(b.personId) && match(b.title))
      rows.push({
        id: b.id,
        personId: b.personId,
        text: b.title,
        meta: "Blocker",
        href: `/people/profile?id=${b.personId}&tab=blockers`,
      })
  for (const f of ws.feedback)
    if (
      ids.has(f.personId) &&
      match(`${f.situation} ${f.behavior} ${f.impact}`)
    )
      rows.push({
        id: f.id,
        personId: f.personId,
        text: f.behavior,
        meta: "Feedback",
        href: `/feedback?entry=${f.id}`,
      })
  for (const m of ws.meetings)
    if (
      ids.has(m.personId) &&
      match(`${m.sharedNotes} ${m.agenda.map((a) => a.text).join(" ")}`)
    )
      rows.push({
        id: m.id,
        personId: m.personId,
        text: m.agenda[0]?.text ?? "1:1 notes",
        meta: `1:1 on ${formatDay(dayOf(m.scheduledAt))}`,
        href: `/meetings/session?id=${m.id}`,
      })
  return {
    query,
    topic: "Search",
    summary: rows.length
      ? `${plural(rows.length, "record")} mention those words.`
      : "No topic recognized and no record mentions those words. Try one of the examples.",
    interpretation: ["Topic: text search", ...interpretation],
    rows,
  }
}
