import type {
  BlockerCategory,
  BurnoutDimension,
  CadenceConfig,
  CadenceProfile,
  CareerTrack,
  CompetencyArea,
  FeedbackKind,
  Frequency,
  GoalStatus,
  MeetingType,
  MilestoneKind,
  MilestoneStatus,
  PersonFocus,
  QuestionScenario,
  Readiness,
  RecognitionPref,
  StayDriverKind,
  WorkloadMarkerKind,
  WorkMode,
} from "@/lib/types"

/* ------------------------------------------------------------ thresholds */

/** The direct report should speak between these shares of the conversation. */
export const TALK_SHARE_MIN = 50
export const TALK_SHARE_MAX = 90
/** A manager turn longer than this many seconds counts as a monologue. */
export const MONOLOGUE_LIMIT_SEC = 90
/** Fewer open questions than this in one 1:1 earns a coaching nudge. */
export const OPEN_QUESTION_TARGET = 3
/** A blocker raised this many times triggers a GROW coaching prompt. */
export const BLOCKER_RECURRENCE_TRIGGER = 3
/** Days without a career conversation before one is suggested. */
export const CAREER_GAP_DAYS = 75
/** Days between stay interviews. */
export const STAY_INTERVAL_DAYS = 180
/** Corrective feedback should be delivered within this many hours. */
export const FEEDBACK_WINDOW_HOURS = 48
/** Days without any logged feedback before a reminder appears. */
export const FEEDBACK_GAP_DAYS = 30
/** Average energy at or below this over the recent pulses flags a check-in. */
export const LOW_ENERGY_THRESHOLD = 2.5
/** Average workload at or above this over the recent pulses flags a check-in. */
export const HIGH_WORKLOAD_THRESHOLD = 4
/** How many recent pulses the workload signals look at. */
export const PULSE_WINDOW = 3
/** Cancellations within the look-back window that count as cadence drift. */
export const CANCEL_DRIFT_COUNT = 2
export const CANCEL_DRIFT_WINDOW_DAYS = 42
/** Onboarding checkpoints, in days since the start date. */
export const ONBOARDING_CHECKPOINTS = [7, 30, 60, 90] as const
/** A new hire leaves the onboarding window after this many days. */
export const ONBOARDING_DAYS = 90
/** Speaking rate used to turn word counts into time when a transcript has no stamps. */
export const WORDS_PER_MINUTE = 150
/** Allowed range for the transcript retention setting, in days. */
export const TRANSCRIPT_TTL_RANGE = { min: 1, max: 30, default: 14 } as const

export const DEFAULT_SENSITIVE_KEYWORDS = [
  "PIP",
  "HR",
  "Legal",
  "Investigation",
  "Termination",
  "Compensation",
  "Disciplinary",
]

/* ------------------------------------------------------------------ labels */

export const workModeLabels: Record<WorkMode, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On site",
}

export const frequencyLabels: Record<Frequency, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
}

export const weekdayLabels = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

export const recognitionLabels: Record<RecognitionPref, string> = {
  public: "In public",
  private: "In private",
  either: "Either works",
}

export const focusLabels: Record<PersonFocus, string> = {
  standard: "Steady state",
  onboarding: "Onboarding",
  performance: "Performance support",
}

export const meetingTypeLabels: Record<MeetingType, string> = {
  weekly: "Weekly 1:1",
  career: "Career conversation",
  stay: "Stay interview",
  onboarding: "Onboarding check-in",
  burnout: "Workload check-in",
  performance: "Performance check-in",
}

export const meetingTypeDescriptions: Record<MeetingType, string> = {
  weekly:
    "The standing conversation: their agenda first, blockers, coaching, commitments.",
  career:
    "Once a quarter, replaces a regular 1:1. Aspirations, skill gaps and stretch work only.",
  stay: "Every six months, kept apart from the review cycle. Five questions on why they stay.",
  onboarding:
    "Day 7, 30, 60 and 90 checkpoints for a new hire: clarity, access and connection.",
  burnout:
    "A focused conversation about energy and load when the signals call for one.",
  performance:
    "Weekly check-in against agreed goals. Manual notes only: capture is switched off.",
}

