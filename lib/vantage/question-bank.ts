import type { MeetingType, Question, QuestionScenario } from "@/lib/types"

/**
 * Built-in situational questions. Ids are stable: agenda items and nudges
 * reference them. Custom questions live in the workspace and use generated ids.
 */
export const builtInQuestions: Question[] = [
  /* connection */
  {
    id: "q-connect-1",
    scenario: "connection",
    text: "What was the best part of your week outside of work?",
    purpose: "Starts the conversation as two people, not two roles.",
  },
  {
    id: "q-connect-2",
    scenario: "connection",
    text: "On a scale of 1 to 5, how is your energy, and how full is your plate?",
    purpose: "A voluntary read on energy and load before any work topic.",
    followUp: "Log the two numbers as this week's pulse.",
  },
  /* opening */
  {
    id: "q-open-1",
    scenario: "opening",
    text: "What is the most important thing we should talk about today?",
    purpose: "Hands over the floor immediately.",
  },
  {
    id: "q-open-2",
    scenario: "opening",
    text: "Is there anything you've been wanting to bring up but haven't found the right moment for?",
    purpose: "Lowers the barrier to raising an uncomfortable topic early.",
  },
  {
    id: "q-open-3",
    scenario: "opening",
    text: "What is one thing you learned in the last week?",
    purpose: "Surfaces growth that a status update would hide.",
  },
  /* blockers */
  {
    id: "q-block-1",
    scenario: "blockers",
    text: "What is getting in your way right now that I can remove or escalate?",
    purpose: "Targets friction in the system instead of asking for status.",
    followUp: "Log it as a blocker so a repeat becomes visible.",
  },
  {
    id: "q-block-2",
    scenario: "blockers",
    text: "Where do priorities feel ambiguous or in conflict this week?",
    purpose: "Finds unclear direction before it costs a sprint.",
  },
  {
    id: "q-block-3",
    scenario: "blockers",
    text: "What part of your work feels like banging your head against a wall right now?",
    purpose: "Invites the frustration people usually edit out.",
  },
  /* grow */
  {
    id: "q-grow-goal",
    scenario: "grow",
    tag: "Goal",
    text: "What does a great outcome look like on this initiative?",
    purpose: "Sets the target in their words.",
  },
  {
    id: "q-grow-reality",
    scenario: "grow",
    tag: "Reality",
    text: "What have you tried so far, and what actually happened?",
    purpose: "Grounds the conversation in facts before solutions.",
  },
  {
    id: "q-grow-options",
    scenario: "grow",
    tag: "Options",
    text: "If you had complete authority here, what are two or three paths you'd consider?",
    purpose: "Builds problem solving instead of dependence on you.",
  },
  {
    id: "q-grow-will",
    scenario: "grow",
    tag: "Will",
    text: "Which option do you want to commit to first, and what support do you need from me?",
    purpose: "Turns the conversation into a commitment with an owner.",
    followUp: "Capture it as a commitment with a date.",
  },
  /* upward */
  {
    id: "q-up-1",
    scenario: "upward",
    text: "Is there anything I've done recently that made your work harder?",
    purpose: "Models that challenge is welcome in both directions.",
    followUp: "Log the answer as upward feedback.",
  },
  {
    id: "q-up-2",
    scenario: "upward",
    text: "What is one thing I could do differently to be a more effective manager for you specifically?",
    purpose: "Asks for one concrete change, which is easier to give.",
    followUp: "Log the answer as upward feedback.",
  },
  {
    id: "q-up-3",
    scenario: "upward",
    text: "Is there a decision I've made recently that you want to push back on or understand better?",
    purpose: "Gives explicit permission to disagree.",
  },
  /* onboarding */
  {
    id: "q-onb-1",
    scenario: "onboarding",
    text: "What is working well in how we've set up your first 30 days, and what is the biggest unresolved friction point?",
    purpose: "Checks the ramp from their side.",
    followUp: "Clear access and tooling friction this week.",
  },
  {
    id: "q-onb-2",
    scenario: "onboarding",
    text: "Do you feel crystal clear on what success looks like at day 90?",
    purpose: "Confirms expectations while there is time to adjust.",
    followUp: "Write the day 30, 60 and 90 criteria down together.",
  },
  {
    id: "q-onb-3",
    scenario: "onboarding",
    text: "Which teammates or stakeholders should I connect you with next?",
    purpose: "Builds the network a new hire cannot see yet.",
  },
  {
    id: "q-onb-4",
    scenario: "onboarding",
    text: "How do you prefer to receive feedback and recognition: publicly or privately?",
    purpose: "Sets up every later piece of feedback to land well.",
    followUp: "Save the answer on their profile.",
  },
  /* career */
  {
    id: "q-career-1",
    scenario: "career",
    text: "Where do you want to be in 12 to 24 months, in your craft and in terms of scope?",
    purpose: "Anchors the conversation in their direction, not the org chart.",
    followUp:
      "Record the aspiration. If it changed, the old one is kept in history.",
  },
  {
    id: "q-career-2",
    scenario: "career",
    text: "What skills do you want to build this quarter that we haven't routed work toward yet?",
    purpose: "Finds the gap between ambition and assignments.",
  },
  {
    id: "q-career-3",
    scenario: "career",
    text: "What project or problem would give you the right visibility and stretch for the next level?",
    purpose: "Turns an aspiration into a stretch assignment.",
    followUp: "Agree two or three concrete, dated actions.",
  },
  {
    id: "q-career-4",
    scenario: "career",
    text: "Where are you currently multiplying the team's impact beyond your immediate tasks?",
    purpose: "Collects evidence of next-level behavior.",
  },
  /* stay */
  {
    id: "q-stay-1",
    scenario: "stay",
    tag: "1 of 5",
    text: "When you come to work each day, what things do you look forward to?",
    purpose: "Names what to protect.",
  },
  {
    id: "q-stay-2",
    scenario: "stay",
    tag: "2 of 5",
    text: "What are you learning here, and what do you want to learn?",
    purpose: "Growth is one of the strongest reasons people stay.",
  },
  {
    id: "q-stay-3",
    scenario: "stay",
    tag: "3 of 5",
    text: "Why do you stay here?",
    purpose: "Lets them say it out loud, which also reinforces it.",
  },
  {
    id: "q-stay-4",
    scenario: "stay",
    tag: "4 of 5",
    text: "When was the last time you thought about leaving our team, and what prompted it?",
    purpose: "Surfaces the trigger while it can still be addressed.",
    followUp:
      "Probe: how important is that issue today? Can I count on you to come to me if you feel that way again?",
  },
  {
    id: "q-stay-5",
    scenario: "stay",
    tag: "5 of 5",
    text: "What can I do to make your experience at work better for you?",
    purpose: "Ends with something you can act on.",
    followUp:
      "Check your own style: am I meeting with you enough, too much or too little? Commit to a stay action.",
  },
  /* burnout */
  {
    id: "q-burn-1",
    scenario: "burnout",
    tag: "Exhaustion",
    text: "On a scale of 1 to 10, how energized are you about your work right now, and what is draining your battery fastest?",
    purpose: "Asks about load directly instead of guessing.",
    followUp:
      "Change the work first: cut scope, reprioritize, return decision authority.",
  },
  {
    id: "q-burn-2",
    scenario: "burnout",
    tag: "Detachment",
    text: "Which responsibilities used to excite you that now feel frustrating or pointless?",
    purpose: "Finds where meaning has drained out of the work.",
  },
  {
    id: "q-burn-3",
    scenario: "burnout",
    tag: "Efficacy",
    text: "When was the last time you felt proud of a win or saw how your work helped a customer or teammate?",
    purpose: "Checks whether results are still registering.",
  },
  /* performance */
  {
    id: "q-perf-1",
    scenario: "performance",
    tag: "Inward check",
    text: "Have I made expectations, quality standards and deadlines clear, or set you up to fail in any way?",
    purpose: "Starts with your own part before theirs.",
  },
  {
    id: "q-perf-2",
    scenario: "performance",
    tag: "Root cause",
    text: "Looking at the specific example, what's driving the gap: a skill we need to train, a process or system obstacle, or competing priorities?",
    purpose: "Separates skill, system and priority causes.",
    followUp:
      "Anchor on observable behavior, dates and impact. No character judgments.",
  },
  {
    id: "q-perf-3",
    scenario: "performance",
    tag: "Check-in",
    text: "Against the goal we agreed, what is working, what is still blocking you, and do you have any concerns about hitting the target by the date?",
    purpose: "Keeps the weekly check-in on evidence.",
    followUp: "Write down the agreed support right after the conversation.",
  },
]

/** Scenarios suggested by default for each meeting type, in display order. */
export const scenariosForMeetingType: Record<MeetingType, QuestionScenario[]> =
  {
    weekly: ["connection", "opening", "blockers", "grow", "upward"],
    career: ["career", "grow"],
    stay: ["stay"],
    onboarding: ["onboarding", "opening", "blockers"],
    burnout: ["burnout", "blockers"],
    performance: ["performance"],
  }

export function getQuestion(
  id: string,
  custom: Question[] = []
): Question | undefined {
  return (
    builtInQuestions.find((q) => q.id === id) ?? custom.find((q) => q.id === id)
  )
}

export function questionsFor(
  scenario: QuestionScenario,
  custom: Question[] = []
): Question[] {
  return [...builtInQuestions, ...custom].filter((q) => q.scenario === scenario)
}
