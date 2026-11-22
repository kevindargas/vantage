import {
  MONOLOGUE_LIMIT_SEC,
  OPEN_QUESTION_TARGET,
  TALK_SHARE_MAX,
  TALK_SHARE_MIN,
} from "@/lib/constants"
import type {
  CoachingCard,
  CoachingFramework,
  Meeting,
  Person,
  TalkStats,
  Workspace,
} from "@/lib/types"
import { activePeople, completedMeetings } from "@/lib/vantage/selectors"

/**
 * What the Coaching page draws: the manager's own habits, from the talk
 * counts of analyzed conversations and the saved coaching cards. Pure.
 */

/** How many recent conversations the habit scorecard looks at. */
export const HABIT_WINDOW = 20
/** How many recent cards the recurring theme is drawn from. */
export const THEME_WINDOW = 10

export type AnalyzedMeeting = Meeting & { stats: TalkStats }

export type ShareBand = "below" | "inside" | "above"

export function shareBand(share: number): ShareBand {
  if (share < TALK_SHARE_MIN) return "below"
  if (share > TALK_SHARE_MAX) return "above"
  return "inside"
}

export interface PersonHabits {
  person: Person
  conversations: number
  share: number
  longestTurnSec: number
  openQuestions: number
}

export interface Habit {
  id: string
  label: string
  detail: string
  framework: CoachingFramework
  held: number
  total: number
}

export interface Theme {
  title: string
  body: string
  framework: CoachingFramework
  count: number
  outOf: number
}

export interface Coaching {
  /** Newest first. */
  analyzed: AnalyzedMeeting[]
  /** Newest first. */
  cards: CoachingCard[]
  averages: {
    share: number
    insideBand: number
    insideBandShare: number
    longestTurnSec: number
    openQuestions: number
  } | null
  byPerson: PersonHabits[]
  habits: Habit[]
  theme: Theme | null
}

function mean(values: number[]) {
  return values.reduce((s, v) => s + v, 0) / values.length
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

export function buildCoaching(ws: Workspace): Coaching {
  const analyzed = completedMeetings(ws).filter(
    (m): m is AnalyzedMeeting => !!m.stats
  )
  const cards = [...ws.coachingCards].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )

  const inside = analyzed.filter(
    (m) => shareBand(m.stats.reportShare) === "inside"
  ).length
  const averages = analyzed.length
    ? {
        share: Math.round(mean(analyzed.map((m) => m.stats.reportShare))),
        insideBand: inside,
        insideBandShare: Math.round((inside / analyzed.length) * 100),
        longestTurnSec: Math.round(
          mean(analyzed.map((m) => m.stats.longestManagerMonologueSec))
        ),
        openQuestions: round1(mean(analyzed.map((m) => m.stats.openQuestions))),
      }
    : null

  const byPerson: PersonHabits[] = activePeople(ws)
    .map((person) => {
      const mine = analyzed.filter((m) => m.personId === person.id)
      if (!mine.length) return null
      return {
        person,
        conversations: mine.length,
        share: Math.round(mean(mine.map((m) => m.stats.reportShare))),
        longestTurnSec: Math.round(
          mean(mine.map((m) => m.stats.longestManagerMonologueSec))
        ),
        openQuestions: round1(mean(mine.map((m) => m.stats.openQuestions))),
      }
    })
    .filter((row): row is PersonHabits => row !== null)
    .sort((a, b) => a.share - b.share)

  const recent = analyzed.slice(0, HABIT_WINDOW)
  const recentCards = cards.slice(0, HABIT_WINDOW)
  const fromStats = (test: (s: TalkStats) => boolean) => ({
    held: recent.filter((m) => test(m.stats)).length,
    total: recent.length,
  })
  const fromCards = (pattern: RegExp) => ({
    held: recentCards.filter((c) => c.strengths.some((s) => pattern.test(s)))
      .length,
    total: recentCards.length,
  })
  const habits: Habit[] = [
    {
      id: "listens",
      label: "Listens more than talks",
      detail: `They spoke ${TALK_SHARE_MIN} to ${TALK_SHARE_MAX}% of the conversation.`,
      framework: "Rogelberg",
      ...fromStats((s) => shareBand(s.reportShare) === "inside"),
    },
    {
      id: "open-questions",
      label: "Asks open questions",
      detail: `${OPEN_QUESTION_TARGET} or more questions that start with what or how.`,
      framework: "GROW",
      ...fromStats((s) => s.openQuestions >= OPEN_QUESTION_TARGET),
    },
    {
      id: "short-turns",
      label: "Keeps turns short",
      detail: `No turn of yours ran past ${MONOLOGUE_LIMIT_SEC} seconds.`,
      framework: "Rogelberg",
      ...fromStats((s) => s.longestManagerMonologueSec <= MONOLOGUE_LIMIT_SEC),
    },
    {
      id: "specific-wins",
      label: "Names specific wins",
      detail: "You recognized a piece of work by what was done and its effect.",
      framework: "SBII",
      ...fromCards(/named specific/i),
    },
    {
      id: "both-commit",
      label: "Closes with commitments on both sides",
      detail: "Each of you left with something to do.",
      framework: "Project Oxygen",
      ...fromCards(/both of you left/i),
    },
  ]

  const themeCards = cards.slice(0, THEME_WINDOW)
  const counts = new Map<string, Theme>()
  for (const card of themeCards) {
    for (const nudge of card.nudges) {
      const seen = counts.get(nudge.title)
      if (seen) seen.count += 1
      else
        counts.set(nudge.title, {
          title: nudge.title,
          body: nudge.body,
          framework: nudge.framework,
          count: 1,
          outOf: themeCards.length,
        })
    }
  }
  const theme =
    [...counts.values()].sort((a, b) => b.count - a.count)[0] ?? null

  return { analyzed, cards, averages, byPerson, habits, theme }
}
