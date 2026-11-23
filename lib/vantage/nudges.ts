import {
  BLOCKER_RECURRENCE_TRIGGER,
  CANCEL_DRIFT_WINDOW_DAYS,
  CAREER_GAP_DAYS,
  FEEDBACK_GAP_DAYS,
  FEEDBACK_WINDOW_HOURS,
  HIGH_WORKLOAD_THRESHOLD,
  LOW_ENERGY_THRESHOLD,
  ONBOARDING_CHECKPOINTS,
  STAY_INTERVAL_DAYS,
} from "@/lib/constants"
import { formatDay } from "@/lib/format"
import { addDays, dayOf, daysBetween, daysSince, today } from "@/lib/time"
import type { MeetingType, Person, Workspace } from "@/lib/types"
import { cadenceHealth } from "./cadence"
import {
  activePeople,
  isOverdue,
  lastMeetingOfType,
  pulseSummary,
  pulsesFor,
  tenureDays,
  upcomingMeetings,
} from "./selectors"

/**
 * Nudges: what the record says deserves the manager's attention. Each one is
 * derived from workspace state on every render, carries the questions that
 * fit the moment and links to where it can be acted on. A dismissed nudge id
 * stays dismissed; ids include the fact that triggered them, so a new
 * occurrence produces a new nudge.
 */

export type NudgeKind =
  | "overdue-1on1"
  | "cadence-drift"
  | "manager-commitment"
  | "recurring-blocker"
  | "career-gap"
  | "stay-interview"
  | "workload"
  | "feedback-window"
  | "feedback-gap"
  | "onboarding-checkpoint"
  | "transcript-expiring"

export type NudgeSeverity = "info" | "warning" | "danger"

export interface Nudge {
  id: string
  kind: NudgeKind
  severity: NudgeSeverity
  personId?: string
  title: string
  detail: string
  /** Where to act. */
  href: string
  actionLabel: string
  /** Question bank ids that fit this moment. */
  questionIds?: string[]
  /** Meeting type to schedule when the nudge calls for a conversation. */
  meetingType?: MeetingType
  /** Framework the rule comes from. */
  basis?: string
}

const SEVERITY_ORDER: Record<NudgeSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
}

export const nudgeKindLabels: Record<NudgeKind, string> = {
  "overdue-1on1": "Overdue 1:1",
  "cadence-drift": "Cadence drift",
  "manager-commitment": "Your commitment",
  "recurring-blocker": "Recurring blocker",
  "career-gap": "Career conversation",
  "stay-interview": "Stay interview",
  workload: "Workload",
  "feedback-window": "Feedback window",
  "feedback-gap": "Feedback gap",
  "onboarding-checkpoint": "Onboarding",
  "transcript-expiring": "Retention",
}

function first(name: string) {
  return name.split(" ")[0]
}

function hasUpcoming(ws: Workspace, personId: string, type: MeetingType) {
  return upcomingMeetings(ws, personId).some((m) => m.type === type)
}

/** Day a stay interview comes due for a person, or undefined when not yet relevant. */
export function stayInterviewDue(
  ws: Workspace,
  person: Person
): string | undefined {
  if (person.focus !== "standard") return undefined
  if (tenureDays(person) < STAY_INTERVAL_DAYS) return undefined
  const last = lastMeetingOfType(ws, person.id, "stay")
  if (last) return addDays(dayOf(last.scheduledAt), STAY_INTERVAL_DAYS)
  // Offset six months from the formal review, so the two never blur together.
  if (person.lastReviewDate)
    return addDays(person.lastReviewDate, STAY_INTERVAL_DAYS)
  return addDays(person.startDate, STAY_INTERVAL_DAYS)
}