/** Meeting types that never offer transcript capture. */
export const SENSITIVE_MEETING_TYPES: MeetingType[] = ["performance"]

export const goalStatusLabels: Record<GoalStatus, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  "off-track": "Off track",
  done: "Done",
  dropped: "Dropped",
}

export const readinessLabels: Record<
  Readiness,
  { level: string; style: string; guidance: string }
> = {
  D1: {
    level: "New to this",
    style: "Directing",
    guidance:
      "Give clear steps, examples and close follow-up. Decide together what done looks like.",
  },
  D2: {
    level: "Learning, some frustration",
    style: "Coaching",
    guidance:
      "Explain the why, ask for their ideas, keep the final call and praise progress.",
  },
  D3: {
    level: "Capable, variable confidence",
    style: "Supporting",
    guidance:
      "Ask rather than tell. Back their approach and help remove obstacles.",
  },
  D4: {
    level: "Self-reliant",
    style: "Delegating",
    guidance:
      "Hand over the outcome and the decisions. Stay available and check in on results only.",
  },
}

export const blockerCategoryLabels: Record<BlockerCategory, string> = {
  "cross-team": "Cross-team dependency",
  tooling: "Tooling",
  process: "Process",
  clarity: "Unclear direction",
  capacity: "Capacity",
  other: "Other",
}

export const feedbackKindLabels: Record<FeedbackKind, string> = {
  recognition: "Recognition",
  developmental: "Developmental",
}

export const competencyLabels: Record<CompetencyArea, string> = {
  craft: "Individual contribution",
  collaboration: "Collaboration",
  multiplying: "Multiplying others",
}

export const careerTrackLabels: Record<CareerTrack, string> = {
  ic: "Individual contributor",
  management: "People management",
  specialist: "Specialist",
  exploring: "Still exploring",
}

export const milestoneKindLabels: Record<MilestoneKind, string> = {
  skill: "Skill",
  stretch: "Stretch assignment",
  competency: "Next-level behavior",
  onboarding: "Onboarding checkpoint",
}

export const milestoneStatusLabels: Record<MilestoneStatus, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  demonstrated: "Demonstrated",
}

export const workloadMarkerLabels: Record<WorkloadMarkerKind, string> = {
  crunch: "Crunch period",
  "context-switching": "Heavy context switching",
  "pto-gap": "No time off recently",
  "after-hours": "Working after hours",
  "scope-growth": "Scope grew without trade-offs",
  "on-call": "On-call load",
}

export const burnoutDimensionLabels: Record<
  BurnoutDimension,
  { label: string; description: string }
> = {
  exhaustion: {
    label: "Exhaustion",
    description: "Energy is depleted. Rest does not restore it.",
  },
  cynicism: {
    label: "Detachment",
    description: "Work that used to matter now feels pointless or frustrating.",
  },
  efficacy: {
    label: "Reduced efficacy",
    description: "Wins stop registering. Confidence in the work drops.",
  },
}

export const stayDriverLabels: Record<StayDriverKind, string> = {
  energizer: "Looks forward to",
  learning: "Wants to learn",
  "stay-reason": "Reason to stay",
  "leave-trigger": "Thought about leaving",
  friction: "Friction",
}

export const pulseEnergyLabels = [
  "Drained",
  "Low",
  "Steady",
  "Good",
  "Energized",
] as const

export const pulseWorkloadLabels = [
  "Light",
  "Comfortable",
  "Full",
  "Stretched",
  "Unsustainable",
] as const

export const scenarioLabels: Record<QuestionScenario, string> = {
  connection: "Human connection",
  opening: "Opening and ownership",
  blockers: "Blockers and clarity",
  grow: "GROW coaching",
  upward: "Upward feedback",
  onboarding: "Onboarding",
  career: "Career growth",
  stay: "Stay interview",
  burnout: "Workload and energy",
  performance: "Performance support",
}

