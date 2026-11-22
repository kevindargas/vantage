"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  CalendarPlusIcon,
  CircleHelpIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CopyButton } from "@/components/shared/copy-button"
import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { PageHeader } from "@/components/shared/page-header"
import { StateBadge } from "@/components/shared/status-badge"
import { useQueryParam } from "@/hooks/use-query-param"
import {
  meetingTypeLabels,
  ONBOARDING_CHECKPOINTS,
  scenarioLabels,
  STAY_INTERVAL_DAYS,
} from "@/lib/constants"
import { firstName, formatWhen } from "@/lib/format"
import type { Question, QuestionScenario } from "@/lib/types"
import { builtInQuestions } from "@/lib/vantage/question-bank"
import {
  activePeople,
  getPerson,
  upcomingMeetings,
} from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"

/** The weekly conversation first, then the special conversation types. */
const scenarioOrder: QuestionScenario[] = [
  "connection",
  "opening",
  "blockers",
  "grow",
  "upward",
  "onboarding",
  "career",
  "stay",
  "burnout",
  "performance",
]

const scenarioItems = scenarioOrder.map((s) => ({
  value: s,
  label: scenarioLabels[s],
}))

const checkpoints = `${ONBOARDING_CHECKPOINTS.slice(0, -1).join(", ")} and ${ONBOARDING_CHECKPOINTS[ONBOARDING_CHECKPOINTS.length - 1]}`

const scenarioIntros: Partial<Record<QuestionScenario, string>> = {
  stay: `Five questions on why they stay. Ask all five, in order, every ${Math.round(STAY_INTERVAL_DAYS / 30)} months, and keep the conversation apart from appraisals and pay.`,
  burnout:
    "Change the work before offering advice: cut scope, reprioritize or protect focus time first. This conversation is never punitive, and you only record what they tell you.",
  performance:
    "Anchor every point on behavior, dates and impact, never on character. Take notes by hand: transcript capture is switched off for these conversations.",
  onboarding: `For the day ${checkpoints} checkpoints of a new hire: clarity on expectations, access to what they need and connection to the team.`,
}

function isScenario(value: string | null): value is QuestionScenario {
  return !!value && value in scenarioLabels
}

