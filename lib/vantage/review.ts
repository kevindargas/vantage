import { competencyLabels, goalStatusLabels } from "@/lib/constants"
import { formatDay } from "@/lib/format"
import { dayOf, inRange } from "@/lib/time"
import type {
  Blocker,
  CompetencyArea,
  FeedbackEntry,
  Goal,
  Milestone,
  Person,
  Workspace,
} from "@/lib/types"
import { followThrough, statusAsOf, type FollowThrough } from "./selectors"

/**
 * Evidence for a review or promotion case. This collects what is on the
 * record for a period and drafts a narrative with a source for every claim.
 * It never produces a rating, a ranking or a recommendation: the judgment
 * stays with the manager.
 */

export interface ReviewEvidence {
  person: Person
  from: string
  to: string
  meetingsHeld: number
  goals: (Goal & { statusAtEnd: Goal["status"] })[]
  recognition: FeedbackEntry[]
  developmental: FeedbackEntry[]
  upward: FeedbackEntry[]
  milestones: Milestone[]
  blockersResolved: Blocker[]
  blockersOpen: Blocker[]
  theirFollowThrough: FollowThrough
  yourFollowThrough: FollowThrough
  /** Evidence count per competency area, to show where the record is thin. */
  coverage: Record<CompetencyArea, number>
}

export function buildReviewEvidence(
  ws: Workspace,
  personId: string,
  from: string,
  to: string
): ReviewEvidence | undefined {
  const person = ws.people.find((p) => p.id === personId)
  if (!person) return undefined
  const mine = <T extends { personId: string }>(list: T[]) =>
    list.filter((x) => x.personId === personId)
  const feedback = mine(ws.feedback).filter((f) =>
    inRange(f.deliveredDate ?? f.observedDate, from, to)
  )
  const given = feedback.filter(
    (f) => f.direction === "given" && f.deliveredDate
  )
  const milestones = mine(ws.milestones).filter((m) =>
    m.history.some((h) => inRange(h.date, from, to) && h.status !== "planned")
  )
  const commitments = mine(ws.commitments).filter((c) =>
    inRange(dayOf(c.createdAt), from, to)
  )
  const coverage: Record<CompetencyArea, number> = {
    craft: 0,
    collaboration: 0,
    multiplying: 0,
  }
  for (const f of given) if (f.competency) coverage[f.competency]++
  for (const m of milestones)
    if (m.competency && m.status === "demonstrated") coverage[m.competency]++

  return {
    person,
    from,
    to,
    meetingsHeld: mine(ws.meetings).filter(
      (m) => m.status === "completed" && inRange(dayOf(m.scheduledAt), from, to)
    ).length,
    goals: mine(ws.goals)
      .filter((g) => g.validFrom <= to && (!g.validTo || g.validTo >= from))
      .map((g) => ({
        ...g,
        statusAtEnd: statusAsOf(g.history, to) ?? g.status,
      })),
    recognition: given.filter((f) => f.kind === "recognition"),
    developmental: given.filter((f) => f.kind === "developmental"),
    upward: feedback.filter((f) => f.direction === "upward"),
    milestones,
    blockersResolved: mine(ws.blockers).filter(
      (b) => b.validTo !== undefined && inRange(b.validTo, from, to)
    ),
    blockersOpen: mine(ws.blockers).filter(
      (b) => b.status !== "resolved" && b.validFrom <= to
    ),
    theirFollowThrough: followThrough(commitments, "report"),
    yourFollowThrough: followThrough(commitments, "manager"),
    coverage,
  }
}

function cite(f: FeedbackEntry) {
  return `(observed ${formatDay(f.observedDate)})`
}

