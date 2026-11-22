import * as React from "react"
import { nanoid } from "nanoid"

import {
  DEFAULT_SENSITIVE_KEYWORDS,
  TRANSCRIPT_TTL_RANGE,
} from "@/lib/constants"
import { addDays, dayOf, now, quarterOf, today } from "@/lib/time"
import type {
  AgendaItem,
  AgendaOwner,
  Aspiration,
  Blocker,
  BlockerStatus,
  CadenceConfig,
  CareerTrack,
  CoachingCard,
  CollectionItem,
  CollectionKey,
  Commitment,
  CommitmentStatus,
  FeedbackEntry,
  Goal,
  GoalStatus,
  ManagerProfile,
  Meeting,
  MeetingType,
  Milestone,
  MilestoneStatus,
  Person,
  Pulse,
  Question,
  ReviewDraft,
  Settings,
  StayDriver,
  StayDriverKind,
  WorkloadMarker,
  Workspace,
} from "@/lib/types"
import { nextOccurrenceAt, nextScheduled } from "./cadence"
import { buildSampleWorkspace } from "./sample"
import { parseTranscript, talkStats } from "./transcript"

/**
 * The workspace store. One manager, one browser: the whole workspace is a
 * single JSON document in localStorage. Nothing leaves the device.
 *
 * Components read with `workspace.use()` and change data only through
 * `actions`. The server snapshot is an empty workspace; the app shell holds a
 * skeleton until `workspace.useHydrated()` is true, so stored data never
 * flashes in over a server render.
 */

export const STORAGE_KEY = "vantage:workspace:v1"

export function defaultSettings(): Settings {
  return {
    transcriptTtlDays: TRANSCRIPT_TTL_RANGE.default,
    legalHold: false,
    sensitiveKeywords: [...DEFAULT_SENSITIVE_KEYWORDS],
    worksCouncilMode: false,
    briefTime: "08:00",
    sampleData: false,
    dismissedNudges: [],
  }
}

export function emptyWorkspace(manager?: Partial<ManagerProfile>): Workspace {
  return {
    version: 1,
    manager: {
      name: manager?.name ?? "",
      title: manager?.title ?? "",
      email: manager?.email ?? "",
      team: manager?.team ?? "",
    },
    settings: defaultSettings(),
    people: [],
    meetings: [],
    commitments: [],
    goals: [],
    blockers: [],
    feedback: [],
    aspirations: [],
    milestones: [],
    pulses: [],
    workloadMarkers: [],
    stayDrivers: [],
    coachingCards: [],
    customQuestions: [],
    consentLog: [],
    reviews: [],
  }
}

const EMPTY = emptyWorkspace()

const LIST_KEYS: CollectionKey[] = [
  "people",
  "meetings",
  "commitments",
  "goals",
  "blockers",
  "feedback",
  "aspirations",
  "milestones",
  "pulses",
  "workloadMarkers",
  "stayDrivers",
  "coachingCards",
  "customQuestions",
  "consentLog",
  "reviews",
]

/**
 * Accept anything that looks like a workspace and fill in what is missing, so
 * an older export or a hand-edited file still loads. Throws on a document
 * that is not a workspace at all.
 */
export function normalizeWorkspace(input: unknown): Workspace {
  if (!input || typeof input !== "object") throw new Error("Not a workspace")
  const raw = input as Partial<Workspace>
  if (!Array.isArray(raw.people)) throw new Error("Not a workspace")
  const base = emptyWorkspace(raw.manager)
  const next: Workspace = {
    ...base,
    settings: { ...base.settings, ...(raw.settings ?? {}) },
  }
  for (const key of LIST_KEYS) {
    const list = raw[key]
    if (Array.isArray(list)) (next[key] as unknown[]) = list
  }
  return next
}

