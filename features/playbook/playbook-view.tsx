"use client"

import Link from "next/link"
import { cn } from "cn"
import { ArrowRightIcon, PrinterIcon } from "lucide-react"

import { Eyebrow } from "@/components/shared/eyebrow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BLOCKER_RECURRENCE_TRIGGER,
  cadenceProfiles,
  CAREER_GAP_DAYS,
  FEEDBACK_GAP_DAYS,
  FEEDBACK_WINDOW_HOURS,
  frameworks,
  frequencyLabels,
  groundRules,
  HIGH_WORKLOAD_THRESHOLD,
  LOW_ENERGY_THRESHOLD,
  meetingTypeDescriptions,
  meetingTypeLabels,
  ONBOARDING_CHECKPOINTS,
  PULSE_WINDOW,
  readinessLabels,
  runbookPhases,
  scenarioLabels,
  STAY_INTERVAL_DAYS,
  workloadControls,
} from "@/lib/constants"
import type {
  CadenceProfile,
  MeetingType,
  QuestionScenario,
  Readiness,
} from "@/lib/types"
import { questionsFor } from "@/lib/vantage/question-bank"

const sections = [
  { id: "cadence", title: "Cadence guide" },
  { id: "ground-rules", title: "Five ground rules" },
  { id: "runbook", title: "The 30-minute runbook" },
  { id: "tracking", title: "Seven things to track" },
  { id: "frameworks", title: "Frameworks" },
  { id: "readiness", title: "Readiness levels" },
  { id: "moments", title: "Particular moments" },
] as const

const profileOrder: CadenceProfile[] = [
  "new-hire",
  "established-ic",
  "senior-ic",
  "team-lead",
]

const otherConversations: { type: MeetingType; when: string }[] = [
  {
    type: "career",
    when: `Once a quarter. Vantage suggests one after ${CAREER_GAP_DAYS} days without.`,
  },
  {
    type: "stay",
    when: `Every six months: ${STAY_INTERVAL_DAYS} days after the last one.`,
  },
  {
    type: "performance",
    when: "Weekly, for as long as performance support is in place.",
  },
]

const RUNBOOK_MINUTES = 30

const phaseColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
]

const pillars: { title: string; why: string; href: string; where: string }[] = [
  {
    title: "Commitments",
    why: "What each of you said you would do, with an owner and a date. Open items carry into the next 1:1, and your own follow-through is counted next to theirs, because a promise you drop costs more trust than one they drop.",
    href: "/commitments",
    where: "Commitments",
  },
  {
    title: "Goals and readiness",
    why: "The few outcomes that matter this quarter, each with a readiness level. The level tells you how much direction and how much support that goal needs from you right now.",
    href: "/goals",
    where: "Goals",
  },
  {
    title: "Recurring blockers",
    why: `One mention is noise. The same obstacle raised ${BLOCKER_RECURRENCE_TRIGGER} times is a pattern, and it calls for a coaching conversation or an escalation instead of another round of sympathy.`,
    href: "/insights",
    where: "Team Insights, and each person's Blockers tab",
  },
  {
    title: "Feedback ledger",
    why: `Recognition and developmental feedback, written as situation, behavior and impact on the day it happened. A year of dated entries is what makes a review fair. Vantage reminds you after ${FEEDBACK_GAP_DAYS} days of silence.`,
    href: "/feedback",
    where: "Feedback",
  },
  {
    title: "Career and milestones",
    why: "Where the person wants to go, in their words, and the dated moments that show next-level behavior. Without it, growth talk happens once a year and rests on memory.",
    href: "/people",
    where: "Each person's Career tab",
  },
  {
    title: "Workload and energy",
    why: `A voluntary 1 to 5 pulse and the pressure a person states in words. Across the last ${PULSE_WINDOW} pulses, average energy at or below ${LOW_ENERGY_THRESHOLD} or workload at or above ${HIGH_WORKLOAD_THRESHOLD} prompts a check-in. Nothing is read from tone or behavior.`,
    href: "/people",
    where: "Each person's Wellbeing tab",
  },
  {
    title: "Stay drivers",
    why: "What a person looks forward to, what they want to learn and what has made them think about leaving. You can only act on reasons you asked about while they are still here.",
    href: "/people",
    where: "Each person's Retention tab",
  },
]

