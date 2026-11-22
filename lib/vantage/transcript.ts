import {
  MONOLOGUE_LIMIT_SEC,
  OPEN_QUESTION_TARGET,
  SENSITIVE_MEETING_TYPES,
  TALK_SHARE_MAX,
  TALK_SHARE_MIN,
  WORDS_PER_MINUTE,
} from "@/lib/constants"
import { formatDay } from "@/lib/format"
import { addDays, parseDay, toDay, today } from "@/lib/time"
import type {
  AgendaOwner,
  Blocker,
  BlockerCategory,
  BurnoutDimension,
  CoachingNudge,
  MeetingType,
  TalkStats,
  WorkloadMarkerKind,
} from "@/lib/types"

/**
 * Transcript analysis. Everything here runs in the browser on the text the
 * manager pastes: nothing is uploaded. The analysis is lexical and
 * structural only. It counts words, turns and questions and looks for stated
 * commitments, blockers and workload pressure. It never reads tone, stress or
 * sentiment, and it never labels how a person feels.
 *
 * Every extracted item is a draft. Nothing reaches the record until the
 * manager confirms it.
 */

export interface Turn {
  speaker: AgendaOwner
  /** Speaker label as written in the transcript. */
  label: string
  text: string
  /** Seconds from the start, when the line carried a timestamp. */
  startSec?: number
}

const PAUSE_ON = /^\s*\[?\s*(paused?|off the record|capture paused)\s*\]?\s*$/i
const PAUSE_OFF =
  /^\s*\[?\s*(resumed?|on the record|capture resumed)\s*\]?\s*$/i
const STAMP = /^\s*\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*/
const SPEAKER =
  /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{0,40}?)\s*(?:\((?:manager|me)\))?\s*:\s+(.*)$/

/** Line prefixes that look like a speaker label and are not one. */
const NOT_SPEAKERS = new Set([
  "note",
  "notes",
  "action",
  "action item",
  "action items",
  "summary",
  "agenda",
  "todo",
  "topic",
  "ps",
  "fyi",
])

function firstName(name: string) {
  return name.trim().split(/\s+/)[0]?.toLowerCase() ?? ""
}

