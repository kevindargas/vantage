import { meetingTypeLabels } from "@/lib/constants"
import { formatDay, formatDayLong, formatTime } from "@/lib/format"
import { dayOf, today } from "@/lib/time"
import type {
  Commitment,
  Meeting,
  Person,
  Question,
  Workspace,
} from "@/lib/types"
import { buildNudges, type Nudge } from "./nudges"
import {
  builtInQuestions,
  getQuestion,
  scenariosForMeetingType,
} from "./question-bank"
import {
  carriedInto,
  carryCount,
  completedMeetings,
  getPerson,
  isOverdue,
  upcomingMeetings,
} from "./selectors"

/**
 * The morning brief: for each 1:1 on the day, what was promised, what changed
 * since the last conversation and two or three questions worth asking.
 */

export interface BriefChange {
  pillar: "goal" | "blocker" | "career" | "feedback" | "workload"
  text: string
}

export interface Brief {
  meeting: Meeting
  person: Person
  /** Open commitments carried into this conversation, with how many 1:1s each has survived. */
  carried: (Commitment & { carries: number; overdue: boolean })[]
  /** What changed on the record since the last held 1:1. */
  changes: BriefChange[]
  nudges: Nudge[]
  questions: Question[]
  /** True when the direct report has put at least one item on the agenda. */
  hasReportAgenda: boolean
  lastHeldDay?: string
}

/** The day the brief covers: today when there are 1:1s, otherwise the next day that has one. */
export function briefDay(ws: Workspace): {
  day: string
  isToday: boolean
  meetings: Meeting[]
} {
  const day = today()
  const upcoming = upcomingMeetings(ws).filter(
    (m) => dayOf(m.scheduledAt) >= day
  )
  const todays = upcoming.filter((m) => dayOf(m.scheduledAt) === day)
  if (todays.length) return { day, isToday: true, meetings: todays }
  const next = upcoming[0]
  if (!next) return { day, isToday: true, meetings: [] }
  const nextDay = dayOf(next.scheduledAt)
  return {
    day: nextDay,
    isToday: false,
    meetings: upcoming.filter((m) => dayOf(m.scheduledAt) === nextDay),
  }
}

function changesSince(
  ws: Workspace,
  personId: string,
  since: string
): BriefChange[] {
  const out: BriefChange[] = []
  const mine = <T extends { personId: string }>(list: T[]) =>
    list.filter((x) => x.personId === personId)
  for (const g of mine(ws.goals)) {
    const change = g.history.filter((h) => h.date > since).pop()
    if (change && g.history.indexOf(change) > 0)
      out.push({
        pillar: "goal",
        text: `Goal "${g.title}" moved to ${change.status.replace("-", " ")}`,
      })
    else if (g.validFrom > since)
      out.push({ pillar: "goal", text: `New goal: ${g.title}` })
  }
  for (const b of mine(ws.blockers)) {
    const closed = b.history.find((h) => h.date > since && h.status !== "open")
    if (closed)
      out.push({
        pillar: "blocker",
        text: `Blocker ${closed.status}: ${b.title}`,
      })
  }
  for (const m of mine(ws.milestones)) {
    const change = m.history.filter((h) => h.date > since).pop()
    if (change && change.status === "demonstrated")
      out.push({ pillar: "career", text: `Milestone demonstrated: ${m.title}` })
  }
  for (const f of mine(ws.feedback)) {
    if (f.direction === "given" && f.deliveredDate && f.deliveredDate > since)
      out.push({
        pillar: "feedback",
        text: `${f.kind === "recognition" ? "Recognition" : "Developmental feedback"} given: ${f.behavior}`,
      })
  }
  for (const w of mine(ws.workloadMarkers)) {
    if (w.date > since && !w.resolvedDate)
      out.push({ pillar: "workload", text: `Stated pressure: ${w.note}` })
  }
  return out
}

/**
 * Two or three questions for a conversation. Questions attached to the
 * person's nudges come first, then the scenarios that fit the meeting type,
 * rotated by how many 1:1s have been held so the same ones do not repeat.
 */