/** Days since the last career conversation, counting from the start date when there was none. */
export function daysSinceCareer(ws: Workspace, person: Person): number {
  const last = lastMeetingOfType(ws, person.id, "career")
  const latestAspiration = ws.aspirations
    .filter((a) => a.personId === person.id)
    .map((a) => a.validFrom)
    .sort()
    .pop()
  const anchors = [
    last ? dayOf(last.scheduledAt) : undefined,
    latestAspiration,
  ].filter((d): d is string => !!d)
  const latest = anchors.sort().pop() ?? person.startDate
  return daysSince(latest)
}

function nudgesForPerson(ws: Workspace, person: Person): Nudge[] {
  const out: Nudge[] = []
  const name = first(person.name)
  const profile = `/people/profile?id=${person.id}`
  const day = today()

  /* cadence */
  const health = cadenceHealth(person, ws.meetings)
  if (health.state === "overdue" && health.lastHeldDay) {
    out.push({
      id: `overdue:${person.id}:${health.lastHeldDay}`,
      kind: "overdue-1on1",
      severity: "danger",
      personId: person.id,
      title: `No 1:1 with ${name} in ${health.daysSinceLast} days`,
      detail: `The cadence is every ${health.expectedDays} days${health.recentCancellations ? ` and ${health.recentCancellations} were cancelled` : ""}. Reschedule inside this week rather than waiting for the next slot.`,
      href: `/meetings?new=1&person=${person.id}`,
      actionLabel: "Schedule now",
      meetingType: "weekly",
      basis: "No-cancel rule",
    })
  } else if (health.state === "drifting") {
    out.push({
      id: `drift:${person.id}:${health.recentCancellations}`,
      kind: "cadence-drift",
      severity: "warning",
      personId: person.id,
      title: `${health.recentCancellations} cancelled 1:1s with ${name}`,
      detail: `That many in ${CANCEL_DRIFT_WINDOW_DAYS} days tells ${name} the conversation is optional. If the calendar is the problem, shorten the slot instead of dropping it.`,
      href: `${profile}&tab=meetings`,
      actionLabel: "Review the series",
      basis: "No-cancel rule",
    })
  } else if (health.state === "new" && !health.nextDay) {
    out.push({
      id: `first:${person.id}`,
      kind: "overdue-1on1",
      severity: "warning",
      personId: person.id,
      title: `Schedule the first 1:1 with ${name}`,
      detail: "There is no conversation on the calendar yet.",
      href: `/meetings?new=1&person=${person.id}`,
      actionLabel: "Schedule",
      meetingType: person.focus === "onboarding" ? "onboarding" : "weekly",
    })
  }

  /* manager commitments past due */
  for (const c of ws.commitments) {
    if (c.personId !== person.id || c.owner !== "manager" || !isOverdue(c))
      continue
    const late = daysBetween(c.dueDate!, day)
    out.push({
      id: `commit:${c.id}`,
      kind: "manager-commitment",
      severity: late > 5 ? "danger" : "warning",
      personId: person.id,
      title: `You owe ${name}: ${c.text}`,
      detail: `Due ${late} ${late === 1 ? "day" : "days"} ago. Dropped manager commitments cost trust faster than anything else on this list.`,
      href: `/commitments?owner=manager&person=${person.id}`,
      actionLabel: "Open commitments",
      basis: "Bilateral commitments",
    })
  }

  /* recurring blockers */
  for (const b of ws.blockers) {
    if (b.personId !== person.id || b.status === "resolved") continue
    if (b.occurrences.length < BLOCKER_RECURRENCE_TRIGGER) continue
    out.push({
      id: `blocker:${b.id}:${b.occurrences.length}`,
      kind: "recurring-blocker",
      severity: "warning",
      personId: person.id,
      title: `${name} has raised the same blocker ${b.occurrences.length} times`,
      detail: `"${b.title}" has come up since ${formatDay(b.occurrences[0].date)}. ${b.status === "escalated" ? "It is escalated; check whether that is moving." : "Coach it through with GROW, or escalate it yourself."}`,
      href: `${profile}&tab=blockers`,
      actionLabel: "Open blocker",
      questionIds: [
        "q-grow-goal",
        "q-grow-reality",
        "q-grow-options",
        "q-grow-will",
      ],
      basis: "GROW",
    })
  }

  /* career conversation */
  if (person.focus === "standard" && !hasUpcoming(ws, person.id, "career")) {
    const gap = daysSinceCareer(ws, person)
    if (gap >= CAREER_GAP_DAYS) {
      out.push({
        id: `career:${person.id}:${Math.floor(gap / CAREER_GAP_DAYS)}`,
        kind: "career-gap",
        severity: "info",
        personId: person.id,
        title: `${gap} days since a career conversation with ${name}`,
        detail: `Past ${CAREER_GAP_DAYS} days the weekly 1:1 has usually crowded growth out. Swap one regular 1:1 for a career conversation.`,
        href: `/meetings?new=1&person=${person.id}&type=career`,
        actionLabel: "Schedule career 1:1",
        questionIds: ["q-career-1", "q-career-2", "q-career-3", "q-career-4"],
        meetingType: "career",
        basis: "Quarterly career conversation",
      })
    }
  }

  /* stay interview */
  const stayDue = stayInterviewDue(ws, person)
  if (stayDue && stayDue <= day && !hasUpcoming(ws, person.id, "stay")) {
    out.push({
      id: `stay:${person.id}:${stayDue}`,
      kind: "stay-interview",
      severity: "info",
      personId: person.id,
      title: `Stay interview due with ${name}`,
      detail: `It has been ${STAY_INTERVAL_DAYS} days since the last review point. Ask the five stay questions in a conversation of their own, well away from any appraisal.`,
      href: `/meetings?new=1&person=${person.id}&type=stay`,
      actionLabel: "Schedule stay interview",
      questionIds: ["q-stay-1", "q-stay-2", "q-stay-3", "q-stay-4", "q-stay-5"],
      meetingType: "stay",
      basis: "Stay interviews",
    })
  }

  /* workload: voluntary pulses and stated pressure only */
  const pulses = pulsesFor(ws, person.id)
  const summary = pulseSummary(pulses)
  const openMarkers = ws.workloadMarkers.filter(
    (w) => w.personId === person.id && !w.resolvedDate
  )
  const lowEnergy =
    summary.energy !== null && summary.energy <= LOW_ENERGY_THRESHOLD
  const highLoad =
    summary.workload !== null && summary.workload >= HIGH_WORKLOAD_THRESHOLD
  if (
    (lowEnergy || highLoad || openMarkers.length >= 2) &&
    !hasUpcoming(ws, person.id, "burnout")
  ) {
    const parts: string[] = []
    if (summary.energy !== null && (lowEnergy || highLoad))
      parts.push(
        `${name}'s recent pulses average ${summary.energy} of 5 for energy and ${summary.workload} of 5 for workload`
      )
    if (openMarkers.length)
      parts.push(
        `${openMarkers.length} stated workload ${openMarkers.length === 1 ? "pressure is" : "pressures are"} still open`
      )
    out.push({
      id: `workload:${person.id}:${summary.latest?.date ?? openMarkers.length}`,
      kind: "workload",
      severity: lowEnergy && highLoad ? "danger" : "warning",
      personId: person.id,
      title: `Check in on ${name}'s workload`,
      detail: `${parts.join(", and ")}. Change the work before offering advice: cut scope, reprioritize, hand decisions back.`,
      href: `${profile}&tab=wellbeing`,
      actionLabel: "Open workload",
      questionIds: ["q-burn-1", "q-burn-2", "q-burn-3"],
      meetingType: "burnout",
      basis: "Voluntary pulses",
    })
  }

  /* feedback */
  const given = ws.feedback.filter(
    (f) => f.personId === person.id && f.direction === "given"
  )
  for (const f of given) {
    if (f.deliveredDate) continue
    const waited = daysSince(f.observedDate)
    out.push({
      id: `fbwindow:${f.id}`,
      kind: "feedback-window",
      severity: waited * 24 >= FEEDBACK_WINDOW_HOURS ? "danger" : "warning",
      personId: person.id,
      title: `Undelivered feedback for ${name}`,
      detail: `Observed ${waited === 0 ? "today" : `${waited} ${waited === 1 ? "day" : "days"} ago`}. Deliver it privately within ${FEEDBACK_WINDOW_HOURS} hours of the event instead of holding it for the 1:1.`,
      href: `/feedback?entry=${f.id}`,
      actionLabel: "Open feedback",
      basis: "SBII",
    })
  }
  const lastGiven = given
    .map((f) => f.deliveredDate)
    .filter((d): d is string => !!d)
    .sort()
    .pop()
  const feedbackGap = daysSince(lastGiven ?? person.startDate)
  if (
    feedbackGap >= FEEDBACK_GAP_DAYS &&
    tenureDays(person) >= FEEDBACK_GAP_DAYS
  ) {
    out.push({
      id: `fbgap:${person.id}:${lastGiven ?? "none"}`,
      kind: "feedback-gap",
      severity: "info",
      personId: person.id,
      title: `No feedback logged for ${name} in ${feedbackGap} days`,
      detail:
        "People who get meaningful feedback every week are far more engaged. Name one specific thing they did and the effect it had.",
      href: `/feedback?new=1&person=${person.id}`,
      actionLabel: "Write feedback",
      basis: "SBII",
    })
  }

  /* onboarding checkpoints */
  if (person.focus === "onboarding") {
    const tenure = tenureDays(person)
    const next = ONBOARDING_CHECKPOINTS.find(
      (d) => d >= tenure - 3 && d <= tenure + 7
    )
    if (next !== undefined && !hasUpcoming(ws, person.id, "onboarding")) {
      const inDays = next - tenure
      out.push({
        id: `onboarding:${person.id}:${next}`,
        kind: "onboarding-checkpoint",
        severity: "info",
        personId: person.id,
        title: `Day ${next} checkpoint for ${name}`,
        detail:
          inDays > 0
            ? `${name} reaches day ${next} in ${inDays} ${inDays === 1 ? "day" : "days"}. Confirm what success looks like and clear any access friction.`
            : `${name} is at day ${tenure}. Confirm what success looks like and clear any access friction.`,
        href: `/meetings?new=1&person=${person.id}&type=onboarding`,
        actionLabel: "Schedule checkpoint",
        questionIds: ["q-onb-1", "q-onb-2", "q-onb-3", "q-onb-4"],
        meetingType: "onboarding",
        basis: "30/60/90 onboarding",
      })
    }
  }

  return out
}

