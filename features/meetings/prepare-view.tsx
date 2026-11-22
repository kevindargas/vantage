"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  LibraryIcon,
  MailIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { RecordLayout } from "@/components/record/record-layout"
import { RecordSection } from "@/components/record/record-section"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StateBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  meetingTypeLabels,
  recognitionLabels,
  scenarioLabels,
} from "@/lib/constants"
import { dayDistance, firstName, formatDay, formatDayLong } from "@/lib/format"
import { dayOf } from "@/lib/time"
import type {
  AgendaItem,
  AgendaOwner,
  Meeting,
  Person,
  Question,
  QuestionScenario,
} from "@/lib/types"
import { buildBrief, prepRequestText } from "@/lib/vantage/brief"
import { cadenceHealth, cadenceStateLabels } from "@/lib/vantage/cadence"
import type { NudgeSeverity } from "@/lib/vantage/nudges"
import {
  questionsFor,
  scenariosForMeetingType,
} from "@/lib/vantage/question-bank"
import { actions, workspace } from "@/lib/vantage/store"
import { cn } from "cn"
import { CarriedList } from "./parts"

const severityLabels: Record<NudgeSeverity, string> = {
  danger: "Urgent",
  warning: "Attention",
  info: "Suggestion",
}

const pillarLabels = {
  goal: "Goal",
  blocker: "Blocker",
  career: "Career",
  feedback: "Feedback",
  workload: "Workload",
} as const

/** Before the conversation: the shared agenda, what carried over and the brief. */
export function PrepareView({
  meeting,
  person,
}: {
  meeting: Meeting
  person: Person
}) {
  const name = firstName(person.name)
  const theirs = meeting.agenda.filter((a) => a.owner === "report")
  const yours = meeting.agenda.filter((a) => a.owner === "manager")

  return (
    <RecordLayout
      aside={
        <>
          <BriefCard meeting={meeting} person={person} />
          <ContextCard meeting={meeting} person={person} />
        </>
      }
    >
      <RecordSection
        title="Shared agenda"
        count={meeting.agenda.length}
        description={`${name}'s items lead and yours follow. Both of you see this list.`}
        contentClassName="flex flex-col gap-6"
      >
        <AgendaGroup
          meeting={meeting}
          owner="report"
          title={`${name}'s agenda`}
          items={theirs}
          empty={`${name} has not added anything yet.`}
          addLabel={`Add an item for ${name}`}
          placeholder={`Something ${name} asked to cover`}
        />
        {!theirs.length && <PrepRequest meeting={meeting} person={person} />}
        <AgendaGroup
          meeting={meeting}
          owner="manager"
          title="Your items"
          items={yours}
          empty="Nothing from you yet. Add an item or pick a suggested question."
          addLabel="Add one of your items"
          placeholder="Something you want to cover"
        />
      </RecordSection>

      <RecordSection
        title="Carried over"
        description="Open commitments from earlier 1:1s. Check one off when it is done."
      >
        <CarriedList meeting={meeting} person={person} />
      </RecordSection>
    </RecordLayout>
  )
}

/* ------------------------------------------------------------------ agenda */

function moveItem(meeting: Meeting, item: AgendaItem, direction: -1 | 1) {
  const group = meeting.agenda.filter((a) => a.owner === item.owner)
  const other = group[group.findIndex((a) => a.id === item.id) + direction]
  if (!other) return
  actions.updateMeeting(meeting.id, {
    agenda: meeting.agenda.map((a) =>
      a.id === item.id ? other : a.id === other.id ? item : a
    ),
  })
}

