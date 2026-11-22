import {
  DEFAULT_SENSITIVE_KEYWORDS,
  TRANSCRIPT_TTL_RANGE,
} from "@/lib/constants"
import {
  addDays,
  atTime,
  dayOf,
  parseDay,
  quarterOf,
  today as todayDay,
} from "@/lib/time"
import type {
  AgendaItem,
  AgendaOwner,
  Blocker,
  CoachingCard,
  Commitment,
  ConsentEvent,
  FeedbackEntry,
  Goal,
  GoalStatus,
  Meeting,
  MeetingType,
  Milestone,
  MilestoneStatus,
  Person,
  Pulse,
  TalkStats,
  Workspace,
} from "@/lib/types"
import { intervalDays } from "./cadence"
import {
  coachingFor,
  parseTranscript,
  sampleTranscript,
  talkStats,
  type Draft,
} from "./transcript"

/**
 * The sample team a new workspace starts with. Every date is relative to the
 * day it is generated, so the stories stay current: a blocker in its third
 * week, an overdue 1:1, a new hire at day 38, a stay interview that has come
 * due. After generation it is ordinary workspace data and is saved like any
 * other.
 */

function createRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n))

interface PersonSpec {
  key: string
  person: Omit<
    Person,
    "id" | "createdAt" | "status" | "cadence" | "startDate"
  > & {
    startDaysAgo: number
    frequency: Person["cadence"]["frequency"]
    durationMin: number
    /** Offset in working days from the next working day. */
    dayOffset: number
    time: string
    lastReviewDaysAgo?: number
  }
  /** Mean share of the conversation the direct report speaks. */
  talkShare: number
  /** Held 1:1s to generate, newest first is slot 0. */
  slots: number
  /** Slot indexes that were cancelled instead of held. */
  cancelled?: Record<number, string>
  /** Meeting type per slot index; weekly otherwise. */
  types?: Record<number, MeetingType>
  /** Energy and workload per held slot, oldest first. */
  energy: number[]
  workload: number[]
  /** Leave the person without a scheduled next meeting. */
  noUpcoming?: boolean
  upcomingType?: MeetingType
  upcomingAgenda?: [AgendaOwner, string][]
  notes: string[]
}

const NOTES = [
  "Walked through their items first. Agreed next steps and owners before closing.",
  "Most of the time went to one topic. Checked the clock at the midpoint and they chose to stay on it.",
  "Good energy. Covered the open commitments, then their priorities for the week.",
  "Shorter session. Cleared two carried items and confirmed the plan for the release.",
]