export function suggestQuestions(
  ws: Workspace,
  meeting: Meeting,
  nudges: Nudge[],
  limit = 3
): Question[] {
  const onAgenda = new Set(
    meeting.agenda.map((a) => a.questionId).filter(Boolean)
  )
  const picked: Question[] = []
  const add = (q?: Question) => {
    if (!q || onAgenda.has(q.id) || picked.some((p) => p.id === q.id)) return
    if (picked.length < limit) picked.push(q)
  }
  // A special-purpose conversation leads with its own questions.
  if (meeting.type === "weekly") {
    for (const n of nudges) {
      if (
        n.meetingType &&
        n.meetingType !== "weekly" &&
        n.kind !== "recurring-blocker"
      )
        continue
      add(getQuestion(n.questionIds?.[0] ?? "", ws.customQuestions))
    }
  }
  const held = completedMeetings(ws, meeting.personId).length
  const pool = [...builtInQuestions, ...ws.customQuestions]
  const scenarios = scenariosForMeetingType[meeting.type]
  scenarios.forEach((scenario, i) => {
    const options = pool.filter((q) => q.scenario === scenario)
    if (!options.length) return
    if (meeting.type === "weekly") add(options[(held + i) % options.length])
    else options.forEach(add)
  })
  return picked
}

export function buildBrief(ws: Workspace, meeting: Meeting): Brief | undefined {
  const person = getPerson(ws, meeting.personId)
  if (!person) return undefined
  const last = completedMeetings(ws, person.id)[0]
  const lastHeldDay = last ? dayOf(last.scheduledAt) : undefined
  const nudges = buildNudges(ws).filter((n) => n.personId === person.id)
  return {
    meeting,
    person,
    carried: carriedInto(ws, meeting)
      .filter((c) => c.status === "open")
      .map((c) => ({ ...c, carries: carryCount(ws, c), overdue: isOverdue(c) }))
      .sort(
        (a, b) => Number(b.overdue) - Number(a.overdue) || b.carries - a.carries
      ),
    changes: lastHeldDay ? changesSince(ws, person.id, lastHeldDay) : [],
    nudges,
    questions: suggestQuestions(
      ws,
      meeting,
      nudges,
      meeting.type === "stay" ? 5 : 3
    ),
    hasReportAgenda: meeting.agenda.some((a) => a.owner === "report"),
    lastHeldDay,
  }
}

/** The note asking the direct report for their top item, sent a day ahead. */
export function prepRequestText(ws: Workspace, meeting: Meeting): string {
  const person = getPerson(ws, meeting.personId)
  const name = person?.name.split(" ")[0] ?? "there"
  return [
    `Hi ${name},`,
    "",
    `Ahead of our ${meetingTypeLabels[meeting.type].toLowerCase()} on ${formatDayLong(dayOf(meeting.scheduledAt))} at ${formatTime(meeting.scheduledAt)}: what is the number one thing you want to talk about?`,
    "",
    "One to three points is plenty. Your items go first, and I will add mine underneath.",
    "",
    ws.manager.name.split(" ")[0] || "Thanks",
  ].join("\n")
}

/**
 * The shared record of a conversation, identical for both participants.
 * Private notes and coaching are never part of it.
 */
export function sharedSummaryText(ws: Workspace, meeting: Meeting): string {
  const person = getPerson(ws, meeting.personId)
  const manager = ws.manager.name || "Manager"
  const report = person?.name ?? "Direct report"
  const lines: string[] = [
    `${meetingTypeLabels[meeting.type]}: ${report} and ${manager}`,
    formatDayLong(dayOf(meeting.scheduledAt)),
    "",
  ]
  if (meeting.agenda.length) {
    lines.push("Agenda")
    for (const a of meeting.agenda) {
      lines.push(
        `- ${a.owner === "report" ? report.split(" ")[0] : manager.split(" ")[0]}: ${a.text}`
      )
      if (a.notes?.trim()) lines.push(`  ${a.notes.trim()}`)
    }
    lines.push("")
  }
  if (meeting.summary?.text.trim()) {
    lines.push("Summary", meeting.summary.text.trim(), "")
  }
  if (meeting.sharedNotes.trim()) {
    lines.push("Notes", meeting.sharedNotes.trim(), "")
  }
  const made = ws.commitments.filter((c) => c.sourceMeetingId === meeting.id)
  const carried = carriedInto(ws, meeting).filter((c) => c.status === "open")
  const line = (c: Commitment) =>
    `- ${c.owner === "manager" ? manager.split(" ")[0] : report.split(" ")[0]}: ${c.text}${c.dueDate ? ` (due ${formatDay(c.dueDate)})` : ""}`
  if (made.length)
    lines.push("Commitments from this conversation", ...made.map(line), "")
  if (carried.length)
    lines.push("Still open from before", ...carried.map(line), "")
  return lines.join("\n").trim()
}