/** Drop transcript text that has passed its retention day. Legal hold keeps it. */
export function purgeExpired(ws: Workspace, day: string = today()): Workspace {
  if (ws.settings.legalHold) return ws
  if (!ws.meetings.some((m) => m.transcript && m.transcript.expiresOn <= day))
    return ws
  return {
    ...ws,
    meetings: ws.meetings.map((m) =>
      m.transcript && m.transcript.expiresOn <= day
        ? { ...m, transcript: undefined }
        : m
    ),
  }
}

let state: Workspace = EMPTY
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function persist() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function load() {
  if (loaded || typeof window === "undefined") return
  loaded = true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = normalizeWorkspace(JSON.parse(raw))
      state = purgeExpired(parsed)
      if (state !== parsed) persist()
      return
    }
  } catch {}
  // First run: start with the sample team so every screen has something to show.
  state = buildSampleWorkspace()
  persist()
}

function get(): Workspace {
  load()
  return state
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function set(next: Workspace | ((prev: Workspace) => Workspace)) {
  load()
  state = typeof next === "function" ? next(state) : next
  persist()
  emit()
}

const noopSubscribe = () => () => {}

export const workspace = {
  get,
  set,
  subscribe,
  /** Current workspace. Empty on the server and during hydration. */
  use(): Workspace {
    return React.useSyncExternalStore(subscribe, get, () => EMPTY)
  },
  /** False on the server and during hydration, true once stored data is in. */
  useHydrated(): boolean {
    return React.useSyncExternalStore(
      noopSubscribe,
      () => true,
      () => false
    )
  },
  /** Test helper: replace the in-memory workspace without touching storage. */
  __reset(next: Workspace = emptyWorkspace()) {
    state = next
    loaded = true
    emit()
  },
}

/* ---------------------------------------------------------------- helpers */

export function newId(prefix: string) {
  return `${prefix}-${nanoid(8)}`
}

function stamp() {
  return now().toISOString()
}

function patchList<K extends CollectionKey>(
  key: K,
  id: string,
  patch:
    Partial<CollectionItem<K>> | ((row: CollectionItem<K>) => CollectionItem<K>)
) {
  set((ws) => ({
    ...ws,
    [key]: (ws[key] as CollectionItem<K>[]).map((row) =>
      row.id !== id
        ? row
        : typeof patch === "function"
          ? patch(row)
          : { ...row, ...patch }
    ),
  }))
}

function patchMeeting(
  id: string,
  patch: Partial<Meeting> | ((m: Meeting) => Meeting)
) {
  patchList("meetings", id, patch)
}

/* ------------------------------------------------------------ input types */

export interface NewPersonInput {
  name: string
  email?: string
  role: string
  level?: string
  team?: string
  location?: string
  startDate: string
  workMode: Person["workMode"]
  profile: Person["profile"]
  focus?: Person["focus"]
  cadence: CadenceConfig
  recognitionPref: Person["recognitionPref"]
  feedbackStyle?: string
  rapportNotes?: string
  lastReviewDate?: string
  /** Optional answers from setup that seed the record. */
  aspiration?: { statement: string; track: CareerTrack; targetRole?: string }
  energizers?: string[]
  frictions?: string[]
  goals?: { title: string; readiness: Goal["readiness"] }[]
  /** Schedule the first 1:1 from the cadence. Defaults to true. */
  scheduleFirst?: boolean
}

export interface NewMeetingInput {
  personId: string
  type: MeetingType
  scheduledAt: string
  durationMin: number
  agenda?: Pick<AgendaItem, "text" | "owner" | "questionId">[]
}

export interface NewCommitmentInput {
  personId: string
  owner: AgendaOwner
  text: string
  dueDate?: string
  sourceMeetingId?: string
}

export interface NewGoalInput {
  personId: string
  title: string
  description?: string
  quarter?: string
  readiness: Goal["readiness"]
  keyResults?: string[]
  sourceMeetingId?: string
}

export interface NewBlockerInput {
  personId: string
  title: string
  category: Blocker["category"]
  note?: string
  sourceMeetingId?: string
}

export type NewFeedbackInput = Omit<FeedbackEntry, "id" | "recordedAt">

export interface NewAspirationInput {
  personId: string
  statement: string
  track: CareerTrack
  targetRole?: string
  horizonMonths?: number
  sourceMeetingId?: string
}

export interface NewMilestoneInput {
  personId: string
  kind: Milestone["kind"]
  title: string
  competency?: Milestone["competency"]
  targetDate?: string
  status?: MilestoneStatus
  sourceMeetingId?: string
}

export interface NewPulseInput {
  personId: string
  energy: number
  workload: number
  note?: string
  date?: string
  sourceMeetingId?: string
}

export type NewWorkloadMarkerInput = Omit<WorkloadMarker, "id" | "date"> & {
  date?: string
}

export interface NewStayDriverInput {
  personId: string
  kind: StayDriverKind
  text: string
  action?: string
  sourceMeetingId?: string
}

/* ----------------------------------------------------------------- actions */

export const actions = {
  /* ---- generic list access, for fields without a dedicated action ---- */

  update<K extends CollectionKey>(
    key: K,
    id: string,
    patch: Partial<CollectionItem<K>>
  ) {
    patchList(key, id, patch)
  },

  remove<K extends CollectionKey>(key: K, id: string) {
    set((ws) => ({
      ...ws,
      [key]: (ws[key] as CollectionItem<K>[]).filter((row) => row.id !== id),
    }))
  },

  /* ---- people ---- */

  /** Add a direct report and seed their record from the setup answers. */
  addPerson(input: NewPersonInput): string {
    const id = newId("p")
    const at = stamp()
    const day = today()
    const person: Person = {
      id,
      name: input.name.trim(),
      email: input.email?.trim() || undefined,
      role: input.role.trim(),
      level: input.level?.trim() || undefined,
      team: input.team?.trim() || undefined,
      location: input.location?.trim() || undefined,
      startDate: input.startDate,
      workMode: input.workMode,
      profile: input.profile,
      focus:
        input.focus ??
        (input.profile === "new-hire" ? "onboarding" : "standard"),
      cadence: input.cadence,
      recognitionPref: input.recognitionPref,
      feedbackStyle: input.feedbackStyle?.trim() || undefined,
      rapportNotes: input.rapportNotes?.trim() || undefined,
      lastReviewDate: input.lastReviewDate || undefined,
      status: "active",
      createdAt: at,
    }
    const aspirations: Aspiration[] = input.aspiration?.statement.trim()
      ? [
          {
            id: newId("a"),
            personId: id,
            statement: input.aspiration.statement.trim(),
            track: input.aspiration.track,
            targetRole: input.aspiration.targetRole?.trim() || undefined,
            horizonMonths: 18,
            validFrom: day,
            recordedAt: at,
          },
        ]
      : []
    const driver = (kind: StayDriverKind, text: string): StayDriver => ({
      id: newId("s"),
      personId: id,
      kind,
      text: text.trim(),
      validFrom: day,
      recordedAt: at,
    })
    const stayDrivers = [
      ...(input.energizers ?? [])
        .filter((t) => t.trim())
        .map((t) => driver("energizer", t)),
      ...(input.frictions ?? [])
        .filter((t) => t.trim())
        .map((t) => driver("friction", t)),
    ]
    const goals: Goal[] = (input.goals ?? [])
      .filter((g) => g.title.trim())
      .map((g) => ({
        id: newId("g"),
        personId: id,
        title: g.title.trim(),
        quarter: quarterOf(day),
        progress: 0,
        status: "on-track",
        readiness: g.readiness,
        keyResults: [],
        validFrom: day,
        recordedAt: at,
        history: [{ status: "on-track", date: day, recordedAt: at }],
      }))
    const first: Meeting[] =
      input.scheduleFirst === false
        ? []
        : [
            {
              id: newId("m"),
              personId: id,
              type: person.focus === "onboarding" ? "onboarding" : "weekly",
              scheduledAt: nextOccurrenceAt(person, []),
              durationMin: person.cadence.durationMin,
              status: "scheduled",
              agenda: [],
              sharedNotes: "",
              privateNotes: "",
            },
          ]
    set((ws) => ({
      ...ws,
      people: [...ws.people, person],
      aspirations: [...ws.aspirations, ...aspirations],
      stayDrivers: [...ws.stayDrivers, ...stayDrivers],
      goals: [...ws.goals, ...goals],
      meetings: [...ws.meetings, ...first],
    }))
    return id
  },

  updatePerson(id: string, patch: Partial<Person>) {
    patchList("people", id, patch)
  },

  /** Hide a person from active views and keep the record. */
  archivePerson(id: string, archived = true) {
    patchList("people", id, { status: archived ? "archived" : "active" })
    if (archived)
      set((ws) => ({
        ...ws,
        meetings: ws.meetings.filter(
          (m) => !(m.personId === id && m.status === "scheduled")
        ),
      }))
  },

  /** Delete a person and every record that hangs off them. */
  removePerson(id: string) {
    set((ws) => {
      const keep = <T extends { personId: string }>(list: T[]) =>
        list.filter((x) => x.personId !== id)
      return {
        ...ws,
        people: ws.people.filter((p) => p.id !== id),
        meetings: keep(ws.meetings),
        commitments: keep(ws.commitments),
        goals: keep(ws.goals),
        blockers: keep(ws.blockers),
        feedback: keep(ws.feedback),
        aspirations: keep(ws.aspirations),
        milestones: keep(ws.milestones),
        pulses: keep(ws.pulses),
        workloadMarkers: keep(ws.workloadMarkers),
        stayDrivers: keep(ws.stayDrivers),
        coachingCards: keep(ws.coachingCards),
        consentLog: keep(ws.consentLog),
        reviews: keep(ws.reviews),
      }
    })
  },

  /* ---- meetings ---- */

  scheduleMeeting(input: NewMeetingInput): string {
    const id = newId("m")
    const meeting: Meeting = {
      id,
      personId: input.personId,
      type: input.type,
      scheduledAt: input.scheduledAt,
      durationMin: input.durationMin,
      status: "scheduled",
      agenda: (input.agenda ?? []).map((a) => ({
        id: newId("ag"),
        text: a.text,
        owner: a.owner,
        questionId: a.questionId,
        done: false,
      })),
      sharedNotes: "",
      privateNotes: "",
    }
    set((ws) => ({ ...ws, meetings: [...ws.meetings, meeting] }))
    return id
  },

  updateMeeting(id: string, patch: Partial<Meeting>) {
    patchMeeting(id, patch)
  },

  startMeeting(id: string) {
    patchMeeting(id, (m) => ({
      ...m,
      status: "in-progress",
      startedAt: m.startedAt ?? stamp(),
    }))
  },

  /**
   * Close a conversation. When the person has no other 1:1 on the calendar the
   * next one in the series is scheduled, so the cadence never silently lapses.
   * Returns the id of the next meeting when one was created.
   */
  completeMeeting(id: string): string | undefined {
    let created: string | undefined
    set((ws) => {
      const meeting = ws.meetings.find((m) => m.id === id)
      if (!meeting) return ws
      const at = stamp()
      const meetings = ws.meetings.map((m) =>
        m.id === id
          ? {
              ...m,
              status: "completed" as const,
              startedAt: m.startedAt ?? at,
              endedAt: at,
            }
          : m
      )
      const person = ws.people.find((p) => p.id === meeting.personId)
      if (
        person &&
        person.status === "active" &&
        !nextScheduled(meetings, person.id)
      ) {
        created = newId("m")
        meetings.push({
          id: created,
          personId: person.id,
          type: person.focus === "performance" ? "performance" : "weekly",
          scheduledAt: nextOccurrenceAt(person, meetings),
          durationMin: person.cadence.durationMin,
          status: "scheduled",
          agenda: [],
          sharedNotes: "",
          privateNotes: "",
        })
      }
      return { ...ws, meetings }
    })
    return created
  },

  cancelMeeting(id: string, by: AgendaOwner, reason?: string) {
    patchMeeting(id, {
      status: "cancelled",
      cancelledAt: stamp(),
      cancelledBy: by,
      cancelReason: reason?.trim() || undefined,
    })
  },

  /** Move a meeting instead of cancelling it. Keeps the original time on record. */
  rescheduleMeeting(id: string, scheduledAt: string) {
    patchMeeting(id, (m) => ({
      ...m,
      status: "scheduled",
      rescheduledFrom: m.rescheduledFrom ?? m.scheduledAt,
      scheduledAt,
      cancelledAt: undefined,
      cancelledBy: undefined,
      cancelReason: undefined,
    }))
  },

  addAgendaItem(
    meetingId: string,
    item: Pick<AgendaItem, "text" | "owner"> & Partial<AgendaItem>
  ): string {
    const id = newId("ag")
    patchMeeting(meetingId, (m) => ({
      ...m,
      agenda: [...m.agenda, { done: false, ...item, id }],
    }))
    return id
  },

  updateAgendaItem(
    meetingId: string,
    itemId: string,
    patch: Partial<AgendaItem>
  ) {
    patchMeeting(meetingId, (m) => ({
      ...m,
      agenda: m.agenda.map((a) => (a.id === itemId ? { ...a, ...patch } : a)),
    }))
  },

  removeAgendaItem(meetingId: string, itemId: string) {
    patchMeeting(meetingId, (m) => ({
      ...m,
      agenda: m.agenda.filter((a) => a.id !== itemId),
    }))
  },

  /** Record the answer to the consent gate. Capture needs both to agree. */
  recordConsent(meetingId: string, manager: boolean, report: boolean) {
    const at = stamp()
    set((ws) => {
      const meeting = ws.meetings.find((m) => m.id === meetingId)
      if (!meeting) return ws
      return {
        ...ws,
        meetings: ws.meetings.map((m) =>
          m.id === meetingId ? { ...m, consent: { manager, report, at } } : m
        ),
        consentLog: [
          ...ws.consentLog,
          {
            id: newId("ce"),
            meetingId,
            personId: meeting.personId,
            at,
            manager,
            report,
            outcome: manager && report ? "granted" : "declined",
          },
        ],
      }
    })
  },

  /**
   * Attach transcript text to a meeting and compute the talk statistics. The
   * text gets a deletion day from the retention setting. Refused unless both
   * participants consented.
   */
  attachTranscript(meetingId: string, text: string): boolean {
    const ws = get()
    const meeting = ws.meetings.find((m) => m.id === meetingId)
    const person = meeting && ws.people.find((p) => p.id === meeting.personId)
    if (!meeting || !person) return false
    if (!meeting.consent?.manager || !meeting.consent.report) return false
    const { turns } = parseTranscript(text, ws.manager.name, person.name)
    patchMeeting(meetingId, {
      transcript: {
        text,
        addedAt: stamp(),
        expiresOn: addDays(today(), ws.settings.transcriptTtlDays),
      },
      stats: talkStats(turns),
    })
    return true
  },

  /** Delete the transcript text now. Statistics and confirmed notes remain. */
  purgeTranscript(meetingId: string) {
    patchMeeting(meetingId, { transcript: undefined })
  },

  /** Delete every transcript, regardless of age. Returns how many were removed. */
  purgeAllTranscripts(): number {
    const count = get().meetings.filter((m) => m.transcript).length
    set((ws) => ({
      ...ws,
      meetings: ws.meetings.map((m) =>
        m.transcript ? { ...m, transcript: undefined } : m
      ),
    }))
    return count
  },

  /* ---- pillar 1: commitments ---- */

  addCommitment(input: NewCommitmentInput): string {
    const id = newId("c")
    const commitment: Commitment = {
      id,
      personId: input.personId,
      owner: input.owner,
      text: input.text.trim(),
      dueDate: input.dueDate || undefined,
      status: "open",
      createdAt: stamp(),
      sourceMeetingId: input.sourceMeetingId,
    }
    set((ws) => ({ ...ws, commitments: [...ws.commitments, commitment] }))
    return id
  },

  setCommitmentStatus(id: string, status: CommitmentStatus) {
    patchList("commitments", id, {
      status,
      completedAt: status === "open" ? undefined : stamp(),
    })
  },

  /* ---- pillar 2: goals ---- */

  addGoal(input: NewGoalInput): string {
    const id = newId("g")
    const at = stamp()
    const day = today()
    const goal: Goal = {
      id,
      personId: input.personId,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      quarter: input.quarter ?? quarterOf(day),
      progress: 0,
      status: "on-track",
      readiness: input.readiness,
      keyResults: (input.keyResults ?? [])
        .filter((t) => t.trim())
        .map((text) => ({ id: newId("kr"), text: text.trim(), done: false })),
      validFrom: day,
      recordedAt: at,
      sourceMeetingId: input.sourceMeetingId,
      history: [
        {
          status: "on-track",
          date: day,
          recordedAt: at,
          sourceMeetingId: input.sourceMeetingId,
        },
      ],
    }
    set((ws) => ({ ...ws, goals: [...ws.goals, goal] }))
    return id
  },

  /** Change a goal's status. Done and dropped close the goal's validity. */
  setGoalStatus(
    id: string,
    status: GoalStatus,
    note?: string,
    sourceMeetingId?: string
  ) {
    const day = today()
    patchList("goals", id, (g) => ({
      ...g,
      status,
      progress: status === "done" ? 100 : g.progress,
      validTo: status === "done" || status === "dropped" ? day : undefined,
      history: [
        ...g.history,
        { status, date: day, recordedAt: stamp(), note, sourceMeetingId },
      ],
    }))
  },

  toggleKeyResult(goalId: string, keyResultId: string) {
    patchList("goals", goalId, (g) => {
      const keyResults = g.keyResults.map((k) =>
        k.id === keyResultId ? { ...k, done: !k.done } : k
      )
      const progress = keyResults.length
        ? Math.round(
            (keyResults.filter((k) => k.done).length / keyResults.length) * 100
          )
        : g.progress
      return { ...g, keyResults, progress }
    })
  },

  /* ---- pillar 3: blockers ---- */

  addBlocker(input: NewBlockerInput): string {
    const id = newId("b")
    const at = stamp()
    const day = today()
    const blocker: Blocker = {
      id,
      personId: input.personId,
      title: input.title.trim(),
      category: input.category,
      status: "open",
      occurrences: [
        { date: day, note: input.note, sourceMeetingId: input.sourceMeetingId },
      ],
      validFrom: day,
      recordedAt: at,
      history: [
        {
          status: "open",
          date: day,
          recordedAt: at,
          sourceMeetingId: input.sourceMeetingId,
        },
      ],
    }
    set((ws) => ({ ...ws, blockers: [...ws.blockers, blocker] }))
    return id
  },

  /** The blocker came up again: add an occurrence, which raises its count. */
  logBlockerOccurrence(id: string, note?: string, sourceMeetingId?: string) {
    patchList("blockers", id, (b) => ({
      ...b,
      occurrences: [...b.occurrences, { date: today(), note, sourceMeetingId }],
    }))
  },

  setBlockerStatus(
    id: string,
    status: BlockerStatus,
    note?: string,
    escalatedTo?: string
  ) {
    const day = today()
    patchList("blockers", id, (b) => ({
      ...b,
      status,
      escalatedTo:
        status === "escalated"
          ? escalatedTo?.trim() || b.escalatedTo
          : b.escalatedTo,
      validTo: status === "resolved" ? day : undefined,
      history: [...b.history, { status, date: day, recordedAt: stamp(), note }],
    }))
  },

  /* ---- pillar 4: feedback ---- */

  addFeedback(input: NewFeedbackInput): string {
    const id = newId("f")
    const entry: FeedbackEntry = { ...input, id, recordedAt: stamp() }
    set((ws) => ({ ...ws, feedback: [...ws.feedback, entry] }))
    return id
  },

  markFeedbackDelivered(id: string, day: string = today()) {
    patchList("feedback", id, { deliveredDate: day })
  },

  /* ---- pillar 5: career ---- */

  /**
   * Record a new aspiration. The current one is closed, not overwritten, so
   * the change of direction stays on the record.
   */
  setAspiration(input: NewAspirationInput): string {
    const id = newId("a")
    const day = today()
    const next: Aspiration = {
      id,
      personId: input.personId,
      statement: input.statement.trim(),
      track: input.track,
      targetRole: input.targetRole?.trim() || undefined,
      horizonMonths: input.horizonMonths ?? 18,
      validFrom: day,
      recordedAt: stamp(),
      sourceMeetingId: input.sourceMeetingId,
    }
    set((ws) => ({
      ...ws,
      aspirations: [
        ...ws.aspirations.map((a) =>
          a.personId === input.personId && !a.validTo
            ? { ...a, validTo: day }
            : a
        ),
        next,
      ],
    }))
    return id
  },

  addMilestone(input: NewMilestoneInput): string {
    const id = newId("ms")
    const at = stamp()
    const day = today()
    const status = input.status ?? "planned"
    const milestone: Milestone = {
      id,
      personId: input.personId,
      kind: input.kind,
      title: input.title.trim(),
      competency: input.competency,
      status,
      targetDate: input.targetDate || undefined,
      evidence: [],
      validFrom: day,
      recordedAt: at,
      sourceMeetingId: input.sourceMeetingId,
      history: [
        {
          status,
          date: day,
          recordedAt: at,
          sourceMeetingId: input.sourceMeetingId,
        },
      ],
    }
    set((ws) => ({ ...ws, milestones: [...ws.milestones, milestone] }))
    return id
  },

  setMilestoneStatus(
    id: string,
    status: MilestoneStatus,
    sourceMeetingId?: string
  ) {
    patchList("milestones", id, (m) => ({
      ...m,
      status,
      history: [
        ...m.history,
        { status, date: today(), recordedAt: stamp(), sourceMeetingId },
      ],
    }))
  },

  addMilestoneEvidence(id: string, note: string) {
    patchList("milestones", id, (m) => ({
      ...m,
      evidence: [...m.evidence, { date: today(), note: note.trim() }],
    }))
  },

  /* ---- pillar 6: workload ---- */

  /** Log a voluntary pulse. One per person per day: a second replaces the first. */
  logPulse(input: NewPulseInput): string {
    const id = newId("pu")
    const date = input.date ?? today()
    const pulse: Pulse = {
      id,
      personId: input.personId,
      date,
      energy: Math.min(5, Math.max(1, Math.round(input.energy))),
      workload: Math.min(5, Math.max(1, Math.round(input.workload))),
      note: input.note?.trim() || undefined,
      sourceMeetingId: input.sourceMeetingId,
    }
    set((ws) => ({
      ...ws,
      pulses: [
        ...ws.pulses.filter(
          (p) => !(p.personId === input.personId && p.date === date)
        ),
        pulse,
      ],
    }))
    return id
  },

  addWorkloadMarker(input: NewWorkloadMarkerInput): string {
    const id = newId("w")
    const marker: WorkloadMarker = { ...input, id, date: input.date ?? today() }
    set((ws) => ({ ...ws, workloadMarkers: [...ws.workloadMarkers, marker] }))
    return id
  },

  resolveWorkloadMarker(id: string) {
    patchList("workloadMarkers", id, { resolvedDate: today() })
  },

  /* ---- pillar 7: retention ---- */

  addStayDriver(input: NewStayDriverInput): string {
    const id = newId("s")
    const driver: StayDriver = {
      id,
      personId: input.personId,
      kind: input.kind,
      text: input.text.trim(),
      action: input.action?.trim() || undefined,
      validFrom: today(),
      recordedAt: stamp(),
      sourceMeetingId: input.sourceMeetingId,
    }
    set((ws) => ({ ...ws, stayDrivers: [...ws.stayDrivers, driver] }))
    return id
  },

  /** The driver no longer applies. Closes it and keeps it in history. */
  retireStayDriver(id: string) {
    patchList("stayDrivers", id, { validTo: today() })
  },

  /* ---- coaching, questions, reviews ---- */

  /** Save the private coaching card for a meeting, replacing an earlier one. */
  saveCoachingCard(card: Omit<CoachingCard, "id" | "createdAt">): string {
    const id = newId("cc")
    set((ws) => ({
      ...ws,
      coachingCards: [
        ...ws.coachingCards.filter((c) => c.meetingId !== card.meetingId),
        { ...card, id, createdAt: stamp() },
      ],
    }))
    return id
  },

  addQuestion(input: Omit<Question, "id" | "custom">): string {
    const id = newId("q")
    set((ws) => ({
      ...ws,
      customQuestions: [...ws.customQuestions, { ...input, id, custom: true }],
    }))
    return id
  },

  saveReview(
    input: Omit<ReviewDraft, "id" | "createdAt" | "updatedAt">,
    id?: string
  ): string {
    const at = stamp()
    if (id) {
      patchList("reviews", id, { ...input, updatedAt: at })
      return id
    }
    const next = newId("r")
    set((ws) => ({
      ...ws,
      reviews: [
        ...ws.reviews,
        { ...input, id: next, createdAt: at, updatedAt: at },
      ],
    }))
    return next
  },

  /* ---- settings and data ---- */

  updateSettings(patch: Partial<Settings>) {
    set((ws) => {
      const settings = { ...ws.settings, ...patch }
      settings.transcriptTtlDays = Math.min(
        TRANSCRIPT_TTL_RANGE.max,
        Math.max(
          TRANSCRIPT_TTL_RANGE.min,
          Math.round(settings.transcriptTtlDays)
        )
      )
      // Releasing a hold lets the normal schedule catch up at once.
      return purgeExpired({ ...ws, settings })
    })
  },

  updateManager(patch: Partial<ManagerProfile>) {
    set((ws) => ({ ...ws, manager: { ...ws.manager, ...patch } }))
  },

  dismissNudge(id: string) {
    set((ws) =>
      ws.settings.dismissedNudges.includes(id)
        ? ws
        : {
            ...ws,
            settings: {
              ...ws.settings,
              dismissedNudges: [...ws.settings.dismissedNudges, id],
            },
          }
    )
  },

  /** The whole workspace as formatted JSON, for a backup file. */
  exportWorkspace(): string {
    return JSON.stringify(get(), null, 2)
  },

  /** Replace the workspace with an exported file. Throws when the file is not one. */
  importWorkspace(json: string) {
    set(purgeExpired(normalizeWorkspace(JSON.parse(json))))
  },

  /** Replace everything with a fresh copy of the sample team. */
  loadSample() {
    set(buildSampleWorkspace())
  },

  /** Remove every record and keep the manager profile and settings. */
  clearAll() {
    set((ws) => ({
      ...emptyWorkspace(ws.manager),
      settings: { ...ws.settings, sampleData: false, dismissedNudges: [] },
    }))
  },
}

/** Meetings on a person's record whose day matches, for duplicate checks. */
export function hasMeetingOn(ws: Workspace, personId: string, day: string) {
  return ws.meetings.some(
    (m) =>
      m.personId === personId &&
      m.status !== "cancelled" &&
      dayOf(m.scheduledAt) === day
  )
}