/** Editable markdown draft. Every bullet carries the date it rests on. */
export function reviewMarkdown(e: ReviewEvidence): string {
  const name = e.person.name.split(" ")[0]
  const lines: string[] = [
    `# Review evidence: ${e.person.name}`,
    "",
    `Period: ${formatDay(e.from)} to ${formatDay(e.to)}. ${e.meetingsHeld} 1:1s held.`,
    "",
    "This is a draft of evidence, not an assessment. Edit it, add what is missing and decide the outcome yourself.",
    "",
    "## Goals",
  ]
  if (e.goals.length) {
    for (const g of e.goals) {
      const done = g.keyResults.filter((k) => k.done).length
      lines.push(
        `- ${g.title}: ${goalStatusLabels[g.statusAtEnd].toLowerCase()} at the end of the period${g.keyResults.length ? `, ${done} of ${g.keyResults.length} key results complete` : ""} (set ${formatDay(g.validFrom)})`
      )
      const note = g.history
        .filter((h) => h.note && inRange(h.date, e.from, e.to))
        .pop()
      if (note) lines.push(`  - ${formatDay(note.date)}: ${note.note}`)
    }
  } else lines.push("- No goals on record for this period.")

  lines.push("", "## Strengths, with evidence")
  if (e.recognition.length) {
    for (const f of e.recognition)
      lines.push(
        `- ${f.situation}: ${lower(f.behavior)}. Impact: ${lower(f.impact)}. ${cite(f)}`
      )
  } else lines.push("- No recognition was logged in this period.")

  lines.push("", "## Growth areas, with evidence")
  if (e.developmental.length) {
    for (const f of e.developmental)
      lines.push(
        `- ${f.situation}: ${lower(f.behavior)}. Impact: ${lower(f.impact)}. ${cite(f)}`
      )
  } else lines.push("- No developmental feedback was logged in this period.")

  lines.push("", "## Next-level behavior")
  const shown = e.milestones.filter((m) => m.status === "demonstrated")
  const underway = e.milestones.filter((m) => m.status === "in-progress")
  if (shown.length || underway.length) {
    for (const m of shown) {
      const when = m.history.find((h) => h.status === "demonstrated")
      lines.push(
        `- Demonstrated: ${m.title}${m.competency ? ` (${competencyLabels[m.competency].toLowerCase()})` : ""}${when ? `, ${formatDay(when.date)}` : ""}`
      )
      for (const ev of m.evidence)
        lines.push(`  - ${formatDay(ev.date)}: ${ev.note}`)
    }
    for (const m of underway) lines.push(`- In progress: ${m.title}`)
  } else lines.push("- No milestones moved in this period.")

  lines.push("", "## Follow-through")
  const rate = (f: FollowThrough) =>
    f.rate === null
      ? "nothing came due"
      : `${f.done} kept, ${f.missed} past due (${f.rate}%)`
  lines.push(
    `- ${name}'s commitments: ${rate(e.theirFollowThrough)}`,
    `- Your commitments to ${name}: ${rate(e.yourFollowThrough)}`
  )

  lines.push("", "## Obstacles outside their control")
  const obstacles = [...e.blockersResolved, ...e.blockersOpen]
  if (obstacles.length) {
    for (const b of obstacles)
      lines.push(
        `- ${b.title}: raised ${b.occurrences.length} ${b.occurrences.length === 1 ? "time" : "times"} since ${formatDay(b.validFrom)}, ${b.status}`
      )
  } else lines.push("- None on record.")

  const thin = (Object.keys(e.coverage) as CompetencyArea[]).filter(
    (k) => e.coverage[k] === 0
  )
  if (thin.length) {
    lines.push(
      "",
      "## Gaps in the record",
      `- No dated evidence yet for: ${thin.map((k) => competencyLabels[k].toLowerCase()).join(", ")}. Add observations before drawing a conclusion.`
    )
  }
  return lines.join("\n")
}

function lower(text: string) {
  const t = text.trim().replace(/[.]+$/, "")
  return t.charAt(0).toLowerCase() + t.slice(1)
}

const VAGUE: { re: RegExp; why: string }[] = [
  {
    re: /\b(always|never|constantly|all the time)\b/gi,
    why: "Absolute. Name the occasions instead.",
  },
  {
    re: /\b(great|good|bad|poor|nice|excellent|amazing) (attitude|job|work|performance|energy)\b/gi,
    why: "A judgment without a behavior. Say what they did.",
  },
  {
    re: /\b(team player|rock ?star|natural leader|not a (good )?fit|difficult|lazy|abrasive|emotional|aggressive)\b/gi,
    why: "A label about character. Describe an observable behavior and its impact.",
  },
  {
    re: /\b(needs to (improve|step up|do better)|should be more|must try harder)\b/gi,
    why: "No direction. State the behavior you want to see.",
  },
  {
    re: /\b(seems|appears|i feel like|i think (he|she|they))\b/gi,
    why: "An impression. Anchor it to a dated example.",
  },
  {
    re: /\b(meets|exceeds|below) expectations\b|\b[1-5] ?(\/|out of) ?5\b|\brating\b/gi,
    why: "A rating. Vantage drafts evidence only; ratings are decided outside this document.",
  },
]

export interface WordingFlag {
  phrase: string
  why: string
  index: number
}

/** Phrases in a review draft that are vague, absolute or about character. */
export function flagWording(text: string): WordingFlag[] {
  const flags: WordingFlag[] = []
  for (const { re, why } of VAGUE) {
    for (const m of text.matchAll(re))
      flags.push({ phrase: m[0], why, index: m.index ?? 0 })
  }
  return flags.sort((a, b) => a.index - b.index)
}
