/**
 * Vantage domain model.
 *
 * One workspace belongs to one manager and lives in the browser. Every durable
 * record hangs off a `Person` (a direct report) and falls under one of the
 * seven tracking pillars: commitments, goals, blockers, feedback, career,
 * workload and retention.
 *
 * Date conventions: fields named `*At` are ISO instants; fields named `*Date`,
 * `validFrom`, `validTo`, `date` and `day` are local `YYYY-MM-DD` strings.
 *
 * Progress records are bi-temporal. `validFrom` / `validTo` say when a fact
 * held in reality, `recordedAt` says when the workspace learned it, and
 * `sourceMeetingId` points at the 1:1 it came from. A change closes the old
 * fact instead of overwriting it, so "what was true in June" stays answerable.
 */

/* ------------------------------------------------------------------ people */

export type WorkMode = "remote" | "hybrid" | "onsite"

/** Drives the recommended cadence. See `cadenceProfiles` in lib/constants. */
export type CadenceProfile =
  "new-hire" | "established-ic" | "senior-ic" | "team-lead"

export type Frequency = "weekly" | "biweekly"

export interface CadenceConfig {
  frequency: Frequency
  durationMin: number
  /** 0 = Sunday ... 6 = Saturday. */
  weekday: number
  /** Local `HH:MM`. */
  time: string
}

export type RecognitionPref = "public" | "private" | "either"

/** What the relationship is focused on right now. */
export type PersonFocus = "standard" | "onboarding" | "performance"

export interface Person {
  /** `p-` prefix. */
  id: string
  name: string
  email?: string
  role: string
  level?: string
  team?: string
  location?: string
  /** First day in the role or on the team. */
  startDate: string
  workMode: WorkMode
  profile: CadenceProfile
  focus: PersonFocus
  cadence: CadenceConfig
  recognitionPref: RecognitionPref
  /** How this person likes to receive feedback, in their words. */
  feedbackStyle?: string
  /** Private rapport notes: family, hobbies, what matters to them. */
  rapportNotes?: string
  /** Day of the last formal performance review, if known. */
  lastReviewDate?: string
  status: "active" | "archived"
  createdAt: string
}

/* ---------------------------------------------------------------- meetings */

export type MeetingType =
  "weekly" | "career" | "stay" | "onboarding" | "burnout" | "performance"

export type MeetingStatus =
  "scheduled" | "in-progress" | "completed" | "cancelled"

export type AgendaOwner = "report" | "manager"

export interface AgendaItem {
  id: string
  text: string
  owner: AgendaOwner
  done: boolean
  /** Question bank id when the item came from a suggested question. */
  questionId?: string
  /** Notes taken against this item during the conversation. */
  notes?: string
}

/** Either party may decline; capture stays off unless both agreed. */
export interface ConsentState {
  manager: boolean
  report: boolean
  /** When the gate was answered. */
  at: string
}

export interface TalkStats {
  /** Share of words spoken by the direct report, 0 to 100. */
  reportShare: number
  managerWords: number
  reportWords: number
  /** Longest uninterrupted manager turn, in estimated seconds. */
  longestManagerMonologueSec: number
  managerQuestions: number
  openQuestions: number
  turns: number
  /** Minutes covered by the transcript, estimated from words when untimed. */
  estimatedMinutes: number
}

/** Raw transcript text. Short lived: purged after the retention window. */
export interface TranscriptRecord {
  text: string
  addedAt: string
  /** Day on which the text is deleted unless legal hold is on. */
  expiresOn: string
}

export interface MeetingSummary {
  topics: string[]
  /** Editable shared summary, identical for both participants. */
  text: string
  /** Set when the manager confirms the summary as accurate. */
  confirmedAt?: string
}

export interface Meeting {
  /** `m-` prefix. */
  id: string
  personId: string
  type: MeetingType
  scheduledAt: string
  durationMin: number
  status: MeetingStatus
  agenda: AgendaItem[]
  /** Visible to both participants. */
  sharedNotes: string
  /** Manager only. Never part of a shared export. */
  privateNotes: string
  startedAt?: string
  endedAt?: string
  cancelledAt?: string
  cancelledBy?: AgendaOwner
  cancelReason?: string
  /** Original time when the meeting was moved rather than cancelled. */
  rescheduledFrom?: string
  consent?: ConsentState
  /** Minutes spent off the record during the conversation. */
  pausedMinutes?: number
  transcript?: TranscriptRecord
  stats?: TalkStats
  summary?: MeetingSummary
}

/* ------------------------------------------------- pillar 1: commitments */

export type CommitmentStatus = "open" | "done" | "dropped"

export interface Commitment {
  /** `c-` prefix. */
  id: string
  personId: string
  /** Who owes it: the manager or the direct report. */
  owner: AgendaOwner
  text: string
  dueDate?: string
  status: CommitmentStatus
  createdAt: string
  completedAt?: string
  sourceMeetingId?: string
}