/* -------------------------------------------------------------- cadence */

export interface CadenceProfileSpec {
  label: string
  description: string
  cadence: Pick<CadenceConfig, "frequency" | "durationMin">
  /** Shown next to the recommendation. */
  rationale: string
  focus: string
}

export const cadenceProfiles: Record<CadenceProfile, CadenceProfileSpec> = {
  "new-hire": {
    label: "New hire",
    description: "In their first 90 days",
    cadence: { frequency: "weekly", durationMin: 45 },
    rationale:
      "Weekly, 45 to 60 minutes in the first month, then 30. Add a short mid-week check-in during month one.",
    focus:
      "Expectation clarity, access and tooling, introductions, 30/60/90 milestones.",
  },
  "established-ic": {
    label: "Established individual contributor",
    description: "Past onboarding, steady in the role",
    cadence: { frequency: "weekly", durationMin: 30 },
    rationale:
      "Weekly for 30 minutes. For remote and hybrid staff this replaces the hallway context they no longer get.",
    focus: "Their agenda, blockers, coaching and regular feedback.",
  },
  "senior-ic": {
    label: "Senior or principal contributor",
    description: "High autonomy, strong async habits",
    cadence: { frequency: "biweekly", durationMin: 45 },
    rationale:
      "Weekly for 20 to 30 minutes or every two weeks for 45. Never stretch to monthly: recency bias takes over.",
    focus:
      "Strategic alignment, cross-team friction, multiplier impact and delegation.",
  },
  "team-lead": {
    label: "Team lead or manager",
    description: "Manages people or leads a team",
    cadence: { frequency: "weekly", durationMin: 45 },
    rationale:
      "Weekly for 45 to 60 minutes. You are coaching a coach, so leave room for team health and trade-offs.",
    focus:
      "Coaching the coach, organizational context, team health and leadership growth.",
  },
}

/** The 30-minute weekly runbook, as fractions of the scheduled duration. */
export const runbookPhases = [
  {
    id: "connect",
    title: "Connection and energy pulse",
    share: 5 / 30,
    range: "0 to 5 min",
    guidance:
      "Open with a real, non-work check-in and a quick 1 to 5 energy and workload read. Name one recent win with specific praise: situation, behavior, impact.",
  },
  {
    id: "their-agenda",
    title: "Their agenda and blockers",
    share: 15 / 30,
    range: "5 to 20 min",
    guidance:
      "Their items, in their order. Tell me more, and how can I help? Offer a midpoint time check if one topic is taking the whole block.",
  },
  {
    id: "context",
    title: "Context, coaching and upward feedback",
    share: 7 / 30,
    range: "20 to 27 min",
    guidance:
      "Share the decisions that touch their scope. Rotate one development prompt: a career check, a GROW question, or ask how you can manage them better.",
  },
  {
    id: "close",
    title: "Commitment lock and close",
    share: 3 / 30,
    range: "27 to 30 min",
    guidance:
      "Recap what each of you committed to, with owners and dates. Ask what else you can do to support them. End on time, with thanks.",
  },
] as const

export const groundRules = [
  {
    title: "Their agenda comes first",
    body: "1:1s rate highest when the direct report sets the agenda or builds it with you. Ask for one to three talking points a day ahead and add your items underneath.",
  },
  {
    title: `They talk ${TALK_SHARE_MIN} to ${TALK_SHARE_MAX} percent of the time`,
    body: "How much the direct report speaks is the strongest predictor of a useful 1:1. Sit with the pause. Back their workable plan even when you would have done it differently.",
  },
  {
    title: "Mornings, capped at 30 minutes",
    body: "Afternoon meetings show lower engagement than morning ones, and remote participants fade in longer sessions. Schedule early when time zones allow.",
  },
  {
    title: "Never cancel, reschedule",
    body: "A cancelled 1:1 says the person is a low priority. Move it within the same week, or shorten it during a crunch instead of dropping it.",
  },
  {
    title: `Corrective feedback within ${FEEDBACK_WINDOW_HOURS} hours`,
    body: "Give urgent corrective feedback privately, close to the event. Saving it for the 1:1 turns a safe space into a surprise audit.",
  },
] as const