/** Every active nudge, most urgent first. Dismissed ones are left out. */
export function buildNudges(ws: Workspace): Nudge[] {
  const out: Nudge[] = []
  for (const person of activePeople(ws))
    out.push(...nudgesForPerson(ws, person))

  if (!ws.settings.legalHold) {
    const day = today()
    const expiring = ws.meetings.filter(
      (m) => m.transcript && daysBetween(day, m.transcript.expiresOn) <= 2
    )
    if (expiring.length) {
      out.push({
        id: `ttl:${expiring.map((m) => m.id).join(",")}`,
        kind: "transcript-expiring",
        severity: "info",
        title: `${expiring.length} ${expiring.length === 1 ? "transcript is" : "transcripts are"} about to be deleted`,
        detail:
          "Confirm the summary and any drafts you want to keep. The transcript text itself is removed on schedule.",
        href: `/meetings/session?id=${expiring[0].id}`,
        actionLabel: "Review",
        basis: "Retention schedule",
      })
    }
  }

  const dismissed = new Set(ws.settings.dismissedNudges)
  return out
    .filter((n) => !dismissed.has(n.id))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.title.localeCompare(b.title)
    )
}

export function nudgesFor(ws: Workspace, personId: string): Nudge[] {
  return buildNudges(ws).filter((n) => n.personId === personId)
}