/* ------------------------------------------------------- pillar 2: goals */

export type GoalStatus =
  "on-track" | "at-risk" | "off-track" | "done" | "dropped"

/**
 * SLII development level for one goal, which sets the matching leadership
 * style: D1 directing, D2 coaching, D3 supporting, D4 delegating.
 */
export type Readiness = "D1" | "D2" | "D3" | "D4"

export interface KeyResult {
  id: string
  text: string
  done: boolean
}

export interface StatusChange<S extends string = string> {
  status: S
  /** Day the change took effect. */
  date: string
  recordedAt: string
  note?: string
  sourceMeetingId?: string
}

export interface Goal {
  /** `g-` prefix. */
  id: string
  personId: string
  title: string
  description?: string
  /** "2026-Q4". */
  quarter: string
  progress: number
  status: GoalStatus
  readiness: Readiness
  keyResults: KeyResult[]
  /** The manager objective this goal supports, when it supports one. */
  objectiveId?: string
  validFrom: string
  validTo?: string
  recordedAt: string
  sourceMeetingId?: string
  history: StatusChange<GoalStatus>[]
}

/* ---------------------------------------------------- pillar 3: blockers */

export type BlockerCategory =
  "cross-team" | "tooling" | "process" | "clarity" | "capacity" | "other"

export type BlockerStatus = "open" | "escalated" | "resolved"

export interface BlockerOccurrence {
  date: string
  note?: string
  sourceMeetingId?: string
}

export interface Blocker {
  /** `b-` prefix. */
  id: string
  personId: string
  title: string
  category: BlockerCategory
  status: BlockerStatus
  /** Every time the blocker came up. Its length is the recurrence count. */
  occurrences: BlockerOccurrence[]
  escalatedTo?: string
  validFrom: string
  validTo?: string
  recordedAt: string
  history: StatusChange<BlockerStatus>[]
}

/* ---------------------------------------------------- pillar 4: feedback */

export type FeedbackKind = "recognition" | "developmental"

/** `given` is manager to report. `upward` is report to manager. */
export type FeedbackDirection = "given" | "upward"

export type CompetencyArea = "craft" | "collaboration" | "multiplying"

export interface FeedbackEntry {
  /** `f-` prefix. */
  id: string
  personId: string
  kind: FeedbackKind
  direction: FeedbackDirection
  situation: string
  behavior: string
  impact: string
  /** The intent question or answer that closes SBII. */
  intent?: string
  /** Day the behavior was observed. */
  observedDate: string
  /** Day it was said to the person. Empty while still a draft. */
  deliveredDate?: string
  competency?: CompetencyArea
  recordedAt: string
  sourceMeetingId?: string
}

/* ------------------------------------------------------ pillar 5: career */

export type CareerTrack = "ic" | "management" | "specialist" | "exploring"

export interface Aspiration {
  /** `a-` prefix. */
  id: string
  personId: string
  statement: string
  track: CareerTrack
  /** Target role or level, such as "Staff Engineer". */
  targetRole?: string
  horizonMonths: number
  validFrom: string
  validTo?: string
  recordedAt: string
  sourceMeetingId?: string
}

export type MilestoneKind = "skill" | "stretch" | "competency" | "onboarding"

export type MilestoneStatus = "planned" | "in-progress" | "demonstrated"

export interface Milestone {
  /** `ms-` prefix. */
  id: string
  personId: string
  kind: MilestoneKind
  title: string
  competency?: CompetencyArea
  status: MilestoneStatus
  targetDate?: string
  /** Dated observations that support the milestone. */
  evidence: { date: string; note: string }[]
  validFrom: string
  validTo?: string
  recordedAt: string
  sourceMeetingId?: string
  history: StatusChange<MilestoneStatus>[]
}

/* ---------------------------------------------------- pillar 6: workload */

/** Voluntary self-reported check-in. Never inferred. */
export interface Pulse {
  /** `pu-` prefix. */
  id: string
  personId: string
  date: string
  /** 1 (drained) to 5 (energized). */
  energy: number
  /** 1 (light) to 5 (unsustainable). */
  workload: number
  note?: string
  sourceMeetingId?: string
}

export type WorkloadMarkerKind =
  | "crunch"
  | "context-switching"
  | "pto-gap"
  | "after-hours"
  | "scope-growth"
  | "on-call"

/** Maslach dimension the person described, in their own words. */
export type BurnoutDimension = "exhaustion" | "cynicism" | "efficacy"

export interface WorkloadMarker {
  /** `w-` prefix. */
  id: string
  personId: string
  kind: WorkloadMarkerKind
  note: string
  dimension?: BurnoutDimension
  date: string
  resolvedDate?: string
  sourceMeetingId?: string
}

