import { ONBOARDING_DAYS, PULSE_WINDOW } from "@/lib/constants"
import { dayOf, daysSince, today } from "@/lib/time"
import type {
  AgendaOwner,
  Aspiration,
  Blocker,
  Commitment,
  Goal,
  Meeting,
  MeetingType,
  Milestone,
  Person,
  Pulse,
  StatusChange,
  StayDriver,
  Workspace,
} from "@/lib/types"

/**
 * Read-only helpers over a workspace. Every function takes the workspace (or
 * a list) explicitly so components can pass `workspace.use()` and stay in sync
 * with client mutations.
 */

export function getPerson(ws: Workspace, id: string): Person | undefined {
  return ws.people.find((p) => p.id === id)
}

export function activePeople(ws: Workspace): Person[] {
  return ws.people
    .filter((p) => p.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getMeeting(ws: Workspace, id: string): Meeting | undefined {
  return ws.meetings.find((m) => m.id === id)
}

export function meetingsFor(ws: Workspace, personId: string): Meeting[] {
  return ws.meetings
    .filter((m) => m.personId === personId)
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
}

export function completedMeetings(ws: Workspace, personId?: string): Meeting[] {
  return ws.meetings
    .filter(
      (m) => m.status === "completed" && (!personId || m.personId === personId)
    )
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
}

/** Scheduled or in-progress meetings, soonest first. */
export function upcomingMeetings(ws: Workspace, personId?: string): Meeting[] {
  return ws.meetings
    .filter(
      (m) =>
        (m.status === "scheduled" || m.status === "in-progress") &&
        (!personId || m.personId === personId)
    )
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
}

export function meetingsOn(ws: Workspace, day: string): Meeting[] {
  return upcomingMeetings(ws).filter((m) => dayOf(m.scheduledAt) === day)
}

export function lastMeetingOfType(
  ws: Workspace,
  personId: string,
  type: MeetingType
): Meeting | undefined {
  return completedMeetings(ws, personId).find((m) => m.type === type)
}

export function tenureDays(person: Person): number {
  return Math.max(0, daysSince(person.startDate))
}

export function isOnboarding(person: Person): boolean {
  return tenureDays(person) < ONBOARDING_DAYS
}

/* ------------------------------------------------------------ commitments */

export function isOverdue(c: Commitment): boolean {
  return c.status === "open" && !!c.dueDate && c.dueDate < today()
}

export function openCommitments(
  ws: Workspace,
  personId?: string
): Commitment[] {
  return ws.commitments
    .filter(
      (c) => c.status === "open" && (!personId || c.personId === personId)
    )
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
}

/**
 * How many completed 1:1s a still-open commitment has been carried through.
 * A commitment made in a meeting is not counted as carried by that meeting.
 */
export function carryCount(ws: Workspace, c: Commitment): number {
  return ws.meetings.filter(
    (m) =>
      m.personId === c.personId &&
      m.status === "completed" &&
      m.id !== c.sourceMeetingId &&
      m.scheduledAt > c.createdAt &&
      (!c.completedAt || m.scheduledAt < c.completedAt)
  ).length
}

/** Open commitments that existed before a meeting: its carried-over list. */
export function carriedInto(ws: Workspace, meeting: Meeting): Commitment[] {
  return ws.commitments.filter(
    (c) =>
      c.personId === meeting.personId &&
      c.sourceMeetingId !== meeting.id &&
      c.createdAt < (meeting.startedAt ?? meeting.scheduledAt) &&
      (c.status === "open" ||
        (!!c.completedAt &&
          c.completedAt >= (meeting.startedAt ?? meeting.scheduledAt)))
  )
}

export interface FollowThrough {
  done: number
  /** Open and past the due date. */
  missed: number
  open: number
  /** done / (done + missed), 0 to 100. Null when nothing has come due. */
  rate: number | null
}

/**
 * Follow-through for one side of the relationship. The manager's own rate
 * matters as much as the report's: dropped manager commitments erode trust.
 */
export function followThrough(
  commitments: Commitment[],
  owner: AgendaOwner,
  personId?: string
): FollowThrough {
  const list = commitments.filter(
    (c) => c.owner === owner && (!personId || c.personId === personId)
  )
  const done = list.filter((c) => c.status === "done").length
  const missed = list.filter(isOverdue).length
  const open = list.filter((c) => c.status === "open").length
  const total = done + missed
  return {
    done,
    missed,
    open,
    rate: total ? Math.round((done / total) * 100) : null,
  }
}

/* ------------------------------------------------------------------ pulses */

export function pulsesFor(ws: Workspace, personId: string): Pulse[] {
  return ws.pulses
    .filter((p) => p.personId === personId)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface PulseSummary {
  count: number
  latest?: Pulse
  /** Average of the most recent pulses (see PULSE_WINDOW). */
  energy: number | null
  workload: number | null
  /** Change in average energy against the window before. */
  energyTrend: number | null
}

export function pulseSummary(pulses: Pulse[]): PulseSummary {
  const sorted = [...pulses].sort((a, b) => a.date.localeCompare(b.date))
  const recent = sorted.slice(-PULSE_WINDOW)
  const before = sorted.slice(-PULSE_WINDOW * 2, -PULSE_WINDOW)
  const avg = (list: Pulse[], key: "energy" | "workload") =>
    list.length
      ? Math.round((list.reduce((s, p) => s + p[key], 0) / list.length) * 10) /
        10
      : null
  const energy = avg(recent, "energy")
  const prior = avg(before, "energy")
  return {
    count: sorted.length,
    latest: sorted[sorted.length - 1],
    energy,
    workload: avg(recent, "workload"),
    energyTrend:
      energy !== null && prior !== null
        ? Math.round((energy - prior) * 10) / 10
        : null,
  }
}

/* ------------------------------------------------------------- bi-temporal */

/** True when a fact with a validity range held on `day`. */
export function validOn(
  fact: { validFrom: string; validTo?: string },
  day: string
): boolean {
  return fact.validFrom <= day && (!fact.validTo || fact.validTo > day)
}

/** Status a record had on `day`, from its change history. */
export function statusAsOf<S extends string>(
  history: StatusChange<S>[],
  day: string
): S | undefined {
  let found: S | undefined
  for (const h of [...history].sort((a, b) => a.date.localeCompare(b.date))) {
    if (h.date <= day) found = h.status
  }
  return found
}

export function currentAspiration(
  ws: Workspace,
  personId: string
): Aspiration | undefined {
  return ws.aspirations
    .filter((a) => a.personId === personId && !a.validTo)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0]
}

export interface Snapshot {
  day: string
  aspiration?: Aspiration
  goals: (Goal & { statusThen: Goal["status"] })[]
  blockers: (Blocker & { statusThen: Blocker["status"]; countThen: number })[]
  milestones: (Milestone & { statusThen: Milestone["status"] })[]
  stayDrivers: StayDriver[]
  openCommitments: Commitment[]
}

/**
 * The person's record as it stood on `day`: which goals, blockers, milestones
 * and stay drivers were in force and what state they were in then.
 */
export function snapshotAsOf(
  ws: Workspace,
  personId: string,
  day: string
): Snapshot {
  const mine = <T extends { personId: string }>(list: T[]) =>
    list.filter((x) => x.personId === personId)
  return {
    day,
    aspiration: mine(ws.aspirations).find((a) => validOn(a, day)),
    goals: mine(ws.goals)
      .filter((g) => g.validFrom <= day)
      .map((g) => ({
        ...g,
        statusThen: statusAsOf(g.history, day) ?? g.status,
      }))
      .filter(
        (g) => validOn(g, day) || (g.validTo !== undefined && g.validTo === day)
      ),
    blockers: mine(ws.blockers)
      .filter((b) => validOn(b, day))
      .map((b) => ({
        ...b,
        statusThen: statusAsOf(b.history, day) ?? b.status,
        countThen: b.occurrences.filter((o) => o.date <= day).length,
      })),
    milestones: mine(ws.milestones)
      .filter((m) => m.validFrom <= day)
      .map((m) => ({
        ...m,
        statusThen: statusAsOf(m.history, day) ?? m.status,
      })),
    stayDrivers: mine(ws.stayDrivers).filter((s) => validOn(s, day)),
    openCommitments: mine(ws.commitments).filter(
      (c) =>
        dayOf(c.createdAt) <= day &&
        (c.status === "open" ||
          (c.completedAt !== undefined && dayOf(c.completedAt) > day))
    ),
  }
}

/* ---------------------------------------------------------------- timeline */

export type TimelinePillar =
  | "meeting"
  | "commitment"
  | "goal"
  | "blocker"
  | "feedback"
  | "career"
  | "workload"
  | "retention"

export interface TimelineEvent {
  id: string
  /** Day the fact took effect. */
  date: string
  pillar: TimelinePillar
  title: string
  detail?: string
  sourceMeetingId?: string
}

/** Every dated change on a person's record, newest first. */
export function timelineFor(ws: Workspace, personId: string): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const mine = <T extends { personId: string }>(list: T[]) =>
    list.filter((x) => x.personId === personId)

  for (const m of mine(ws.meetings)) {
    if (m.status === "completed")
      events.push({
        id: `${m.id}-held`,
        date: dayOf(m.scheduledAt),
        pillar: "meeting",
        title: "1:1 held",
        detail: m.summary?.topics.join(", ") || undefined,
        sourceMeetingId: m.id,
      })
    if (m.status === "cancelled")
      events.push({
        id: `${m.id}-cancelled`,
        date: dayOf(m.scheduledAt),
        pillar: "meeting",
        title: "1:1 cancelled",
        detail: m.cancelReason,
        sourceMeetingId: m.id,
      })
  }
  for (const c of mine(ws.commitments)) {
    events.push({
      id: `${c.id}-made`,
      date: dayOf(c.createdAt),
      pillar: "commitment",
      title: `${c.owner === "manager" ? "You" : "They"} committed`,
      detail: c.text,
      sourceMeetingId: c.sourceMeetingId,
    })
    if (c.completedAt)
      events.push({
        id: `${c.id}-closed`,
        date: dayOf(c.completedAt),
        pillar: "commitment",
        title: c.status === "done" ? "Commitment kept" : "Commitment dropped",
        detail: c.text,
      })
  }
  for (const g of mine(ws.goals)) {
    events.push({
      id: `${g.id}-set`,
      date: g.validFrom,
      pillar: "goal",
      title: "Goal set",
      detail: g.title,
      sourceMeetingId: g.sourceMeetingId,
    })
    g.history.slice(1).forEach((h, i) =>
      events.push({
        id: `${g.id}-h${i}`,
        date: h.date,
        pillar: "goal",
        title: `Goal marked ${h.status.replace("-", " ")}`,
        detail: h.note ? `${g.title}: ${h.note}` : g.title,
        sourceMeetingId: h.sourceMeetingId,
      })
    )
  }
  for (const b of mine(ws.blockers)) {
    b.occurrences.forEach((o, i) =>
      events.push({
        id: `${b.id}-o${i}`,
        date: o.date,
        pillar: "blocker",
        title: i === 0 ? "Blocker raised" : `Blocker raised again (${i + 1})`,
        detail: o.note ? `${b.title}: ${o.note}` : b.title,
        sourceMeetingId: o.sourceMeetingId,
      })
    )
    b.history
      .filter((h) => h.status !== "open")
      .forEach((h, i) =>
        events.push({
          id: `${b.id}-h${i}`,
          date: h.date,
          pillar: "blocker",
          title:
            h.status === "resolved" ? "Blocker resolved" : "Blocker escalated",
          detail: h.note ? `${b.title}: ${h.note}` : b.title,
          sourceMeetingId: h.sourceMeetingId,
        })
      )
  }
  for (const f of mine(ws.feedback)) {
    events.push({
      id: f.id,
      date: f.deliveredDate ?? f.observedDate,
      pillar: "feedback",
      title:
        f.direction === "upward"
          ? "Upward feedback received"
          : f.kind === "recognition"
            ? "Recognition given"
            : "Developmental feedback given",
      detail: f.behavior,
      sourceMeetingId: f.sourceMeetingId,
    })
  }
  for (const a of mine(ws.aspirations)) {
    events.push({
      id: a.id,
      date: a.validFrom,
      pillar: "career",
      title: "Aspiration recorded",
      detail: a.statement,
      sourceMeetingId: a.sourceMeetingId,
    })
  }
  for (const m of mine(ws.milestones)) {
    m.history.forEach((h, i) =>
      events.push({
        id: `${m.id}-h${i}`,
        date: h.date,
        pillar: "career",
        title:
          i === 0
            ? "Milestone added"
            : `Milestone ${h.status === "demonstrated" ? "demonstrated" : "in progress"}`,
        detail: m.title,
        sourceMeetingId: h.sourceMeetingId,
      })
    )
  }
  for (const w of mine(ws.workloadMarkers)) {
    events.push({
      id: w.id,
      date: w.date,
      pillar: "workload",
      title: "Workload pressure noted",
      detail: w.note,
      sourceMeetingId: w.sourceMeetingId,
    })
  }
  for (const s of mine(ws.stayDrivers)) {
    events.push({
      id: s.id,
      date: s.validFrom,
      pillar: "retention",
      title: "Stay driver recorded",
      detail: s.text,
      sourceMeetingId: s.sourceMeetingId,
    })
  }
  return events.sort(
    (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
  )
}