export function QuestionsView() {
  const ws = workspace.use()
  const [scenarioParam, setScenarioParam] = useQueryParam("scenario")
  const [tabParam, setTabParam] = useQueryParam("tab")
  const [search, setSearch] = React.useState("")
  const [adding, setAdding] = React.useState(false)
  const [deleting, setDeleting] = React.useState<Question | null>(null)

  // `?scenario=` is the documented param. `?tab=` is accepted as well.
  const scenario: QuestionScenario | "all" = isScenario(scenarioParam)
    ? scenarioParam
    : isScenario(tabParam)
      ? tabParam
      : "all"
  const all = [...builtInQuestions, ...ws.customQuestions]
  const countFor = (s: QuestionScenario) =>
    all.filter((q) => q.scenario === s).length
  const query = scenario === "all" ? search.trim().toLowerCase() : ""
  const visible = all
    .filter((q) => scenario === "all" || q.scenario === scenario)
    .filter(
      (q) =>
        !query || `${q.text} ${q.purpose ?? ""}`.toLowerCase().includes(query)
    )
    .sort(
      (a, b) =>
        scenarioOrder.indexOf(a.scenario) - scenarioOrder.indexOf(b.scenario)
    )
  const intro = scenario === "all" ? undefined : scenarioIntros[scenario]

  function select(next: QuestionScenario | "all") {
    setTabParam(null)
    setScenarioParam(next === "all" ? null : next)
  }

  const railItem = (
    value: QuestionScenario | "all",
    label: string,
    count: number
  ) => (
    <li key={value} className="shrink-0">
      <button
        type="button"
        aria-current={scenario === value ? "true" : undefined}
        onClick={() => select(value)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm whitespace-nowrap text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=true]:bg-muted aria-[current=true]:font-medium aria-[current=true]:text-foreground"
      >
        {label}
        <CountPill count={count} />
      </button>
    </li>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        nav="/questions"
        description="Questions for each kind of conversation, with why each one is worth asking and what to do with the answer."
        actions={
          <Button onClick={() => setAdding(true)}>
            <PlusIcon />
            Add question
          </Button>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Scenarios" className="lg:sticky lg:top-20">
          <ul className="-mx-1 no-scrollbar flex gap-1 overflow-x-auto px-1 pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {railItem("all", "All questions", all.length)}
            {scenarioOrder.map((s) =>
              railItem(s, scenarioLabels[s], countFor(s))
            )}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight">
                {scenario === "all"
                  ? "All questions"
                  : scenarioLabels[scenario]}
              </h2>
              {intro && (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {intro}
                </p>
              )}
            </div>
            {scenario === "all" && (
              <InputGroup className="h-8 w-full sm:w-72">
                <InputGroupAddon>
                  <SearchIcon className="size-4 text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search questions and purposes"
                  aria-label="Search questions and purposes"
                  className="text-sm"
                />
              </InputGroup>
            )}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<CircleHelpIcon />}
              title={query ? "No questions match" : "No questions here yet"}
              description={
                query
                  ? "Try a different word, or add the question you had in mind."
                  : "Add a question of your own for this scenario."
              }
              action={
                <Button variant="outline" onClick={() => setAdding(true)}>
                  <PlusIcon />
                  Add question
                </Button>
              }
            />
          ) : (
            <ul aria-label="Questions" className="grid gap-4 xl:grid-cols-2">
              {visible.map((q) => (
                <li key={q.id} className="flex">
                  <QuestionCard
                    question={q}
                    showScenario={scenario === "all"}
                    onDelete={() => setDeleting(q)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {adding && (
        <AddQuestionDialog
          defaultScenario={scenario === "all" ? "opening" : scenario}
          onClose={() => setAdding(false)}
        />
      )}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              It is removed from your question bank for good. Agenda items
              already made from it stay on their 1:1s.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deleting) return
                actions.remove("customQuestions", deleting.id)
                toast.success("Question deleted", {
                  description: deleting.text,
                })
                setDeleting(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function QuestionCard({
  question,
  showScenario,
  onDelete,
}: {
  question: Question
  showScenario: boolean
  onDelete: () => void
}) {
  return (
    <Card className="w-full gap-3 px-4">
      {(showScenario || question.tag || question.custom) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {showScenario && (
            <StateBadge
              size="sm"
              dot={false}
              tone="muted"
              state={scenarioLabels[question.scenario]}
            />
          )}
          {question.tag && (
            <StateBadge
              size="sm"
              dot={false}
              tone="info"
              state={question.tag}
            />
          )}
          {question.custom && <StateBadge size="sm" state="Custom" />}
        </div>
      )}
      <p className="text-lg leading-snug font-medium text-pretty">
        {question.text}
      </p>
      {(question.purpose || question.followUp) && (
        <div className="flex flex-col gap-2 text-sm">
          {question.purpose && (
            <div>
              <Eyebrow>Why ask it</Eyebrow>
              <p className="mt-0.5 text-muted-foreground">{question.purpose}</p>
            </div>
          )}
          {question.followUp && (
            <div>
              <Eyebrow>Then</Eyebrow>
              <p className="mt-0.5 text-muted-foreground">
                {question.followUp}
              </p>
            </div>
          )}
        </div>
      )}
      <div className="mt-auto flex items-center gap-1 pt-1">
        <AddToMeeting question={question} />
        <CopyButton
          value={question.text}
          label="Copy question"
          size="icon-sm"
        />
        {question.custom && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete question: ${question.text}`}
            className="ml-auto text-muted-foreground hover:text-danger-text"
            onClick={onDelete}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
    </Card>
  )
}

/** Popover of upcoming 1:1s. Picking one puts the question on your side of its agenda. */
function AddToMeeting({ question }: { question: Question }) {
  const ws = workspace.use()
  const [open, setOpen] = React.useState(false)
  const people = activePeople(ws)
  const meetings = upcomingMeetings(ws).filter((m) =>
    people.some((p) => p.id === m.personId)
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label={`Add to a 1:1: ${question.text}`}
          />
        }
      >
        <CalendarPlusIcon />
        Add to a 1:1
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Add to a 1:1</PopoverTitle>
          <PopoverDescription className="text-xs">
            Goes on the agenda as one of your items.
          </PopoverDescription>
        </PopoverHeader>
        {meetings.length === 0 ? (
          <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground">
            <p>No 1:1 is scheduled. Schedule one to add questions to it.</p>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/meetings?new=1" />}
            >
              Schedule a 1:1
            </Button>
          </div>
        ) : (
          <ul className="-mx-1 flex max-h-64 flex-col gap-0.5 overflow-y-auto px-1">
            {meetings.map((m) => {
              const name = getPerson(ws, m.personId)?.name ?? ""
              const already = m.agenda.some(
                (item) => item.questionId === question.id
              )
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={already}
                    aria-label={`${name}, ${formatWhen(m.scheduledAt)}${already ? ", already on the agenda" : ""}`}
                    onClick={() => {
                      actions.addAgendaItem(m.id, {
                        text: question.text,
                        owner: "manager",
                        questionId: question.id,
                      })
                      toast.success(
                        `Added to the agenda for the 1:1 with ${firstName(name)}`,
                        {
                          description: `${formatWhen(m.scheduledAt)}: ${question.text}`,
                        }
                      )
                      setOpen(false)
                    }}
                    className={cn(
                      "flex w-full flex-col rounded-md px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                      already &&
                        "cursor-not-allowed opacity-60 hover:bg-transparent"
                    )}
                  >
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground">
                      {already
                        ? "Already on the agenda"
                        : `${formatWhen(m.scheduledAt)}${m.type === "weekly" ? "" : `, ${meetingTypeLabels[m.type].toLowerCase()}`}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

function AddQuestionDialog({
  defaultScenario,
  onClose,
}: {
  defaultScenario: QuestionScenario
  onClose: () => void
}) {
  const [scenario, setScenario] =
    React.useState<QuestionScenario>(defaultScenario)
  const [text, setText] = React.useState("")
  const [purpose, setPurpose] = React.useState("")
  const [followUp, setFollowUp] = React.useState("")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    actions.addQuestion({
      scenario,
      text: text.trim(),
      purpose: purpose.trim() || undefined,
      followUp: followUp.trim() || undefined,
    })
    toast.success("Question added", {
      description: `${scenarioLabels[scenario]}: ${text.trim()}`,
    })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Add a question</DialogTitle>
            <DialogDescription>
              Your own questions sit next to the built-in ones and can go on any
              agenda.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="question-scenario">Scenario</FieldLabel>
              <Select
                value={scenario}
                onValueChange={(v) => v && setScenario(v as QuestionScenario)}
                items={scenarioItems}
              >
                <SelectTrigger id="question-scenario" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scenarioItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="question-text">Question</FieldLabel>
              <Textarea
                id="question-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What would make next week easier than this one?"
                className="min-h-16"
                required
              />
              <FieldDescription>
                Open questions work best: start with what or how.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="question-purpose">
                Why ask it (optional)
              </FieldLabel>
              <Input
                id="question-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="question-follow-up">
                What to do with the answer (optional)
              </FieldLabel>
              <Input
                id="question-follow-up"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!text.trim()}>
              Add question
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