/* --------------------------------------------------- pillar 7: retention */

export type StayDriverKind =
  "energizer" | "friction" | "stay-reason" | "leave-trigger" | "learning"

export interface StayDriver {
  /** `s-` prefix. */
  id: string
  personId: string
  kind: StayDriverKind
  text: string
  /** The stay action the manager committed to, if any. */
  action?: string
  validFrom: string
  validTo?: string
  recordedAt: string
  sourceMeetingId?: string
}

/* ---------------------------------------------------------------- coaching */

export type CoachingFramework =
  "Rogelberg" | "Project Oxygen" | "GROW" | "SBII" | "Radical Candor" | "SLII"

export interface CoachingNudge {
  title: string
  body: string
  framework: CoachingFramework
}

/** Private to the manager. Never shared, never exported with shared notes. */
export interface CoachingCard {
  /** `cc-` prefix. */
  id: string
  meetingId: string
  personId: string
  createdAt: string
  stats: TalkStats
  nudges: CoachingNudge[]
  /** What went well, stated plainly. */
  strengths: string[]
  /** Manager's own reflection. */
  reflection?: string
}

/* ----------------------------------------------------------- question bank */

export type QuestionScenario =
  | "opening"
  | "blockers"
  | "grow"
  | "upward"
  | "onboarding"
  | "career"
  | "stay"
  | "burnout"
  | "performance"
  | "connection"

export interface Question {
  /** `q-` prefix. Built-in ids are stable. */
  id: string
  scenario: QuestionScenario
  text: string
  /** Why the question is worth asking. */
  purpose?: string
  /** What to do with the answer. */
  followUp?: string
  /** GROW stage, burnout dimension or similar short label. */
  tag?: string
  custom?: boolean
}

/* ------------------------------------------------------------ trust layer */

export interface ConsentEvent {
  /** `ce-` prefix. */
  id: string
  meetingId: string
  personId: string
  at: string
  manager: boolean
  report: boolean
  /** `granted` only when both agreed. */
  outcome: "granted" | "declined"
}

export interface Settings {
  /** Days a pasted transcript is kept before it is deleted. */
  transcriptTtlDays: number
  /** Pauses transcript deletion while a hold is in force. */
  legalHold: boolean
  /** Meeting titles or types matching these never offer transcript capture. */
  sensitiveKeywords: string[]
  /** Disables individual analytics views for works council deployments. */
  worksCouncilMode: boolean
  /** Local `HH:MM` the morning brief is considered ready. */
  briefTime: string
  /** True while the workspace still holds the sample team. */
  sampleData: boolean
  /** Dismissed nudge ids, so a handled nudge does not come back. */
  dismissedNudges: string[]
}

export interface ManagerProfile {
  name: string
  title: string
  email: string
  team: string
}

/* ---------------------------------------------------------------- reviews */

export interface ReviewDraft {
  /** `r-` prefix. */
  id: string
  personId: string
  from: string
  to: string
  /** Editable markdown. Evidence only: never a rating. */
  body: string
  createdAt: string
  updatedAt: string
}

/* -------------------------------------------------------------- workspace */

export interface Workspace {
  version: 1
  manager: ManagerProfile
  settings: Settings
  people: Person[]
  meetings: Meeting[]
  commitments: Commitment[]
  goals: Goal[]
  objectives: Objective[]
  blockers: Blocker[]
  feedback: FeedbackEntry[]
  aspirations: Aspiration[]
  milestones: Milestone[]
  pulses: Pulse[]
  workloadMarkers: WorkloadMarker[]
  stayDrivers: StayDriver[]
  coachingCards: CoachingCard[]
  customQuestions: Question[]
  consentLog: ConsentEvent[]
  reviews: ReviewDraft[]
}

/* ------------------------------------------------------------- alignment */

/**
 * `business` is a goal the company or department has set. `manager` is one of
 * the manager's own goals, which can support a business goal.
 */
export type ObjectiveLevel = "business" | "manager"

/** A goal above the individual: the direction team goals line up behind. */
export interface Objective {
  /** `o-` prefix. */
  id: string
  level: ObjectiveLevel
  title: string
  /** How success is judged, in plain words: "Uptime at 99.95 percent". */
  measure?: string
  /** For a manager objective: the business goal it supports. */
  parentId?: string
  status: GoalStatus
  validFrom: string
  validTo?: string
  recordedAt: string
  history: StatusChange<GoalStatus>[]
}

/** Keys of the workspace that hold `{ id: string }` lists. */
export type CollectionKey = {
  [K in keyof Workspace]: Workspace[K] extends { id: string }[] ? K : never
}[keyof Workspace]

export type CollectionItem<K extends CollectionKey> = Workspace[K][number]