function AgendaGroup({
  meeting,
  owner,
  title,
  items,
  empty,
  addLabel,
  placeholder,
}: {
  meeting: Meeting
  owner: AgendaOwner
  title: string
  items: AgendaItem[]
  empty: string
  addLabel: string
  placeholder: string
}) {
  const [text, setText] = React.useState("")

  function add(e: React.FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    actions.addAgendaItem(meeting.id, { text: value, owner })
    setText("")
  }

  return (
    <section className="flex flex-col gap-2">
      <Eyebrow as="h3">{title}</Eyebrow>
      {items.length ? (
        <ol className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
              >
                {i + 1}
              </span>
              <Input
                key={item.text}
                defaultValue={item.text}
                aria-label={`Agenda item ${i + 1}, ${title}`}
                className="min-w-0 flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur()
                }}
                onBlur={(e) => {
                  const value = e.target.value.trim()
                  if (!value) e.target.value = item.text
                  else if (value !== item.text)
                    actions.updateAgendaItem(meeting.id, item.id, {
                      text: value,
                    })
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move "${item.text}" up`}
                disabled={i === 0}
                onClick={() => moveItem(meeting, item, -1)}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move "${item.text}" down`}
                disabled={i === items.length - 1}
                onClick={() => moveItem(meeting, item, 1)}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove "${item.text}"`}
                onClick={() => actions.removeAgendaItem(meeting.id, item.id)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
      <form onSubmit={add} className="flex items-center gap-2 pl-6.5">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={addLabel}
          placeholder={placeholder}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="outline" disabled={!text.trim()}>
          <PlusIcon /> Add
        </Button>
      </form>
    </section>
  )
}

/* ------------------------------------------------------------ prep request */

function PrepRequest({
  meeting,
  person,
}: {
  meeting: Meeting
  person: Person
}) {
  const ws = workspace.use()
  const text = prepRequestText(ws, meeting)
  const name = firstName(person.name)
  const subject = `Agenda for our ${meetingTypeLabels[meeting.type].toLowerCase()} on ${formatDayLong(dayOf(meeting.scheduledAt))}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Message copied", {
        description: `Paste it wherever you talk to ${name}. Nothing was sent from here.`,
      })
    } catch {
      toast.error("Could not copy the message", {
        description: "Select the text and copy it by hand.",
      })
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="grid gap-0.5">
        <p className="text-sm font-medium">Ask {name} for their top item</p>
        <p className="text-xs text-muted-foreground">
          Send this a day ahead. You send it yourself: copy it, or open it as a
          draft in your e-mail app.
        </p>
      </div>
      <pre className="rounded-md border bg-card p-3 font-sans text-sm leading-relaxed whitespace-pre-wrap">
        {text}
      </pre>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          <CopyIcon /> Copy message
        </Button>
        {person.email && (
          <Button
            variant="outline"
            size="sm"
            render={
              // A mailto link opens a draft in the mail app; nothing is sent.
              <a
                href={`mailto:${person.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}
              />
            }
          >
            <MailIcon /> Open in e-mail
          </Button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- brief */

function addQuestion(meeting: Meeting, q: Question) {
  actions.addAgendaItem(meeting.id, {
    text: q.text,
    owner: "manager",
    questionId: q.id,
  })
  toast.success("Added to your items")
}

function BriefCard({ meeting, person }: { meeting: Meeting; person: Person }) {
  const ws = workspace.use()
  const [browsing, setBrowsing] = React.useState(false)
  const brief = buildBrief(ws, meeting)
  const name = firstName(person.name)
  if (!brief) return null

  return (
    <RecordSection
      title="Brief"
      description={
        brief.lastHeldDay
          ? `What moved on ${name}'s record since ${formatDay(brief.lastHeldDay)}.`
          : `This is your first recorded 1:1 with ${name}.`
      }
      contentClassName="flex flex-col gap-5"
    >
      <section className="flex flex-col gap-2">
        <Eyebrow as="h3">Changed since the last 1:1</Eyebrow>
        {brief.changes.length ? (
          <ul className="flex flex-col gap-1.5 text-sm">
            {brief.changes.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
                  {pillarLabels[c.pillar]}
                </span>
                <span className="min-w-0 leading-snug">{c.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {brief.lastHeldDay
              ? "Nothing changed on the record."
              : "No earlier 1:1 to compare with."}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow as="h3">Worth your attention</Eyebrow>
        {brief.nudges.length ? (
          <ul className="flex flex-col gap-2">
            {brief.nudges.map((n) => (
              <li
                key={n.id}
                className="flex flex-col gap-1 rounded-lg border bg-muted/30 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge state={severityLabels[n.severity]} size="sm" />
                  <span className="text-sm font-medium">{n.title}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {n.detail}
                </p>
                <Link
                  href={n.href}
                  className="inline-flex w-fit items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                >
                  {n.actionLabel} <ArrowRightIcon className="size-3" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing on {name}&apos;s record needs a nudge right now.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Eyebrow as="h3">Suggested questions</Eyebrow>
        {brief.questions.length ? (
          <ul className="flex flex-col gap-2">
            {brief.questions.map((q) => (
              <QuestionRow
                key={q.id}
                question={q}
                onAdd={() => addQuestion(meeting, q)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Every suggestion for this conversation is already on the agenda.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setBrowsing(true)}
        >
          <LibraryIcon /> More questions
        </Button>
      </section>

      <QuestionSheet
        meeting={meeting}
        open={browsing}
        onOpenChange={setBrowsing}
      />
    </RecordSection>
  )
}

function QuestionRow({
  question,
  onAdd,
  added = false,
}: {
  question: Question
  onAdd: () => void
  added?: boolean
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2">
      <div className="grid min-w-0 gap-0.5">
        <p className="text-sm leading-snug">{question.text}</p>
        {question.purpose && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {question.purpose}
          </p>
        )}
      </div>
      {added ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <CheckIcon className="size-3.5" /> On agenda
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="shrink-0"
          aria-label={`Add to agenda: ${question.text}`}
          onClick={onAdd}
        >
          <PlusIcon /> Add to agenda
        </Button>
      )}
    </li>
  )
}

/** The question bank, with the scenarios that fit this conversation first. */
function QuestionSheet({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: Meeting
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const ws = workspace.use()
  const fitting = scenariosForMeetingType[meeting.type]
  const scenarios = [
    ...fitting,
    ...(Object.keys(scenarioLabels) as QuestionScenario[]).filter(
      (s) => !fitting.includes(s)
    ),
  ]
  const [picked, setPicked] = React.useState<QuestionScenario | null>(null)
  const scenario = picked ?? scenarios[0]
  const questions = questionsFor(scenario, ws.customQuestions)
  const onAgenda = new Set(meeting.agenda.map((a) => a.questionId))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Question bank</SheetTitle>
          <SheetDescription>
            Scenarios that fit a {meetingTypeLabels[meeting.type].toLowerCase()}{" "}
            come first. A question you add goes under your items.
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-4">
          <div
            role="group"
            aria-label="Scenario"
            className="flex flex-wrap gap-1.5"
          >
            {scenarios.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={s === scenario ? "secondary" : "ghost"}
                aria-pressed={s === scenario}
                onClick={() => setPicked(s)}
              >
                {scenarioLabels[s]}
              </Button>
            ))}
          </div>
          {questions.length ? (
            <ul className="flex flex-col gap-2">
              {questions.map((q) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  added={onAgenda.has(q.id)}
                  onAdd={() => addQuestion(meeting, q)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              size="sm"
              title="No questions in this scenario"
              description="Add your own in the Question Bank."
            />
          )}
        </SheetBody>
        <SheetFooterActions
          tertiary={
            <Button
              variant="ghost"
              render={<Link href={`/questions?scenario=${scenario}`} />}
            >
              Open the Question Bank
            </Button>
          }
        />
      </SheetContent>
    </Sheet>
  )
}

/* ----------------------------------------------------------------- context */

function ContextCard({
  meeting,
  person,
}: {
  meeting: Meeting
  person: Person
}) {
  const ws = workspace.use()
  const health = cadenceHealth(person, ws.meetings)
  const name = firstName(person.name)
  return (
    <RecordSection title="Context" size="sm">
      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Last 1:1</dt>
          <dd className="text-right">
            {health.lastHeldDay
              ? `${formatDay(health.lastHeldDay)}, ${dayDistance(health.lastHeldDay)}`
              : "None held yet"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Cadence</dt>
          <dd>
            <StateBadge state={cadenceStateLabels[health.state]} />
          </dd>
        </div>
        {meeting.rescheduledFrom && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Moved from</dt>
            <dd className="text-right">{formatDay(meeting.rescheduledFrom)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Recognition</dt>
          <dd className="text-right">
            {recognitionLabels[person.recognitionPref]}
          </dd>
        </div>
        <div className="grid gap-1">
          <dt className="text-muted-foreground">How {name} likes feedback</dt>
          <dd className="leading-relaxed">
            {person.feedbackStyle?.trim() ||
              "Not recorded yet. Ask them, then add it to their profile."}
          </dd>
        </div>
      </dl>
    </RecordSection>
  )
}