export const frameworks = [
  {
    id: "rogelberg",
    name: "The science of 1:1s",
    source: "Steven Rogelberg, Glad We Met",
    principle:
      "The 1:1 is the core of the manager's job. It balances productivity, relationship and development, and the direct report does most of the talking.",
    inPractice:
      "Weekly or every two weeks, their agenda, no cancellations, listening over telling.",
    inVantage:
      "Agenda prompts, talk share measurement, cancellation drift alerts and commitment carry-over.",
  },
  {
    id: "oxygen",
    name: "Project Oxygen and Project Aristotle",
    source: "Google people analytics",
    principle:
      "Ten behaviors mark effective managers, eight of them relational. Psychological safety is the base of an effective team.",
    inPractice:
      "Coach instead of fixing, empower without micromanaging, care about wellbeing, share the vision, advocate for careers.",
    inVantage:
      "A private coaching card after each conversation, mapped to these behaviors.",
  },
  {
    id: "sbii",
    name: "Radical Candor, SBII and GROW",
    source: "Kim Scott, Center for Creative Leadership, John Whitmore",
    principle:
      "Care personally and challenge directly. Feedback names the situation, the behavior, its impact and asks about intent. Coaching moves from goal to reality to options to will.",
    inPractice: `Behavioral feedback inside ${FEEDBACK_WINDOW_HOURS} hours. Longer developmental questions over several weeks.`,
    inVantage:
      "A structured feedback composer and ledger, plus GROW prompts when a blocker keeps coming back.",
  },
  {
    id: "slii",
    name: "Situational leadership",
    source: "Hersey and Blanchard, with Greenleaf's servant leadership",
    principle:
      "Match direction and support to the person's competence and commitment on each task, not to the person overall.",
    inPractice:
      "Direct on new ground, coach while they learn, support when capable, delegate at mastery.",
    inVantage:
      "A readiness level on every goal that tailors the guidance you see.",
  },
  {
    id: "retention",
    name: "Burnout model and stay interviews",
    source: "Christina Maslach, Richard Finnegan",
    principle:
      "Burnout moves from exhaustion to detachment to reduced efficacy. People stay for reasons you can ask about before they leave.",
    inPractice:
      "Stay conversations apart from appraisals. Fix the work conditions before offering wellness advice.",
    inVantage:
      "Stay interview mode every six months, voluntary 1 to 5 pulses and tracking of stated workload pressure. No emotion inference of any kind.",
  },
] as const

/** Hierarchy of controls for overload: change the work before coaching the person. */
export const workloadControls = [
  "Cut or defer scope",
  "Reprioritize with the stakeholder",
  "Give decision authority back",
  "Protect focus time",
  "Plan time off",
] as const

export const trustGuarantees = [
  {
    title: "The record belongs to the two of you",
    body: "A workspace holds one manager's notes. Nothing is sent to a server, and there is no HR or executive view.",
  },
  {
    title: "No audio, short-lived transcripts",
    body: "Vantage never records audio. A transcript you paste is reduced to notes you approve and then deleted on a schedule you set.",
  },
  {
    title: "Either person can go off the record",
    body: "Pause capture at any moment. Anything said while paused is left out of the transcript analysis.",
  },
  {
    title: "No emotion inference",
    body: "Vantage does not read tone, stress or sentiment. Workload awareness comes only from voluntary 1 to 5 pulses and pressure the person states in words.",
  },
  {
    title: "Sensitive conversations stay manual",
    body: "Performance, compensation, legal and similar conversations never offer transcript capture. Take deliberate notes instead.",
  },
  {
    title: "A human confirms every record",
    body: "Drafts pulled from a transcript are suggestions. Nothing enters the record, and no rating is ever produced, without your review.",
  },
] as const