export function buildSampleWorkspace(): Workspace {
  const rng = createRng(20261122)
  const today = todayDay()
  const ago = (n: number) => addDays(today, -n)
  const at = (day: string, time = "09:00") => atTime(day, time)

  // The next working day anchors the series so some 1:1s land on it.
  const weekdayOfToday = parseDay(today).getDay()
  const nextWorkingDay =
    weekdayOfToday === 6
      ? addDays(today, 2)
      : weekdayOfToday === 0
        ? addDays(today, 1)
        : today
  const workingDayPlus = (offset: number) => {
    let day = nextWorkingDay
    for (let i = 0; i < offset; i++) {
      day = addDays(day, 1)
      while ([0, 6].includes(parseDay(day).getDay())) day = addDays(day, 1)
    }
    return day
  }

  const specs: PersonSpec[] = [
    {
      key: "maya",
      person: {
        name: "Maya Chen",
        email: "maya.chen@example.com",
        role: "Senior Software Engineer",
        level: "L5",
        team: "Platform",
        location: "Toronto",
        startDaysAgo: 912,
        workMode: "hybrid",
        profile: "established-ic",
        focus: "standard",
        frequency: "weekly",
        durationMin: 30,
        dayOffset: 0,
        time: "09:30",
        recognitionPref: "private",
        feedbackStyle: "Direct and in writing first, then a conversation.",
        rapportNotes:
          "Climbs on weekends. Partner is finishing a residency. Prefers mornings.",
        lastReviewDaysAgo: 62,
      },
      talkShare: 63,
      slots: 10,
      types: { 5: "career" },
      energy: [4, 4, 4, 3, 4, 3, 3, 3, 3, 3],
      workload: [3, 3, 3, 3, 3, 4, 4, 4, 4, 4],
      upcomingAgenda: [
        ["report", "Pipeline approval is still stuck with the platform team"],
        ["report", "Design review for the ingestion service"],
        ["manager", "Feedback on last week's incident review"],
      ],
      notes: NOTES,
    },
    {
      key: "diego",
      person: {
        name: "Diego Ramírez",
        email: "diego.ramirez@example.com",
        role: "Software Engineer",
        level: "L3",
        team: "Platform",
        location: "Mexico City",
        startDaysAgo: 38,
        workMode: "remote",
        profile: "new-hire",
        focus: "onboarding",
        frequency: "weekly",
        durationMin: 45,
        dayOffset: 0,
        time: "11:00",
        recognitionPref: "public",
        feedbackStyle: "Often and early. Examples help.",
        rapportNotes: "Moved from a consultancy. Plays in a football league.",
      },
      talkShare: 44,
      slots: 5,
      types: { 0: "onboarding", 4: "onboarding" },
      energy: [5, 4, 4, 4, 4],
      workload: [2, 2, 3, 3, 3],
      upcomingType: "onboarding",
      upcomingAgenda: [
        ["report", "Read access to the production database is still pending"],
        ["manager", "Day 60 checkpoint: what success looks like"],
      ],
      notes: NOTES,
    },
    {
      key: "priya",
      person: {
        name: "Priya Nair",
        email: "priya.nair@example.com",
        role: "Software Engineer II",
        level: "L4",
        team: "Product",
        location: "Bengaluru",
        startDaysAgo: 745,
        workMode: "remote",
        profile: "established-ic",
        focus: "standard",
        frequency: "weekly",
        durationMin: 30,
        dayOffset: 0,
        time: "10:15",
        recognitionPref: "private",
        feedbackStyle: "Privately, with time to think before responding.",
        rapportNotes:
          "Has a toddler. Early starts suit her better than late calls.",
        lastReviewDaysAgo: 62,
      },
      talkShare: 56,
      slots: 9,
      types: { 6: "career" },
      energy: [4, 4, 4, 3, 3, 3, 2, 2, 2],
      workload: [3, 3, 3, 4, 4, 4, 5, 5, 4],
      upcomingAgenda: [["report", "Billing launch scope for next sprint"]],
      notes: NOTES,
    },
    {
      key: "amara",
      person: {
        name: "Amara Okafor",
        email: "amara.okafor@example.com",
        role: "Principal Engineer",
        level: "L7",
        team: "Architecture",
        location: "London",
        startDaysAgo: 1890,
        workMode: "hybrid",
        profile: "senior-ic",
        focus: "standard",
        frequency: "biweekly",
        durationMin: 45,
        dayOffset: 1,
        time: "10:00",
        recognitionPref: "either",
        feedbackStyle: "Blunt is fine. Skip the preamble.",
        rapportNotes: "Runs a local coding club for teenagers.",
        lastReviewDaysAgo: 192,
      },
      talkShare: 71,
      slots: 5,
      types: { 2: "career" },
      energy: [4, 4, 4, 4, 4],
      workload: [3, 3, 3, 3, 3],
      upcomingAgenda: [
        ["report", "Multi-region proposal: where it needs sponsorship"],
      ],
      notes: NOTES,
    },
    {
      key: "tom",
      person: {
        name: "Tom Becker",
        email: "tom.becker@example.com",
        role: "Software Engineer",
        level: "L3",
        team: "Product",
        location: "Berlin",
        startDaysAgo: 430,
        workMode: "hybrid",
        profile: "established-ic",
        focus: "performance",
        frequency: "weekly",
        durationMin: 30,
        dayOffset: 1,
        time: "14:00",
        recognitionPref: "private",
        feedbackStyle: "Specific examples, one topic at a time.",
        lastReviewDaysAgo: 62,
      },
      talkShare: 42,
      slots: 8,
      types: { 0: "performance", 1: "performance", 2: "performance" },
      energy: [3, 3, 3, 2, 3, 3, 3, 3],
      workload: [3, 3, 3, 3, 3, 3, 3, 3],
      upcomingType: "performance",
      upcomingAgenda: [
        ["manager", "Progress against the sprint delivery goal"],
        ["report", "Estimation pairing with Maya: what helped"],
      ],
      notes: NOTES,
    },
    {
      key: "sofia",
      person: {
        name: "Sofia Rossi",
        email: "sofia.rossi@example.com",
        role: "Engineering Team Lead",
        level: "M1",
        team: "Growth",
        location: "Milan",
        startDaysAgo: 1105,
        workMode: "hybrid",
        profile: "team-lead",
        focus: "standard",
        frequency: "weekly",
        durationMin: 45,
        dayOffset: 2,
        time: "09:00",
        recognitionPref: "public",
        feedbackStyle: "In the moment. Does not like waiting for the 1:1.",
        rapportNotes: "Training for a half marathon in the spring.",
        lastReviewDaysAgo: 150,
      },
      talkShare: 66,
      slots: 10,
      types: { 8: "stay", 4: "career" },
      energy: [4, 3, 4, 4, 4, 4, 3, 4, 4, 4],
      workload: [3, 4, 4, 3, 3, 4, 4, 4, 3, 3],
      upcomingAgenda: [
        ["report", "Hiring: the two senior roles"],
        ["report", "Coaching a lead through a tough review"],
      ],
      notes: NOTES,
    },
    {
      key: "kenji",
      person: {
        name: "Kenji Watanabe",
        email: "kenji.watanabe@example.com",
        role: "Senior Software Engineer",
        level: "L5",
        team: "Product",
        location: "Osaka",
        startDaysAgo: 1480,
        workMode: "remote",
        profile: "established-ic",
        focus: "standard",
        frequency: "weekly",
        durationMin: 30,
        dayOffset: 3,
        time: "08:30",
        recognitionPref: "private",
        feedbackStyle: "Written, so he can translate nuance at his own pace.",
        rapportNotes:
          "Restores old cameras. Nine hours ahead: keep calls early.",
        lastReviewDaysAgo: 62,
      },
      talkShare: 58,
      slots: 9,
      cancelled: {
        0: "Clash with the planning offsite",
        1: "Release crunch",
      },
      energy: [3, 3, 4, 3, 3, 3, 3],
      workload: [3, 3, 3, 3, 3, 3, 3],
      noUpcoming: true,
      notes: NOTES,
    },
  ]

  const people: Person[] = []
  const meetings: Meeting[] = []
  const pulses: Pulse[] = []
  const coachingCards: CoachingCard[] = []
  const consentLog: ConsentEvent[] = []
  /** Held meetings per person, newest first. */
  const held: Record<string, Meeting[]> = {}
  const ids: Record<string, string> = {}
  let seq = 0
  const id = (prefix: string) => `${prefix}-s${String(++seq).padStart(4, "0")}`

  for (const spec of specs) {
    const {
      startDaysAgo,
      frequency,
      durationMin,
      dayOffset,
      time,
      lastReviewDaysAgo,
      ...rest
    } = spec.person
    const anchor = workingDayPlus(dayOffset)
    const personId = `p-${spec.key}`
    ids[spec.key] = personId
    const person: Person = {
      ...rest,
      id: personId,
      startDate: ago(startDaysAgo),
      cadence: {
        frequency,
        durationMin,
        weekday: parseDay(anchor).getDay(),
        time,
      },
      lastReviewDate: lastReviewDaysAgo ? ago(lastReviewDaysAgo) : undefined,
      status: "active",
      createdAt: at(ago(Math.min(startDaysAgo, 80))),
    }
    people.push(person)

    const interval = intervalDays(person.cadence)
    // Most recent slot strictly before today.
    let slotDay = anchor
    while (slotDay >= today) slotDay = addDays(slotDay, -interval)
    const upcomingDay = addDays(slotDay, interval)
    const list: Meeting[] = []
    let heldIndex = 0
    const heldTotal = spec.slots - Object.keys(spec.cancelled ?? {}).length

    for (let k = 0; k < spec.slots; k++) {
      const day = addDays(slotDay, -k * interval)
      if (day < person.startDate) break
      const type = spec.types?.[k] ?? "weekly"
      const meetingId = id("m")
      const scheduledAt = atTime(day, time)
      const cancelReason = spec.cancelled?.[k]
      if (cancelReason) {
        meetings.push({
          id: meetingId,
          personId,
          type,
          scheduledAt,
          durationMin,
          status: "cancelled",
          agenda: [],
          sharedNotes: "",
          privateNotes: "",
          cancelledAt: at(addDays(day, -1), "17:00"),
          cancelledBy: "manager",
          cancelReason,
        })
        continue
      }
      // Pulses are listed oldest first; held slots run newest first.
      const pulseIndex = heldTotal - 1 - heldIndex
      heldIndex++
      const sensitive = type === "performance"
      let stats: TalkStats | undefined
      if (!sensitive) {
        const share = clamp(
          Math.round(spec.talkShare + (rng() - 0.5) * 16),
          28,
          88
        )
        const total = Math.round(durationMin * 135 * (0.85 + rng() * 0.2))
        const reportWords = Math.round((total * share) / 100)
        const questions = 5 + Math.floor(rng() * 8)
        stats = {
          reportShare: share,
          managerWords: total - reportWords,
          reportWords,
          longestManagerMonologueSec: Math.round(
            clamp(170 - share * 1.6 + rng() * 50, 25, 210)
          ),
          managerQuestions: questions,
          openQuestions: clamp(
            Math.round(questions * (share / 100) * (0.5 + rng() * 0.5)),
            1,
            questions
          ),
          turns: 40 + Math.floor(rng() * 60),
          estimatedMinutes: durationMin - Math.floor(rng() * 4),
        }
      }
      const agenda: AgendaItem[] = [
        {
          id: id("ag"),
          text: "What is top of mind this week",
          owner: "report",
          done: true,
        },
        {
          id: id("ag"),
          text: "Open commitments from last time",
          owner: "manager",
          done: true,
        },
      ]
      const meeting: Meeting = {
        id: meetingId,
        personId,
        type,
        scheduledAt,
        durationMin,
        status: "completed",
        agenda,
        sharedNotes: spec.notes[k % spec.notes.length],
        privateNotes: "",
        startedAt: scheduledAt,
        endedAt: new Date(
          new Date(scheduledAt).getTime() + durationMin * 60_000
        ).toISOString(),
        consent: sensitive
          ? undefined
          : { manager: true, report: true, at: scheduledAt },
        stats,
        summary: {
          topics:
            type === "career"
              ? ["Career and growth", "Commitments"]
              : type === "stay"
                ? ["Reasons to stay", "Commitments"]
                : type === "performance"
                  ? ["Progress against goals", "Agreed support"]
                  : type === "onboarding"
                    ? ["Onboarding checkpoint", "Blockers"]
                    : ["Blockers", "Commitments"],
          text: spec.notes[k % spec.notes.length],
          confirmedAt: scheduledAt,
        },
      }
      meetings.push(meeting)
      list.push(meeting)
      if (!sensitive)
        consentLog.push({
          id: id("ce"),
          meetingId,
          personId,
          at: scheduledAt,
          manager: true,
          report: true,
          outcome: "granted",
        })
      const energy = spec.energy[pulseIndex]
      const workload = spec.workload[pulseIndex]
      if (energy && workload)
        pulses.push({
          id: id("pu"),
          personId,
          date: day,
          energy,
          workload,
          sourceMeetingId: meetingId,
        })
      if (stats && list.length <= 4) {
        const drafts: Draft[] = []
        if (rng() > 0.35)
          drafts.push({
            kind: "recognition",
            id: "x",
            behavior: "",
            quote: "r",
          })
        drafts.push({
          kind: "commitment",
          id: "y",
          owner: "report",
          text: "",
          quote: "c1",
        })
        if (rng() > 0.25)
          drafts.push({
            kind: "commitment",
            id: "z",
            owner: "manager",
            text: "",
            quote: "c2",
          })
        const coaching = coachingFor(stats, drafts)
        coachingCards.push({
          id: id("cc"),
          meetingId,
          personId,
          createdAt: meeting.endedAt!,
          stats,
          ...coaching,
        })
      }
    }
    held[spec.key] = list

    if (!spec.noUpcoming) {
      meetings.push({
        id: id("m"),
        personId,
        type: spec.upcomingType ?? "weekly",
        scheduledAt: atTime(upcomingDay, time),
        durationMin,
        status: "scheduled",
        agenda: (spec.upcomingAgenda ?? []).map(([owner, text]) => ({
          id: id("ag"),
          owner,
          text,
          done: false,
        })),
        sharedNotes: "",
        privateNotes: "",
      })
    }
  }

  // The most recent conversation with Maya still holds its transcript, so the
  // retention countdown has something to show.
  const mayaLatest = held.maya[0]
  if (mayaLatest) {
    mayaLatest.transcript = {
      text: sampleTranscript("Kevin Dargas", "Maya Chen"),
      addedAt: mayaLatest.endedAt!,
      expiresOn: addDays(
        dayOf(mayaLatest.scheduledAt),
        TRANSCRIPT_TTL_RANGE.default
      ),
    }
    mayaLatest.stats = talkStats(
      parseTranscript(mayaLatest.transcript.text, "Kevin Dargas", "Maya Chen")
        .turns
    )
    const mayaCard = coachingCards.find((c) => c.meetingId === mayaLatest.id)
    if (mayaCard) mayaCard.stats = mayaLatest.stats
  }
  // One declined consent, to show that capture stays off when either says no.
  const kenjiLatest = held.kenji[0]
  if (kenjiLatest) {
    kenjiLatest.consent = {
      manager: true,
      report: false,
      at: kenjiLatest.scheduledAt,
    }
    kenjiLatest.stats = undefined
    const entry = consentLog.find((c) => c.meetingId === kenjiLatest.id)
    if (entry) {
      entry.report = false
      entry.outcome = "declined"
    }
    const card = coachingCards.findIndex((c) => c.meetingId === kenjiLatest.id)
    if (card >= 0) coachingCards.splice(card, 1)
  }

  /** Meeting `k` conversations back for a person, clamped to what exists. */
  const slot = (key: string, k: number): Meeting | undefined =>
    held[key][Math.min(k, held[key].length - 1)]
  const slotDay = (key: string, k: number) => {
    const m = slot(key, k)
    return m ? dayOf(m.scheduledAt) : ago(7 * (k + 1))
  }

  /* ------------------------------------------------------------ commitments */

  const commitments: Commitment[] = []
  const commit = (
    key: string,
    owner: AgendaOwner,
    text: string,
    madeSlot: number,
    dueInDays: number,
    doneAfterDays?: number
  ) => {
    const source = slot(key, madeSlot)
    const made = slotDay(key, madeSlot)
    commitments.push({
      id: id("c"),
      personId: ids[key],
      owner,
      text,
      dueDate: addDays(made, dueInDays),
      status: doneAfterDays === undefined ? "open" : "done",
      createdAt: at(made, "10:00"),
      completedAt:
        doneAfterDays === undefined
          ? undefined
          : at(addDays(made, doneAfterDays), "16:00"),
      sourceMeetingId: source?.id,
    })
  }

  commit(
    "maya",
    "manager",
    "Get an owner named on the platform team for the pipeline approval",
    1,
    3
  )
  commit(
    "maya",
    "report",
    "Write up the rollout plan so it is ready when approval lands",
    0,
    5
  )
  commit(
    "maya",
    "manager",
    "Find out who chairs the ingestion design review",
    0,
    6
  )
  commit(
    "maya",
    "report",
    "Share the latency benchmark with the query team",
    2,
    4,
    3
  )
  commit(
    "maya",
    "manager",
    "Send the staff engineer expectations document",
    5,
    2,
    1
  )
  commit("maya", "report", "Draft the incident review agenda", 3, 3, 2)
  commit(
    "maya",
    "manager",
    "Flag priority changes at the start of the week",
    2,
    7,
    6
  )

  commit("diego", "manager", "Chase the production read access request", 1, 2)
  commit("diego", "report", "Pair with Maya on the on-call runbook", 0, 6)
  commit("diego", "manager", "Introduce Diego to the design lead", 2, 3, 2)
  commit(
    "diego",
    "report",
    "Merge the first change to notification preferences",
    3,
    5,
    4
  )
  commit(
    "diego",
    "manager",
    "Write down the day 30, 60 and 90 success criteria",
    4,
    2,
    1
  )

  commit("priya", "manager", "Move audit preparation to next sprint", 0, 9)
  commit(
    "priya",
    "manager",
    "Agree a freeze on design changes after sprint start",
    1,
    4
  )
  commit(
    "priya",
    "report",
    "List what can drop from the billing launch scope",
    0,
    4
  )
  commit("priya", "report", "Book time off after the billing launch", 2, 14)
  commit("priya", "manager", "Review the usage metering design", 4, 3, 3)
  commit("priya", "report", "Demo metering to the finance team", 5, 5, 5)

  commit(
    "amara",
    "manager",
    "Raise data platform ownership with the VP of Engineering",
    1,
    5,
    4
  )
  commit(
    "amara",
    "report",
    "Circulate the multi-region proposal for comment",
    0,
    10
  )
  commit("amara", "manager", "Find a sponsor for the multi-region work", 0, 12)

  commit("tom", "manager", "Write up the agreed support plan", 0, 8)
  commit(
    "tom",
    "report",
    "Post a short progress note in the team channel each day",
    1,
    7,
    7
  )
  commit("tom", "manager", "Pair Tom with Maya on estimation", 2, 4, 3)
  commit(
    "tom",
    "report",
    "Ask for review within a day of opening a pull request",
    2,
    7,
    7
  )
  commit(
    "tom",
    "report",
    "Break the checkout ticket into three smaller ones",
    0,
    3
  )

  commit("sofia", "manager", "Ask recruiting for a dedicated sourcer", 1, 4, 5)
  commit("sofia", "report", "Share the deployment frequency baseline", 0, 5)
  commit(
    "sofia",
    "manager",
    "Share org changes with Sofia before they are announced",
    8,
    30,
    20
  )
  commit(
    "sofia",
    "report",
    "Run a practice review conversation with her lead",
    1,
    6,
    4
  )
  commit(
    "sofia",
    "manager",
    "Review the senior engineer job description",
    3,
    3,
    2
  )

  commit(
    "kenji",
    "manager",
    "Review Kenji's proposal for the search rewrite",
    0,
    6
  )
  commit("kenji", "report", "Benchmark the two indexing approaches", 0, 10, 9)

  /* ------------------------------------------------------------------ goals */

  const goals: Goal[] = []
  const goal = (
    key: string,
    title: string,
    readiness: Goal["readiness"],
    progress: number,
    setDaysAgo: number,
    changes: [GoalStatus, number, string?][] = [],
    keyResults: [string, boolean][] = [],
    description?: string
  ) => {
    const history: Goal["history"] = [
      {
        status: "on-track",
        date: ago(setDaysAgo),
        recordedAt: at(ago(setDaysAgo)),
      },
      ...changes.map(([status, daysAgo, note]) => ({
        status,
        date: ago(daysAgo),
        recordedAt: at(ago(daysAgo)),
        note,
      })),
    ]
    const last = history[history.length - 1]
    const closed = last.status === "done" || last.status === "dropped"
    goals.push({
      id: id("g"),
      personId: ids[key],
      title,
      description,
      quarter: quarterOf(closed ? last.date : today),
      progress,
      status: last.status,
      readiness,
      keyResults: keyResults.map(([text, done]) => ({
        id: id("kr"),
        text,
        done,
      })),
      validFrom: ago(setDaysAgo),
      validTo: closed ? last.date : undefined,
      recordedAt: at(ago(setDaysAgo)),
      history,
    })
  }

  goal(
    "maya",
    "Migrate ingestion to the new pipeline",
    "D3",
    55,
    64,
    [
      [
        "at-risk",
        14,
        "Waiting on the platform team to approve the pipeline change",
      ],
    ],
    [
      ["Dual-write running in staging", true],
      ["Backfill verified", true],
      ["Production cutover", false],
      ["Old pipeline switched off", false],
    ]
  )
  goal("maya", "Cut p95 query latency by 30 percent", "D4", 70, 64)
  goal("maya", "Ship audit log export", "D4", 100, 150, [
    ["done", 52, "Released to all customers"],
  ])

  goal(
    "diego",
    "Ship the notification preferences page",
    "D2",
    40,
    30,
    [],
    [
      ["First change merged", true],
      ["Settings API wired", true],
      ["Accessibility review passed", false],
      ["Released behind a flag", false],
      ["Rolled out to everyone", false],
    ]
  )
  goal("diego", "Complete the on-call readiness checklist", "D1", 20, 24)

  goal("priya", "Launch usage-based billing", "D3", 65, 70, [
    ["at-risk", 16, "Scope grew twice after sprint start"],
  ])
  goal(
    "priya",
    "Reduce invoice generation errors below 0.5 percent",
    "D4",
    80,
    70
  )

  goal("amara", "Define the multi-region architecture", "D4", 60, 75)
  goal("amara", "Grow two engineers into guild leads", "D4", 50, 75)

  goal(
    "tom",
    "Deliver committed tickets within the sprint for four sprints in a row",
    "D2",
    50,
    28,
    [["at-risk", 14, "Sprint two missed by one ticket"]],
    [
      ["Sprint one", true],
      ["Sprint two", false],
      ["Sprint three", true],
      ["Sprint four", false],
    ],
    "Agreed as part of the support plan. Measured at each sprint review."
  )
  goal(
    "tom",
    "Request review within one day of opening a pull request",
    "D2",
    75,
    28
  )

  goal("sofia", "Raise team deployment frequency to daily", "D3", 45, 68)
  goal("sofia", "Hire two senior engineers", "D3", 30, 68, [
    ["at-risk", 21, "One offer declined, pipeline thin"],
  ])

  goal("kenji", "Rewrite search indexing", "D4", 35, 60)
  goal("kenji", "Document the search relevance model", "D4", 100, 120, [
    ["done", 45],
  ])

  /* --------------------------------------------------------------- blockers */

  const blockers: Blocker[] = []
  const blocker = (
    key: string,
    title: string,
    category: Blocker["category"],
    raisedSlots: number[],
    end?: {
      status: "resolved" | "escalated"
      daysAgo: number
      note?: string
      to?: string
    }
  ) => {
    const occurrences = raisedSlots.map((k) => ({
      date: slotDay(key, k),
      sourceMeetingId: slot(key, k)?.id,
    }))
    const first = occurrences[0].date
    const history: Blocker["history"] = [
      { status: "open", date: first, recordedAt: at(first) },
    ]
    if (end)
      history.push({
        status: end.status,
        date: ago(end.daysAgo),
        recordedAt: at(ago(end.daysAgo)),
        note: end.note,
      })
    blockers.push({
      id: id("b"),
      personId: ids[key],
      title,
      category,
      status: end?.status ?? "open",
      occurrences,
      escalatedTo: end?.to,
      validFrom: first,
      validTo: end?.status === "resolved" ? ago(end.daysAgo) : undefined,
      recordedAt: at(first),
      history,
    })
  }

  blocker(
    "maya",
    "Platform team approval for pipeline changes",
    "cross-team",
    [2, 1, 0]
  )
  blocker("maya", "Flaky integration tests in CI", "tooling", [9, 8], {
    status: "resolved",
    daysAgo: 49,
    note: "Test containers pinned",
  })
  blocker("diego", "Read access to the production database", "tooling", [1, 0])
  blocker(
    "priya",
    "Design changes arriving after sprint start",
    "process",
    [3, 1, 0]
  )
  blocker("priya", "Finance sign-off on tax rules", "cross-team", [6], {
    status: "resolved",
    daysAgo: 30,
  })
  blocker(
    "amara",
    "Unclear ownership of the data platform roadmap",
    "clarity",
    [2, 1],
    {
      status: "escalated",
      daysAgo: 12,
      note: "Raised at the engineering leadership meeting",
      to: "VP of Engineering",
    }
  )
  blocker("tom", "Acceptance criteria missing on tickets", "clarity", [3, 1])
  blocker(
    "sofia",
    "Recruiter capacity for the two open roles",
    "capacity",
    [3, 1]
  )
  blocker("kenji", "Search cluster quota for the reindex", "tooling", [0])

  /* --------------------------------------------------------------- feedback */

  const feedback: FeedbackEntry[] = []
  const fb = (
    key: string,
    kind: FeedbackEntry["kind"],
    direction: FeedbackEntry["direction"],
    observedDaysAgo: number,
    deliveredDaysAgo: number | undefined,
    situation: string,
    behavior: string,
    impact: string,
    intent?: string,
    competency?: FeedbackEntry["competency"]
  ) =>
    feedback.push({
      id: id("f"),
      personId: ids[key],
      kind,
      direction,
      situation,
      behavior,
      impact,
      intent,
      observedDate: ago(observedDaysAgo),
      deliveredDate:
        deliveredDaysAgo === undefined ? undefined : ago(deliveredDaysAgo),
      competency,
      recordedAt: at(ago(deliveredDaysAgo ?? observedDaysAgo)),
    })

  fb(
    "maya",
    "recognition",
    "given",
    10,
    9,
    "Thursday's incident review for the ingestion outage",
    "Kept the discussion on the timeline and asked each team for one fix",
    "The review ended with three owned fixes and no blame, and two teams asked to reuse the format",
    undefined,
    "multiplying"
  )
  fb(
    "maya",
    "developmental",
    "given",
    41,
    40,
    "The design document for the pipeline migration",
    "Scoped the first version to cover every edge case before asking for review",
    "Review started two weeks later than it could have, and the platform team had less time to respond",
    "What were you hoping to settle before sharing it?",
    "craft"
  )
  fb(
    "maya",
    "recognition",
    "given",
    75,
    74,
    "On-call handover in the first week of the quarter",
    "Walked two newer engineers through the runbook and stayed on for their first page",
    "Both handled their next shift without escalation",
    undefined,
    "multiplying"
  )
  fb(
    "maya",
    "developmental",
    "upward",
    20,
    20,
    "Priorities for the sprint changed on a Friday afternoon",
    "The change was announced without notice or the reason behind it",
    "She lost half a day of planned work and had to re-plan over the weekend"
  )

  fb(
    "diego",
    "recognition",
    "given",
    6,
    5,
    "First pull request on notification preferences",
    "Added tests for the edge cases reviewers had not asked for",
    "The change merged in one review round and became the example for the next new hire",
    undefined,
    "craft"
  )
  fb(
    "diego",
    "developmental",
    "given",
    16,
    15,
    "Stand-up in his second week",
    "Waited two days before saying he was stuck on local setup",
    "The feature start slipped, and others could have fixed it in ten minutes",
    "What made it hard to ask?",
    "collaboration"
  )

  fb(
    "priya",
    "recognition",
    "given",
    24,
    23,
    "Metering demo to the finance team",
    "Explained the rounding rules with worked examples instead of code",
    "Finance signed off the same day, a week ahead of plan",
    undefined,
    "collaboration"
  )
  fb(
    "priya",
    "developmental",
    "upward",
    8,
    8,
    "The billing launch plan",
    "Scope was added twice after the sprint started without asking what would drop",
    "She worked evenings for two weeks to keep the date"
  )

  fb(
    "amara",
    "recognition",
    "given",
    18,
    17,
    "Architecture guild session on data ownership",
    "Brought three teams to a shared definition before proposing a design",
    "The follow-up proposal passed without the usual second round",
    undefined,
    "multiplying"
  )

  fb(
    "tom",
    "developmental",
    "given",
    30,
    29,
    "Sprint review two weeks into the quarter",
    "Two tickets marked in progress had no commits for four days and no note in the channel",
    "The team planned around work that had not started, and the release slipped by a sprint",
    "What got in the way of flagging it earlier?",
    "craft"
  )
  fb(
    "tom",
    "developmental",
    "given",
    15,
    14,
    "Pull request for the checkout form",
    "Asked for review three days after opening it",
    "Feedback arrived after the sprint closed, so the fix carried over",
    "What would make asking sooner easier?",
    "collaboration"
  )
  fb(
    "tom",
    "recognition",
    "given",
    7,
    6,
    "This sprint's daily progress notes",
    "Posted a short note every day, including the day he was blocked",
    "The team unblocked him within the hour and the ticket closed on time",
    undefined,
    "collaboration"
  )

  fb(
    "sofia",
    "recognition",
    "given",
    12,
    11,
    "The declined offer for the senior role",
    "Called the candidate to learn why and shared the reasons with recruiting",
    "The job description and the interview loop were both changed within a week",
    undefined,
    "multiplying"
  )
  fb(
    "sofia",
    "developmental",
    "upward",
    64,
    64,
    "The reorganization announcement",
    "She learned about the change at the same time as her team",
    "She could not answer their questions and felt her standing with them was undercut"
  )

  fb(
    "kenji",
    "recognition",
    "given",
    51,
    50,
    "Search relevance documentation",
    "Wrote the model down with examples a support engineer could follow",
    "Support now resolves relevance tickets without paging engineering",
    undefined,
    "multiplying"
  )
  // Observed and not yet delivered: shows the 48 hour window at work.
  fb(
    "sofia",
    "developmental",
    "given",
    1,
    undefined,
    "Yesterday's planning meeting",
    "Answered for her lead three times when questions were addressed to him",
    "He stopped contributing for the rest of the meeting",
    "What were you seeing in the room at that point?",
    "multiplying"
  )

  /* ----------------------------------------------------------------- career */

  const aspirations: Workspace["aspirations"] = [
    {
      id: id("a"),
      personId: ids.maya,
      statement: "Move into engineering management within two years",
      track: "management",
      targetRole: "Engineering Manager",
      horizonMonths: 24,
      validFrom: ago(310),
      validTo: slotDay("maya", 5),
      recordedAt: at(ago(310)),
    },
    {
      id: id("a"),
      personId: ids.maya,
      statement:
        "Grow on the staff engineer track, leading technical work that spans teams",
      track: "ic",
      targetRole: "Staff Engineer",
      horizonMonths: 18,
      validFrom: slotDay("maya", 5),
      recordedAt: at(slotDay("maya", 5)),
      sourceMeetingId: slot("maya", 5)?.id,
    },
    {
      id: id("a"),
      personId: ids.diego,
      statement:
        "Become a strong full-stack engineer who owns a service end to end",
      track: "ic",
      horizonMonths: 24,
      validFrom: ago(30),
      recordedAt: at(ago(30)),
    },
    {
      id: id("a"),
      personId: ids.priya,
      statement: "Reach senior engineer with a product focus",
      track: "ic",
      targetRole: "Senior Software Engineer",
      horizonMonths: 12,
      validFrom: slotDay("priya", 6),
      recordedAt: at(slotDay("priya", 6)),
      sourceMeetingId: slot("priya", 6)?.id,
    },
    {
      id: id("a"),
      personId: ids.amara,
      statement: "Shape architecture across the whole engineering organization",
      track: "ic",
      targetRole: "Distinguished Engineer",
      horizonMonths: 24,
      validFrom: ago(400),
      recordedAt: at(ago(400)),
    },
    {
      id: id("a"),
      personId: ids.sofia,
      statement: "Lead several teams as a senior engineering manager",
      track: "management",
      targetRole: "Senior Engineering Manager",
      horizonMonths: 18,
      validFrom: slotDay("sofia", 4),
      recordedAt: at(slotDay("sofia", 4)),
      sourceMeetingId: slot("sofia", 4)?.id,
    },
    {
      id: id("a"),
      personId: ids.kenji,
      statement: "Stay hands-on and become the recognized expert in search",
      track: "specialist",
      horizonMonths: 24,
      validFrom: ago(205),
      recordedAt: at(ago(205)),
    },
    {
      id: id("a"),
      personId: ids.tom,
      statement: "Get back to steady delivery, then work toward the next level",
      track: "exploring",
      horizonMonths: 12,
      validFrom: ago(28),
      recordedAt: at(ago(28)),
    },
  ]

  const milestones: Milestone[] = []
  const milestone = (
    key: string,
    kind: Milestone["kind"],
    title: string,
    steps: [MilestoneStatus, number][],
    extra: Partial<Milestone> = {}
  ) => {
    const history = steps.map(([status, daysAgo]) => ({
      status,
      date: ago(daysAgo),
      recordedAt: at(ago(daysAgo)),
    }))
    milestones.push({
      id: id("ms"),
      personId: ids[key],
      kind,
      title,
      status: history[history.length - 1].status,
      evidence: [],
      validFrom: history[0].date,
      recordedAt: history[0].recordedAt,
      history,
      ...extra,
    })
  }

  milestone(
    "maya",
    "stretch",
    "Lead the design review for the ingestion service",
    [
      ["planned", 35],
      ["in-progress", 7],
    ],
    { competency: "multiplying", targetDate: addDays(today, 30) }
  )
  milestone(
    "maya",
    "competency",
    "Mentors two engineers through their first on-call rotation",
    [
      ["in-progress", 120],
      ["demonstrated", 70],
    ],
    {
      competency: "multiplying",
      evidence: [
        {
          date: ago(75),
          note: "Both engineers handled a shift without escalation",
        },
      ],
    }
  )
  milestone(
    "maya",
    "skill",
    "Capacity planning for a shared service",
    [["planned", 35]],
    {
      competency: "craft",
      targetDate: addDays(today, 75),
    }
  )
  const diegoStart = ago(38)
  milestone(
    "diego",
    "onboarding",
    "Day 7: environment set up and first change merged",
    [
      ["planned", 38],
      ["demonstrated", 30],
    ],
    { targetDate: addDays(diegoStart, 7) }
  )
  milestone(
    "diego",
    "onboarding",
    "Day 30: owns a small feature from ticket to release",
    [
      ["planned", 38],
      ["in-progress", 20],
      ["demonstrated", 6],
    ],
    { targetDate: addDays(diegoStart, 30) }
  )
  milestone(
    "diego",
    "onboarding",
    "Day 60: covers a support rotation shift with a buddy",
    [
      ["planned", 38],
      ["in-progress", 5],
    ],
    { targetDate: addDays(diegoStart, 60) }
  )
  milestone(
    "diego",
    "onboarding",
    "Day 90: leads a feature from design to release",
    [["planned", 38]],
    { targetDate: addDays(diegoStart, 90) }
  )
  milestone(
    "priya",
    "competency",
    "Leads a launch across engineering, finance and support",
    [["in-progress", 60]],
    { competency: "collaboration", targetDate: addDays(today, 21) }
  )
  milestone(
    "priya",
    "skill",
    "Writing technical proposals",
    [["planned", 42]],
    {
      competency: "craft",
    }
  )
  milestone(
    "amara",
    "competency",
    "Runs the architecture guild",
    [
      ["in-progress", 300],
      ["demonstrated", 180],
    ],
    { competency: "multiplying" }
  )
  milestone(
    "sofia",
    "competency",
    "Coaches her leads through their first review cycle",
    [
      ["planned", 60],
      ["in-progress", 25],
    ],
    { competency: "multiplying", targetDate: addDays(today, 45) }
  )
  milestone(
    "sofia",
    "stretch",
    "Own the hiring plan for the growth organization",
    [["in-progress", 50]],
    { competency: "collaboration" }
  )
  milestone(
    "kenji",
    "stretch",
    "Present the search rewrite at the engineering all-hands",
    [["planned", 90]],
    { competency: "multiplying" }
  )

  /* --------------------------------------------------- workload and retention */

  const workloadMarkers: Workspace["workloadMarkers"] = [
    {
      id: id("w"),
      personId: ids.priya,
      kind: "crunch",
      note: "Third release in six weeks",
      dimension: "exhaustion",
      date: slotDay("priya", 2),
      sourceMeetingId: slot("priya", 2)?.id,
    },
    {
      id: id("w"),
      personId: ids.priya,
      kind: "after-hours",
      note: "Working evenings to keep the billing launch date",
      dimension: "exhaustion",
      date: slotDay("priya", 1),
      sourceMeetingId: slot("priya", 1)?.id,
    },
    {
      id: id("w"),
      personId: ids.priya,
      kind: "pto-gap",
      note: "No time off since the spring",
      dimension: "exhaustion",
      date: slotDay("priya", 0),
      sourceMeetingId: slot("priya", 0)?.id,
    },
    {
      id: id("w"),
      personId: ids.maya,
      kind: "context-switching",
      note: "Migration, audit preparation and two design reviews at once",
      dimension: "exhaustion",
      date: slotDay("maya", 0),
      sourceMeetingId: slot("maya", 0)?.id,
    },
    {
      id: id("w"),
      personId: ids.sofia,
      kind: "scope-growth",
      note: "Covering interviews for both open roles on top of delivery",
      date: slotDay("sofia", 6),
      resolvedDate: slotDay("sofia", 2),
    },
  ]

  const stayDrivers: Workspace["stayDrivers"] = []
  const driver = (
    key: string,
    kind: Workspace["stayDrivers"][number]["kind"],
    text: string,
    daysAgo: number,
    extra: Partial<Workspace["stayDrivers"][number]> = {}
  ) =>
    stayDrivers.push({
      id: id("s"),
      personId: ids[key],
      kind,
      text,
      validFrom: ago(daysAgo),
      recordedAt: at(ago(daysAgo)),
      ...extra,
    })

  driver("maya", "energizer", "Hard distributed systems problems", 300)
  driver("maya", "energizer", "Mentoring newer engineers", 300)
  driver("maya", "friction", "Slow approvals from other teams", 21)
  driver(
    "maya",
    "learning",
    "How staff engineers build influence without authority",
    40
  )
  driver("diego", "energizer", "Learning from senior engineers", 30)
  driver("diego", "learning", "System design", 30)
  driver("priya", "energizer", "Seeing customers use what she ships", 400)
  driver("priya", "friction", "Scope that changes after the sprint starts", 20)
  driver("priya", "stay-reason", "Flexible hours that fit around family", 400)
  driver("amara", "energizer", "Setting technical direction", 500)
  driver("amara", "friction", "Decisions without a clear owner", 30)
  const sofiaStay = slot("sofia", 8)
  const sofiaStayDay = slotDay("sofia", 8)
  const fromStay = { sourceMeetingId: sofiaStay?.id }
  const sofiaDaysAgo = Math.max(
    1,
    Math.round(
      (parseDay(today).getTime() - parseDay(sofiaStayDay).getTime()) /
        86_400_000
    )
  )
  driver(
    "sofia",
    "energizer",
    "Watching her leads grow",
    sofiaDaysAgo,
    fromStay
  )
  driver(
    "sofia",
    "stay-reason",
    "Autonomy to shape the team",
    sofiaDaysAgo,
    fromStay
  )
  driver(
    "sofia",
    "leave-trigger",
    "The reorganization was announced without notice",
    sofiaDaysAgo,
    {
      ...fromStay,
      action: "Share org changes with Sofia before they are announced",
    }
  )
  driver("sofia", "learning", "Managing managers", sofiaDaysAgo, fromStay)
  driver("kenji", "energizer", "Deep, uninterrupted technical work", 205)
  driver("kenji", "friction", "Meetings late in his evening", 205)
  driver("tom", "energizer", "Front-end work with visible results", 200)

  return {
    version: 1,
    manager: {
      name: "Kevin Dargas",
      title: "Engineering Manager",
      email: "kevin.dargas@example.com",
      team: "Platform and Product Engineering",
    },
    settings: {
      transcriptTtlDays: TRANSCRIPT_TTL_RANGE.default,
      legalHold: false,
      sensitiveKeywords: [...DEFAULT_SENSITIVE_KEYWORDS],
      worksCouncilMode: false,
      briefTime: "08:00",
      sampleData: true,
      dismissedNudges: [],
    },
    people,
    meetings,
    commitments,
    goals,
    blockers,
    feedback,
    aspirations,
    milestones,
    pulses,
    workloadMarkers,
    stayDrivers,
    coachingCards,
    customQuestions: [],
    consentLog,
    reviews: [],
  }
}
