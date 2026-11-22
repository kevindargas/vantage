import {
  MONOLOGUE_LIMIT_SEC,
  OPEN_QUESTION_TARGET,
  TALK_SHARE_MAX,
  TALK_SHARE_MIN,
} from "@/lib/constants"
import type { Meeting, Person, TalkStats, Workspace } from "@/lib/types"
import {
  extractDrafts,
  parseTranscript,
  type Draft,
} from "@/lib/vantage/transcript"

/**
 * Helpers shared by the wrap-up panel and the coaching card. Everything here
 * is derived during render from the workspace: nothing is cached.
 */

export type DraftStatus = "pending" | "accepted" | "discarded"

export type DraftDecisions = Record<string, "accepted" | "discarded">

export interface ReviewedDraft {
  draft: Draft
  key: string
  status: DraftStatus
}

/** Drafts are re-derived on every render, so they are tracked by their quote. */
export function draftKey(draft: Draft): string {
  return `${draft.kind}:${draft.quote}`
}

function same(a: string | undefined, b: string): boolean {
  return (a ?? "").trim().toLowerCase() === b.trim().toLowerCase()
}

export interface Analysis {
  drafts: Draft[]
  droppedLines: number
  unknownSpeakers: string[]
  turns: number
}

/** Parse the stored transcript text and suggest drafts from it. */
export function analyze(
  ws: Workspace,
  meeting: Meeting,
  person: Person
): Analysis | undefined {
  const text = meeting.transcript?.text
  if (!text) return undefined
  const parsed = parseTranscript(text, ws.manager.name, person.name)
  const openBlockers = ws.blockers.filter(
    (b) => b.personId === person.id && b.status !== "resolved"
  )
  return {
    drafts: extractDrafts(parsed.turns, openBlockers),
    droppedLines: parsed.droppedLines,
    unknownSpeakers: parsed.unknownSpeakers,
    turns: parsed.turns.length,
  }
}

/**
 * True when the record a draft proposes already exists for this meeting, so
 * a reload does not offer the same suggestion twice.
 */
export function alreadyRecorded(
  ws: Workspace,
  meeting: Meeting,
  draft: Draft
): boolean {
  const here = (r: { personId: string; sourceMeetingId?: string }) =>
    r.personId === meeting.personId && r.sourceMeetingId === meeting.id
  switch (draft.kind) {
    case "commitment":
      return ws.commitments.some((c) => here(c) && same(c.text, draft.text))
    case "blocker":
      return ws.blockers.some(
        (b) =>
          b.personId === meeting.personId &&
          b.occurrences.some(
            (o) => o.sourceMeetingId === meeting.id && same(o.note, draft.quote)
          )
      )
    case "recognition":
      return ws.feedback.some(
        (f) =>
          here(f) &&
          f.direction === "given" &&
          f.kind === "recognition" &&
          same(f.behavior, draft.behavior)
      )
    case "upward":
      return ws.feedback.some(
        (f) =>
          here(f) &&
          f.direction === "upward" &&
          same(f.behavior, draft.behavior)
      )
    case "career":
      return (
        ws.aspirations.some(
          (a) => here(a) && same(a.statement, draft.statement)
        ) ||
        ws.milestones.some((m) => here(m) && same(m.title, draft.statement))
      )
    case "workload":
      return ws.workloadMarkers.some((w) => here(w) && same(w.note, draft.note))
  }
}

export function reviewDrafts(
  ws: Workspace,
  meeting: Meeting,
  drafts: Draft[],
  decisions: DraftDecisions
): ReviewedDraft[] {
  return drafts.map((draft) => {
    const key = draftKey(draft)
    const status: DraftStatus =
      decisions[key] ??
      (alreadyRecorded(ws, meeting, draft) ? "accepted" : "pending")
    return { draft, key, status }
  })
}

/**
 * The records this conversation produced, in the shape the summary and the
 * coaching engine read. Built from the workspace rather than from component
 * state, so it survives a reload, includes edits made while accepting, and
 * still works after the transcript text is gone.
 */
export function confirmedItems(ws: Workspace, meeting: Meeting): Draft[] {
  const here = (r: { personId: string; sourceMeetingId?: string }) =>
    r.personId === meeting.personId && r.sourceMeetingId === meeting.id
  const items: Draft[] = []
  let n = 0
  const id = () => `confirmed-${++n}`

  for (const b of ws.blockers) {
    if (b.personId !== meeting.personId) continue
    if (!b.occurrences.some((o) => o.sourceMeetingId === meeting.id)) continue
    items.push({
      kind: "blocker",
      id: id(),
      title: b.title,
      category: b.category,
      quote: b.title,
    })
  }
  for (const a of ws.aspirations.filter(here))
    items.push({
      kind: "career",
      id: id(),
      statement: a.statement,
      quote: a.statement,
    })
  for (const m of ws.milestones.filter(here))
    items.push({ kind: "career", id: id(), statement: m.title, quote: m.title })
  for (const w of ws.workloadMarkers.filter(here))
    items.push({
      kind: "workload",
      id: id(),
      marker: w.kind,
      dimension: w.dimension,
      note: w.note,
      quote: w.note,
    })
  for (const f of ws.feedback.filter(here)) {
    if (f.direction === "upward")
      items.push({
        kind: "upward",
        id: id(),
        behavior: f.behavior,
        quote: f.behavior,
      })
    else if (f.kind === "recognition")
      items.push({
        kind: "recognition",
        id: id(),
        behavior: f.behavior,
        quote: f.behavior,
      })
  }
  for (const c of ws.commitments.filter(here)) {
    if (c.status === "dropped") continue
    items.push({
      kind: "commitment",
      id: id(),
      owner: c.owner,
      text: c.text,
      dueDate: c.dueDate,
      quote: c.text,
    })
  }
  return items
}

export type ShareState = "below" | "in" | "above"

export function shareState(share: number): ShareState {
  if (share < TALK_SHARE_MIN) return "below"
  if (share > TALK_SHARE_MAX) return "above"
  return "in"
}

export const shareStateLabels: Record<ShareState, string> = {
  below: "Below the range",
  in: "In the range",
  above: "Above the range",
}

export function monologueOver(stats: TalkStats): boolean {
  return stats.longestManagerMonologueSec > MONOLOGUE_LIMIT_SEC
}

export function openQuestionsShort(stats: TalkStats): boolean {
  return stats.openQuestions < OPEN_QUESTION_TARGET
}

/**
 * An invitation such as "Tell me more." counts as open without ending in a
 * question mark, so the open count can pass the question count. The total
 * shown is never smaller than the open count.
 */
export function totalQuestions(stats: TalkStats): number {
  return Math.max(stats.managerQuestions, stats.openQuestions)
}