function words(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

/**
 * Parse "Name: text" lines into turns. Lines may start with a `[mm:ss]` or
 * `hh:mm:ss` stamp. Lines between a `[paused]` and a `[resumed]` marker were
 * off the record and are dropped. A line without a speaker continues the
 * previous turn.
 */
export function parseTranscript(
  raw: string,
  managerName: string,
  reportName: string
): { turns: Turn[]; droppedLines: number; unknownSpeakers: string[] } {
  const managerKeys = new Set([
    "manager",
    "me",
    "mgr",
    firstName(managerName),
    managerName.toLowerCase(),
  ])
  const reportKeys = new Set([
    "report",
    "employee",
    firstName(reportName),
    reportName.toLowerCase(),
  ])
  const turns: Turn[] = []
  const unknown = new Set<string>()
  let paused = false
  let dropped = 0

  for (const rawLine of raw.split(/\r?\n/)) {
    let line = rawLine.trim()
    if (!line) continue
    if (PAUSE_ON.test(line)) {
      paused = true
      continue
    }
    if (PAUSE_OFF.test(line)) {
      paused = false
      continue
    }
    if (paused) {
      dropped++
      continue
    }
    let startSec: number | undefined
    const stamp = STAMP.exec(line)
    if (stamp) {
      const a = Number(stamp[1])
      const b = Number(stamp[2])
      const c = stamp[3] === undefined ? undefined : Number(stamp[3])
      startSec = c === undefined ? a * 60 + b : a * 3600 + b * 60 + c
      line = line.slice(stamp[0].length)
    }
    const candidate = SPEAKER.exec(line)
    const match =
      candidate && !NOT_SPEAKERS.has(candidate[1].trim().toLowerCase())
        ? candidate
        : null
    if (!match) {
      const prev = turns[turns.length - 1]
      if (prev) prev.text = `${prev.text} ${line}`
      continue
    }
    const label = match[1].trim()
    const key = label.toLowerCase()
    let speaker: AgendaOwner
    if (managerKeys.has(key) || managerKeys.has(firstName(label))) {
      speaker = "manager"
    } else if (reportKeys.has(key) || reportKeys.has(firstName(label))) {
      speaker = "report"
    } else {
      unknown.add(label)
      // In a 1:1 the only other voice is the direct report.
      speaker = "report"
    }
    const prev = turns[turns.length - 1]
    if (prev && prev.speaker === speaker && startSec === undefined) {
      prev.text = `${prev.text} ${match[2]}`
    } else {
      turns.push({ speaker, label, text: match[2], startSec })
    }
  }
  return { turns, droppedLines: dropped, unknownSpeakers: [...unknown] }
}

const OPEN_STARTS =
  /^(what|how|why|where|which|who|tell me|walk me|describe|help me understand|say more|in what way|if you)\b/i

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** A question that invites more than yes or no. */
export function isOpenQuestion(sentence: string): boolean {
  const s = sentence.trim()
  if (!s.endsWith("?")) return /^(tell me|walk me|describe|say more)\b/i.test(s)
  return OPEN_STARTS.test(s.replace(/^(so|and|okay|ok|well|right)[, ]+/i, ""))
}

export function talkStats(turns: Turn[]): TalkStats {
  let managerWords = 0
  let reportWords = 0
  let longest = 0
  let managerQuestions = 0
  let openQuestions = 0

  // Consecutive manager turns with nobody else speaking are one stretch.
  let runWords = 0
  let runStart: number | undefined
  const closeRun = (nextStart?: number) => {
    if (!runWords) return
    const timed =
      runStart !== undefined && nextStart !== undefined
        ? nextStart - runStart
        : undefined
    const seconds =
      timed !== undefined && timed > 0
        ? timed
        : Math.round((runWords / WORDS_PER_MINUTE) * 60)
    longest = Math.max(longest, seconds)
    runWords = 0
    runStart = undefined
  }

  for (const turn of turns) {
    const count = words(turn.text)
    if (turn.speaker === "manager") {
      managerWords += count
      if (!runWords) runStart = turn.startSec
      runWords += count
      for (const sentence of splitSentences(turn.text)) {
        // "Tell me more." invites an answer as much as a question mark does.
        const open = isOpenQuestion(sentence)
        if (sentence.endsWith("?") || open) managerQuestions++
        if (open) openQuestions++
      }
    } else {
      closeRun(turn.startSec)
      reportWords += count
    }
  }
  closeRun()

  const total = managerWords + reportWords
  const stamps = turns
    .map((t) => t.startSec)
    .filter((s): s is number => s !== undefined)
  const timedMinutes =
    stamps.length >= 2 ? (Math.max(...stamps) - Math.min(...stamps)) / 60 : 0
  return {
    reportShare: total ? Math.round((reportWords / total) * 100) : 0,
    managerWords,
    reportWords,
    longestManagerMonologueSec: longest,
    managerQuestions,
    openQuestions,
    turns: turns.length,
    estimatedMinutes: Math.max(
      1,
      Math.round(Math.max(timedMinutes, total / WORDS_PER_MINUTE))
    ),
  }
}

/* ------------------------------------------------------------------ drafts */

export interface CommitmentDraft {
  kind: "commitment"
  id: string
  owner: AgendaOwner
  text: string
  dueDate?: string
  quote: string
}

export interface BlockerDraft {
  kind: "blocker"
  id: string
  title: string
  category: BlockerCategory
  /** Existing open blocker this looks like a repeat of. */
  matchesBlockerId?: string
  quote: string
}

export interface RecognitionDraft {
  kind: "recognition"
  id: string
  behavior: string
  quote: string
}

export interface CareerDraft {
  kind: "career"
  id: string
  statement: string
  quote: string
}

export interface WorkloadDraft {
  kind: "workload"
  id: string
  marker: WorkloadMarkerKind
  dimension?: BurnoutDimension
  note: string
  quote: string
}

export interface UpwardDraft {
  kind: "upward"
  id: string
  behavior: string
  quote: string
}

export type Draft =
  | CommitmentDraft
  | BlockerDraft
  | RecognitionDraft
  | CareerDraft
  | WorkloadDraft
  | UpwardDraft

const COMMIT =
  /\b(i'll|i will|i can take|i'm going to|i am going to|let me|i commit to|i'll make sure|i will make sure|leave (it|that) with me|i'll follow up|i will follow up|action item)\b/i
const NOT_COMMIT =
  /\b(i'll be honest|i will say|let me think|let me know|let me ask you|i'll admit)\b/i
const BLOCK =
  /\b(blocked|blocker|blocking|waiting on|waiting for|stuck|can't move|cannot move|held up|slowing (me|us) down|getting in (my|the) way|bottleneck|dependency on|depends on|no access|don't have access|unclear (who|what|which)|keeps? changing)\b/i
const PRAISE =
  /\b(great job|great work|nice work|well done|really appreciate|i appreciated|thank you for|thanks for|impressed|excellent work|you did a great|the way you|huge help|made a real difference)\b/i
const CAREER =
  /\b(i want to (grow|become|move into|lead|learn)|i'd like to (grow|become|move into|lead|learn)|i would like to (grow|become|move into|lead|learn)|next level|promotion|promoted|career|staff engineer|principal|management track|manage a team|tech lead|stretch (project|assignment)|long term i)\b/i
const UPWARD =
  /\b(it would help (me )?if you|i'd prefer (it )?if you|i wish you|when you (changed|cancel|skipped|jumped)|it was hard(er)? when you|could you (stop|start|give me more|give me less))\b/i

const NOT_BLOCKED =
  /\b(nothing|nobody|no one|no longer|not (blocked|stuck|waiting|a blocker)|isn't (blocked|blocking|a blocker)|aren't (blocked|waiting)|unblocked|fine now|sorted now|got resolved|is resolved|was resolved)\b/i
const DECLINED =
  /\b(will not|won't|can't|cannot|not going to|not able to|unable to)\b/i
const NOT_PRAISE =
  /\bthank(s| you) for (saying|asking|sharing that|that|the time|your time|flagging|telling me|letting me know|raising|being (open|honest))\b/i
const FIRST_PERSON = /\b(i|i'd|i'm|i've|my|me)\b/i
const NO_LONGER =
  /\b(fine now|no longer|not anymore|any more|isn't|wasn't|used to be|is better|got better|eased)\b/i

const WORKLOAD: {
  re: RegExp
  marker: WorkloadMarkerKind
  dimension?: BurnoutDimension
}[] = [
  {
    re: /\b(working (late|nights|evenings|weekends)|late nights|over the weekend|after hours|until midnight)\b/i,
    marker: "after-hours",
    dimension: "exhaustion",
  },
  {
    re: /\b(context[- ]switch|too many (projects|things|meetings)|pulled in (too many|every) direction|spread (too )?thin|juggling)\b/i,
    marker: "context-switching",
    dimension: "exhaustion",
  },
  {
    re: /\b(crunch|deadline after deadline|back[- ]to[- ]back (launches|deadlines)|nonstop|non-stop)\b/i,
    marker: "crunch",
    dimension: "exhaustion",
  },
  {
    re: /\b(haven't taken (any )?(time off|pto|vacation|a day off)|no time off|can't take time off|need a break)\b/i,
    marker: "pto-gap",
    dimension: "exhaustion",
  },
  {
    re: /\b(too much on my plate|overloaded|overwhelmed|more than i can|can't keep up|scope keeps growing|keeps? getting added)\b/i,
    marker: "scope-growth",
    dimension: "exhaustion",
  },
  {
    re: /\b(on[- ]call|paged|pager)\b/i,
    marker: "on-call",
    dimension: "exhaustion",
  },
  {
    re: /\b(what's the point|feels pointless|don't see the point|doesn't matter anymore|stopped caring)\b/i,
    marker: "scope-growth",
    dimension: "cynicism",
  },
  {
    re: /\b(nothing i do (lands|works|matters)|not making (any )?progress|can't seem to get anything done|don't feel (effective|useful))\b/i,
    marker: "context-switching",
    dimension: "efficacy",
  },
]

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]

/** Due day mentioned in a sentence ("by Friday", "tomorrow", "by March 3"). */
export function parseDueDate(
  sentence: string,
  base: string = today()
): string | undefined {
  const s = sentence.toLowerCase()
  if (/\btoday\b|\bend of (the )?day\b|\beod\b/.test(s)) return base
  if (/\btomorrow\b/.test(s)) return addDays(base, 1)
  const baseDate = parseDay(base)
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const re = new RegExp(`\\b(by|on|before|this|next)\\s+${WEEKDAYS[i]}\\b`)
    if (re.test(s)) {
      let offset = (i - baseDate.getDay() + 7) % 7
      if (offset === 0) offset = 7
      if (new RegExp(`\\bnext\\s+${WEEKDAYS[i]}\\b`).test(s) && offset < 7)
        offset += 7
      return addDays(base, offset)
    }
  }
  if (/\b(end of (the |this )?week|eow|this week)\b/.test(s)) {
    const offset = (5 - baseDate.getDay() + 7) % 7
    return addDays(base, offset)
  }
  if (/\bnext week\b/.test(s)) {
    const offset = ((5 - baseDate.getDay() + 7) % 7) + 7
    return addDays(base, offset)
  }
  if (/\bend of (the |this )?month\b/.test(s)) {
    return toDay(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0))
  }
  for (let i = 0; i < MONTHS.length; i++) {
    const re = new RegExp(
      `\\b(?:by|on|before|until|due)\\s+(?:the\\s+)?(?:${MONTHS[i]}|${MONTHS[i].slice(0, 3)})\\.?\\s+(\\d{1,2})\\b`
    )
    const m = re.exec(s)
    if (m) {
      const candidate = new Date(baseDate.getFullYear(), i, Number(m[1]))
      if (toDay(candidate) < base)
        candidate.setFullYear(candidate.getFullYear() + 1)
      return toDay(candidate)
    }
  }
  return undefined
}

const STOP = new Set(
  "the a an and or but to of in on for with from that this it is are was were be been i you we they he she my our your their me us them so just really very have has had do does did not no can could should would will about at as by if then than there here what when which who how up out into over still keep keeps get gets got going".split(
    " "
  )
)

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  )
}

/** Share of the smaller keyword set that both texts have in common. */
export function overlap(a: string, b: string): number {
  const ka = keywords(a)
  const kb = keywords(b)
  if (!ka.size || !kb.size) return 0
  let shared = 0
  ka.forEach((w) => {
    if (kb.has(w)) shared++
  })
  return shared / Math.min(ka.size, kb.size)
}

function blockerCategory(sentence: string): BlockerCategory {
  const s = sentence.toLowerCase()
  if (
    /\b(team|waiting on|waiting for|dependency|depends on|approval|sign[- ]off|review from)\b/.test(
      s
    )
  )
    return "cross-team"
  if (
    /\b(tool|access|pipeline|build|environment|laptop|license|ci|deploy)\b/.test(
      s
    )
  )
    return "tooling"
  if (
    /\b(unclear|ambiguous|priorit|keeps? changing|requirements|spec)\b/.test(s)
  )
    return "clarity"
  if (/\b(process|procedure|ticket|form|sign off|bureaucra)\b/.test(s))
    return "process"
  if (/\b(time|capacity|bandwidth|too much|headcount)\b/.test(s))
    return "capacity"
  return "other"
}

function tidy(sentence: string): string {
  const s = sentence
    .replace(
      /^(so|and|okay|ok|well|yeah|yes|right|also|honestly|i think|i guess)[, ]+/i,
      ""
    )
    .trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function commitmentText(sentence: string, owner: AgendaOwner): string {
  const s = tidy(sentence)
    .replace(/^action item:?\s*/i, "")
    .replace(
      /^(i'll make sure|i will make sure|i'll|i will|i'm going to|i am going to|i can take|let me|i commit to)\s+/i,
      ""
    )
    .replace(/[.!]+$/, "")
  const text = s.charAt(0).toUpperCase() + s.slice(1)
  return owner === "manager" ? text : text
}

/**
 * Draft records suggested by a transcript. `openBlockers` lets a repeat of a
 * known blocker be offered as a new occurrence instead of a duplicate.
 */
export function extractDrafts(
  turns: Turn[],
  openBlockers: Pick<Blocker, "id" | "title">[] = [],
  base: string = today()
): Draft[] {
  const drafts: Draft[] = []
  const seen = new Set<string>()
  let n = 0
  const push = (draft: Draft) => {
    const key = `${draft.kind}:${draft.kind === "workload" ? draft.marker : ""}:${draft.quote.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    drafts.push(draft)
  }

  for (const turn of turns) {
    for (const sentence of splitSentences(turn.text)) {
      if (words(sentence) < 4) continue
      const quote = sentence
      const id = () => `d-${++n}`

      if (
        COMMIT.test(sentence) &&
        !NOT_COMMIT.test(sentence) &&
        !DECLINED.test(sentence) &&
        !sentence.endsWith("?")
      ) {
        push({
          kind: "commitment",
          id: id(),
          owner: turn.speaker,
          text: commitmentText(sentence, turn.speaker),
          dueDate: parseDueDate(sentence, base),
          quote,
        })
        continue
      }
      if (turn.speaker === "report") {
        const loads = NO_LONGER.test(sentence)
          ? []
          : WORKLOAD.filter(
              (w, i, all) =>
                w.re.test(sentence) &&
                all.findIndex(
                  (o) => o.marker === w.marker && o.re.test(sentence)
                ) === i
            )
        if (loads.length) {
          for (const load of loads)
            push({
              kind: "workload",
              id: id(),
              marker: load.marker,
              dimension: load.dimension,
              note: tidy(sentence),
              quote,
            })
          continue
        }
        if (BLOCK.test(sentence) && !NOT_BLOCKED.test(sentence)) {
          const title = tidy(sentence).replace(/[.!]+$/, "")
          const match = openBlockers
            .map((b) => ({ id: b.id, score: overlap(b.title, sentence) }))
            .sort((a, b) => b.score - a.score)[0]
          push({
            kind: "blocker",
            id: id(),
            title: title.length > 110 ? `${title.slice(0, 107)}...` : title,
            category: blockerCategory(sentence),
            matchesBlockerId:
              match && match.score >= 0.5 ? match.id : undefined,
            quote,
          })
          continue
        }
        if (UPWARD.test(sentence)) {
          push({ kind: "upward", id: id(), behavior: tidy(sentence), quote })
          continue
        }
        if (CAREER.test(sentence) && FIRST_PERSON.test(sentence)) {
          push({ kind: "career", id: id(), statement: tidy(sentence), quote })
          continue
        }
      } else if (PRAISE.test(sentence) && !NOT_PRAISE.test(sentence)) {
        push({ kind: "recognition", id: id(), behavior: tidy(sentence), quote })
      }
    }
  }
  return drafts
}

const TOPIC_LABELS: Record<Draft["kind"], string> = {
  commitment: "Commitments",
  blocker: "Blockers",
  recognition: "Recognition",
  career: "Career and growth",
  workload: "Workload",
  upward: "Feedback for the manager",
}

/** Topic headings and a plain shared summary built from confirmed drafts. */
export function buildSummary(
  drafts: Draft[],
  names: { manager: string; report: string }
): { topics: string[]; text: string } {
  const order: Draft["kind"][] = [
    "blocker",
    "career",
    "workload",
    "recognition",
    "upward",
    "commitment",
  ]
  const topics: string[] = []
  const lines: string[] = []
  for (const kind of order) {
    const items = drafts.filter((d) => d.kind === kind)
    if (!items.length) continue
    topics.push(TOPIC_LABELS[kind])
    lines.push(`${TOPIC_LABELS[kind]}`)
    for (const d of items) {
      if (d.kind === "commitment") {
        const who = d.owner === "manager" ? names.manager : names.report
        lines.push(
          `- ${who}: ${d.text}${d.dueDate ? ` (due ${formatDay(d.dueDate)})` : ""}`
        )
      } else if (d.kind === "blocker") lines.push(`- ${d.title}`)
      else if (d.kind === "workload") lines.push(`- ${d.note}`)
      else if (d.kind === "career") lines.push(`- ${d.statement}`)
      else lines.push(`- ${d.behavior}`)
    }
    lines.push("")
  }
  return { topics, text: lines.join("\n").trim() }
}

/* ---------------------------------------------------------------- coaching */

/**
 * Private coaching for the manager from the shape of the conversation. Reads
 * only counts: who spoke how much, how long, and what kind of questions.
 */
export function coachingFor(
  stats: TalkStats,
  drafts: Draft[]
): { nudges: CoachingNudge[]; strengths: string[] } {
  const nudges: CoachingNudge[] = []
  const strengths: string[] = []

  if (stats.reportShare < TALK_SHARE_MIN) {
    nudges.push({
      framework: "Rogelberg",
      title: "Give them more of the floor",
      body: `They spoke ${stats.reportShare}% of the time. The useful range is ${TALK_SHARE_MIN} to ${TALK_SHARE_MAX}%. Next time open with their agenda, ask one question, then wait through the pause before you add anything.`,
    })
  } else if (stats.reportShare > TALK_SHARE_MAX) {
    nudges.push({
      framework: "Project Oxygen",
      title: "Leave room for your context",
      body: `They spoke ${stats.reportShare}% of the time. That is generous listening, but they also need the decisions and context only you can give. Keep a few minutes for it.`,
    })
  } else {
    strengths.push(
      `They spoke ${stats.reportShare}% of the time, inside the ${TALK_SHARE_MIN} to ${TALK_SHARE_MAX}% range.`
    )
  }

  if (stats.longestManagerMonologueSec > MONOLOGUE_LIMIT_SEC) {
    nudges.push({
      framework: "Rogelberg",
      title: "Break up the long stretch",
      body: `Your longest turn ran about ${Math.round((stats.longestManagerMonologueSec / 60) * 10) / 10} minutes. After ${MONOLOGUE_LIMIT_SEC} seconds, stop and ask what they make of it.`,
    })
  } else if (stats.managerWords > 0) {
    strengths.push("No turn of yours ran long enough to become a monologue.")
  }

  if (stats.openQuestions < OPEN_QUESTION_TARGET) {
    nudges.push({
      framework: "GROW",
      title: "Ask more open questions",
      body: `You asked ${stats.openQuestions} open ${stats.openQuestions === 1 ? "question" : "questions"} out of ${stats.managerQuestions}. Aim for at least ${OPEN_QUESTION_TARGET} that start with what or how, such as: what have you tried so far, and what happened?`,
    })
  } else {
    strengths.push(
      `You asked ${stats.openQuestions} open questions, which keeps the thinking with them.`
    )
  }

  if (!drafts.some((d) => d.kind === "recognition")) {
    nudges.push({
      framework: "SBII",
      title: "Name one specific win",
      body: "No recognition came through in this conversation. Open the next one with a single piece of praise that names the situation, what they did and the effect it had.",
    })
  } else {
    strengths.push("You named specific work that went well.")
  }

  const mine = drafts.filter(
    (d) => d.kind === "commitment" && d.owner === "manager"
  ).length
  const theirs = drafts.filter(
    (d) => d.kind === "commitment" && d.owner === "report"
  ).length
  if (mine + theirs === 0) {
    nudges.push({
      framework: "Rogelberg",
      title: "Close with commitments",
      body: "The conversation ended without a clear commitment from either side. Use the last three minutes to say who will do what by when.",
    })
  } else if (mine === 0) {
    nudges.push({
      framework: "Project Oxygen",
      title: "Take something off their plate",
      body: "Every commitment landed on them. Ask what you can remove or escalate, and own one item yourself.",
    })
  } else {
    strengths.push("Both of you left with something to do.")
  }

  return { nudges: nudges.slice(0, 3), strengths }
}

/* ------------------------------------------------------------- sensitivity */

/**
 * True when a conversation must not offer transcript capture: a sensitive
 * meeting type, or a title or note that contains a configured keyword.
 */
export function isSensitive(
  type: MeetingType,
  text: string,
  keywords: string[]
): { sensitive: boolean; reason?: string } {
  if (SENSITIVE_MEETING_TYPES.includes(type))
    return {
      sensitive: true,
      reason: "Performance conversations are documented by hand.",
    }
  const hit = keywords.find((k) => {
    const word = k.trim()
    if (!word) return false
    const re = new RegExp(
      `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    )
    return re.test(text)
  })
  return hit
    ? { sensitive: true, reason: `The agenda mentions "${hit}".` }
    : { sensitive: false }
}

/** A short two-person transcript used by the "load an example" button. */
export function sampleTranscript(manager: string, report: string): string {
  const m = manager.split(" ")[0]
  const r = report.split(" ")[0]
  return [
    `[00:00] ${m}: Morning. How was the long weekend?`,
    `[00:12] ${r}: Good, we finally got out to the coast. I needed it.`,
    `[00:30] ${m}: Glad to hear it. Before we start, the way you ran the incident review last Thursday made a real difference. You kept it on facts and the team left with three clear fixes.`,
    `[00:55] ${r}: Thanks, that means a lot. I was nervous about it.`,
    `[01:05] ${m}: What is the most important thing we should talk about today?`,
    `[01:15] ${r}: The migration. I'm still blocked on the platform team approving the pipeline change, it is the third week now and I can't move the rollout forward without it.`,
    `[01:50] ${m}: What have you tried so far, and what happened?`,
    `[02:00] ${r}: I posted in their channel twice and opened a ticket. No owner yet. Honestly I'm also juggling the audit work and two reviews, so I'm spread thin and have been working evenings to keep up.`,
    `[02:40] ${m}: That is not sustainable. If you had full authority here, what would you drop first?`,
    `[02:55] ${r}: The audit prep could move a sprint. Nobody is waiting on it yet.`,
    `[03:10] ${m}: Then let's move it. I'll talk to the platform lead and get an owner named by Thursday.`,
    `[03:25] ${r}: That would help a lot. I'll write up the rollout plan so it is ready the moment we have approval, by Friday.`,
    `[03:45] ${m}: How are you feeling about the staff track conversation we had last month?`,
    `[03:58] ${r}: Still keen. I want to lead the design review for the new ingestion service, I think that is the stretch project that shows the next level.`,
    `[04:20] ${m}: Good. Let me check who is chairing that and see if we can make it yours.`,
    `[04:35] ${r}: One thing for you: it would help if you gave me more notice when priorities change. Last week's switch landed on a Friday afternoon.`,
    `[04:55] ${m}: That is fair, and thank you for saying it. I'll flag changes at the start of the week from now on. Anything else I can do to support you?`,
    `[05:10] ${r}: No, that covers it.`,
  ].join("\n")
}