const moments: {
  scenario: QuestionScenario
  type: MeetingType
  lead: string
}[] = [
  {
    scenario: "onboarding",
    type: "onboarding",
    lead: `Checkpoints fall on day ${ONBOARDING_CHECKPOINTS.join(", ")}. Early on, the question is whether they have what they need, not how they are performing.`,
  },
  {
    scenario: "career",
    type: "career",
    lead: "Give it the whole slot. Status updates wait for next week.",
  },
  {
    scenario: "stay",
    type: "stay",
    lead: "Ask, listen and write down what you hear. Agree one action you will take before the next one.",
  },
  {
    scenario: "burnout",
    type: "burnout",
    lead: "Start from what they tell you. Change the work before you coach the person.",
  },
  {
    scenario: "performance",
    type: "performance",
    lead: "Be specific and kind, and take notes by hand. Capture is never offered for this conversation.",
  },
]

const readinessOrder: Readiness[] = ["D1", "D2", "D3", "D4"]

export function PlaybookView() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] print:block">
      <nav
        aria-label="On this page"
        className="top-20 flex flex-col gap-3 lg:sticky print:hidden"
      >
        <Eyebrow>On this page</Eyebrow>
        <ol className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {sections.map((section, i) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                className="flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-xs tabular-nums">{i + 1}</span>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
        <Button
          variant="outline"
          size="sm"
          className="hidden self-start lg:inline-flex"
          onClick={() => window.print()}
        >
          <PrinterIcon data-icon="inline-start" />
          Print
        </Button>
      </nav>

      <article className="flex max-w-4xl min-w-0 flex-col gap-14 print:max-w-none print:gap-8">
        <p className="max-w-prose text-base leading-relaxed text-pretty">
          This is the operating plan behind the app: how often to meet, how to
          spend the half hour, what to write down and which ideas it all rests
          on. Read it once, then come back to the part you need.
        </p>

        <Chapter
          id="cadence"
          number={1}
          title="Cadence guide"
          lead="How often and how long depends on where the person is. Vantage suggests a profile when you add someone, and you can change it at any time."
        >
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-40">Profile</TableHead>
                  <TableHead>Cadence</TableHead>
                  <TableHead>Minutes</TableHead>
                  <TableHead className="min-w-52">Focus</TableHead>
                  <TableHead className="min-w-64">Why</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profileOrder.map((key) => {
                  const profile = cadenceProfiles[key]
                  return (
                    <TableRow key={key} className="align-top">
                      <TableCell className="whitespace-normal">
                        <span className="font-medium">{profile.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {profile.description}
                        </span>
                      </TableCell>
                      <TableCell>
                        {frequencyLabels[profile.cadence.frequency]}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {profile.cadence.durationMin}
                      </TableCell>
                      <TableCell className="leading-relaxed whitespace-normal">
                        {profile.focus}
                      </TableCell>
                      <TableCell className="leading-relaxed whitespace-normal text-muted-foreground">
                        {profile.rationale}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <h3 className="mt-2 text-sm font-semibold">
            Conversations on their own rhythm
          </h3>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-40">Conversation</TableHead>
                  <TableHead className="min-w-52">When</TableHead>
                  <TableHead className="min-w-64">What it is for</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherConversations.map(({ type, when }) => (
                  <TableRow key={type} className="align-top">
                    <TableCell className="font-medium whitespace-normal">
                      {meetingTypeLabels[type]}
                    </TableCell>
                    <TableCell className="leading-relaxed whitespace-normal">
                      {when}
                    </TableCell>
                    <TableCell className="leading-relaxed whitespace-normal text-muted-foreground">
                      {meetingTypeDescriptions[type]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Chapter>

        <Chapter
          id="ground-rules"
          number={2}
          title="Five ground rules"
          lead="These hold for every 1:1, whatever the profile."
        >
          <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2 print:grid-cols-2">
            {groundRules.map((rule, i) => (
              <li
                key={rule.title}
                className="flex break-inside-avoid gap-3"
                data-testid="ground-rule"
              >
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums"
                >
                  {i + 1}
                </span>
                <div className="grid gap-1">
                  <h3 className="text-sm leading-7 font-semibold">
                    {rule.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {rule.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Chapter>

        <Chapter
          id="runbook"
          number={3}
          title="The 30-minute runbook"
          lead="Four phases, in this order. For a longer slot, keep the proportions: Vantage scales the phases to the scheduled time."
        >
          <div
            role="img"
            aria-label={`Timeline of the ${RUNBOOK_MINUTES} minutes: ${runbookPhases.map((p) => `${p.title}, ${p.range}`).join("; ")}`}
            className="flex w-full gap-1"
          >
            {runbookPhases.map((phase, i) => (
              <div
                key={phase.id}
                style={{ flexGrow: phase.share }}
                className="flex min-w-0 basis-0 flex-col gap-1.5"
              >
                <span
                  className="h-3 rounded-full print:border"
                  style={{ backgroundColor: phaseColors[i] }}
                />
                <span className="truncate text-xs text-muted-foreground tabular-nums">
                  {Math.round(phase.share * RUNBOOK_MINUTES)} min
                </span>
              </div>
            ))}
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-2">
            {runbookPhases.map((phase, i) => (
              <li
                key={phase.id}
                data-testid="runbook-phase"
                className="flex break-inside-avoid flex-col gap-1.5 rounded-xl border p-4"
              >
                <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: phaseColors[i] }}
                  />
                  {phase.range}
                </span>
                <h3 className="text-sm leading-snug font-semibold">
                  {phase.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {phase.guidance}
                </p>
              </li>
            ))}
          </ol>
        </Chapter>

        <Chapter
          id="tracking"
          number={4}
          title="Seven things to track"
          lead="A running record per person under seven headings. Each one answers a question you would otherwise answer from memory."
        >
          <ol className="flex flex-col divide-y rounded-xl border">
            {pillars.map((pillar, i) => (
              <li
                key={pillar.title}
                className="grid break-inside-avoid gap-1.5 p-4 sm:grid-cols-[2rem_minmax(0,1fr)]"
              >
                <span
                  aria-hidden
                  className="text-sm font-semibold text-muted-foreground tabular-nums"
                >
                  {i + 1}
                </span>
                <div className="grid gap-1.5">
                  <h3 className="text-sm font-semibold">{pillar.title}</h3>
                  <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                    {pillar.why}
                  </p>
                  <Link
                    href={pillar.href}
                    className="inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring print:hidden"
                  >
                    {pillar.where}
                    <ArrowRightIcon aria-hidden className="size-3.5" />
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </Chapter>

        <Chapter
          id="frameworks"
          number={5}
          title="Frameworks"
          lead="The ideas the plan borrows from, what each one asks of you and where it shows up in the app."
        >
          <div className="flex flex-col gap-4">
            {frameworks.map((framework) => (
              <section
                key={framework.id}
                aria-labelledby={`framework-${framework.id}`}
                className="grid break-inside-avoid gap-3 rounded-xl border p-4 sm:p-5"
              >
                <div className="grid gap-0.5">
                  <h3
                    id={`framework-${framework.id}`}
                    className="font-heading text-base font-medium"
                  >
                    {framework.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {framework.source}
                  </p>
                </div>
                <p className="max-w-prose text-sm leading-relaxed">
                  {framework.principle}
                </p>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="grid content-start gap-1">
                    <dt>
                      <Eyebrow as="span">In practice</Eyebrow>
                    </dt>
                    <dd className="text-sm leading-relaxed text-muted-foreground">
                      {framework.inPractice}
                    </dd>
                  </div>
                  <div className="grid content-start gap-1">
                    <dt>
                      <Eyebrow as="span">In Vantage</Eyebrow>
                    </dt>
                    <dd className="text-sm leading-relaxed text-muted-foreground">
                      {framework.inVantage}
                    </dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
        </Chapter>

        <Chapter
          id="readiness"
          number={6}
          title="Readiness levels"
          lead="Set per goal, not per person. Someone can be self-reliant on one goal and new to another, and your style should follow the goal."
        >
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end print:grid-cols-2">
            {readinessOrder.map((key, i) => {
              const level = readinessLabels[key]
              return (
                <li
                  key={key}
                  data-testid="readiness-level"
                  className={cn(
                    "flex break-inside-avoid flex-col gap-2 rounded-xl border p-4",
                    // A rising staircase on wide screens.
                    ["xl:pb-4", "xl:pb-10", "xl:pb-16", "xl:pb-22"][i]
                  )}
                >
                  <div
                    aria-hidden
                    className="flex gap-1"
                    title={`Step ${i + 1} of ${readinessOrder.length}`}
                  >
                    {readinessOrder.map((step, j) => (
                      <span
                        key={step}
                        className={cn(
                          "h-1 flex-1 rounded-full",
                          j <= i ? "bg-primary" : "bg-muted"
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="tabular-nums">
                      {key}
                    </Badge>
                    <span className="text-sm font-semibold">{level.style}</span>
                  </div>
                  <p className="text-sm font-medium">{level.level}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {level.guidance}
                  </p>
                </li>
              )
            })}
          </ol>
        </Chapter>

        <Chapter
          id="moments"
          number={7}
          title="Conversations for particular moments"
          lead="Five conversations that are not the weekly 1:1. Each has its own questions, and a cue for what to do with the answer."
        >
          <div className="flex flex-col gap-4">
            {moments.map((moment) => {
              const questions = questionsFor(moment.scenario)
              return (
                <section
                  key={moment.scenario}
                  aria-labelledby={`moment-${moment.scenario}`}
                  className="grid gap-3 rounded-xl border p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="grid gap-0.5">
                      <h3
                        id={`moment-${moment.scenario}`}
                        className="font-heading text-base font-medium"
                      >
                        {meetingTypeLabels[moment.type]}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {meetingTypeDescriptions[moment.type]}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="print:hidden"
                      render={
                        <Link href={`/questions?scenario=${moment.scenario}`} />
                      }
                    >
                      {scenarioLabels[moment.scenario]} questions
                      <ArrowRightIcon data-icon="inline-end" />
                    </Button>
                  </div>
                  <p className="max-w-prose text-sm leading-relaxed">
                    {moment.lead}
                  </p>
                  {questions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No questions in the bank for this conversation yet.
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-3">
                      {questions.map((question, i) => (
                        <li
                          key={question.id}
                          className="grid break-inside-avoid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-1"
                        >
                          <span
                            aria-hidden
                            className="text-sm text-muted-foreground tabular-nums"
                          >
                            {i + 1}.
                          </span>
                          <div className="grid gap-0.5">
                            <p className="text-sm leading-relaxed font-medium">
                              {question.text}
                            </p>
                            {question.followUp && (
                              <p className="text-sm leading-relaxed text-muted-foreground">
                                <span className="font-medium text-foreground/80">
                                  Follow up:
                                </span>{" "}
                                {question.followUp}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                  {moment.scenario === "burnout" && (
                    <div className="grid gap-2 rounded-lg bg-muted/40 p-3">
                      <p className="text-sm font-medium">
                        Change the work first, in this order
                      </p>
                      <ol className="grid list-inside list-decimal gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                        {workloadControls.map((control) => (
                          <li key={control}>{control}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {moment.scenario === "performance" && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Urgent corrective feedback does not wait for this
                      conversation: give it in private within{" "}
                      {FEEDBACK_WINDOW_HOURS} hours of the event.
                    </p>
                  )}
                </section>
              )
            })}
          </div>
        </Chapter>
      </article>
    </div>
  )
}

function Chapter({
  id,
  number,
  title,
  lead,
  children,
}: {
  id: string
  number: number
  title: string
  lead: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-20 flex-col gap-4"
    >
      <header className="grid gap-1.5">
        <Eyebrow>Part {number}</Eyebrow>
        <h2
          id={`${id}-title`}
          className="font-heading text-xl font-semibold tracking-tight"
        >
          {title}
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          {lead}
        </p>
      </header>
      {children}
    </section>
  )
}
