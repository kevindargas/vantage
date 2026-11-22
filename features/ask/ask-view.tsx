"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  ChevronRightIcon,
  CopyIcon,
  SearchIcon,
  SearchXIcon,
  UserPlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { StatusDot } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { copyText } from "@/features/settings/files"
import { PersonChip } from "@/features/shared/person"
import { plural } from "@/lib/format"
import {
  ask,
  askExamples,
  type AskResult,
  type AskRow,
} from "@/lib/vantage/ask"
import { activePeople, getPerson } from "@/lib/vantage/selectors"
import { workspace } from "@/lib/vantage/store"
import { useUrlState } from "./use-url-state"

const RECENT_LIMIT = 6

const topics: { title: string; body: string; example: string }[] = [
  {
    title: "Cadence",
    body: "Who is overdue for a 1:1 and where cancellations pile up.",
    example: "Who haven't I met with recently?",
  },
  {
    title: "Workload",
    body: "Pulses people logged and pressure they stated in words.",
    example: "Who is carrying the heaviest workload?",
  },
  {
    title: "Commitments",
    body: "What each side owes, and what is past due.",
    example: "What do I owe people that is overdue?",
  },
  {
    title: "Blockers and cross-team dependencies",
    body: "What stands in the way, and how often it came up.",
    example: "List every cross-team dependency raised this month",
  },
  {
    title: "Goals",
    body: "Active goals, and the ones at risk or off track.",
    example: "Which goals are at risk?",
  },
  {
    title: "Feedback",
    body: "Recognition, developmental and upward feedback.",
    example: "What recognition have I given in the last 30 days?",
  },
  {
    title: "Career",
    body: "Aspirations on record and milestones demonstrated.",
    example: "Where does everyone want to be in two years?",
  },
  {
    title: "Stay drivers",
    body: "Why people stay, and what has made them think of leaving.",
    example: "What keeps people here, and what might make them leave?",
  },
]

const timePhrases = [
  "this week",
  "last month",
  "this quarter",
  "Q2",
  "last 30 days",
]

/** Spoken alongside the coloured marker, so colour is not the only signal. */
const toneLabels: Record<NonNullable<AskRow["tone"]>, string | undefined> = {
  neutral: undefined,
  info: "For information",
  success: "In good shape",
  warning: "Worth a look",
  danger: "Needs attention",
}

interface Group {
  personId?: string
  rows: AskRow[]
}

function groupRows(rows: AskRow[]): Group[] {
  const groups: Group[] = []
  for (const row of rows) {
    const group = groups.find((g) => g.personId === row.personId)
    if (group) group.rows.push(row)
    else groups.push({ personId: row.personId, rows: [row] })
  }
  return groups
}

export function AskView() {
  const ws = workspace.use()
  const [query, setQuery] = useUrlState("q", "push")
  const [text, setText] = React.useState(query ?? "")
  const [seen, setSeen] = React.useState(query)
  const [recent, setRecent] = React.useState<string[]>([])
  // Back and forward change the question in the URL: show it in the box too.
  if (query !== seen) {
    setSeen(query)
    setText(query ?? "")
  }

  const result = React.useMemo(
    () => (query ? ask(ws, query) : undefined),
    [ws, query]
  )
  const hasPeople = activePeople(ws).length > 0

  function run(next: string) {
    const question = next.trim()
    if (!question) return
    setText(question)
    setQuery(question)
    setRecent((list) =>
      [
        question,
        ...list.filter((q) => q.toLowerCase() !== question.toLowerCase()),
      ].slice(0, RECENT_LIMIT)
    )
  }

  return (
    <>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Questions are answered by rules over your own record, on this device. It
        recognizes a topic, a person and a time range. It is not a chat model
        and nothing is sent anywhere.
      </p>

      <form
        role="search"
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          run(text)
        }}
      >
        <div className="relative flex-1">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Your question"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What blocked Maya this quarter?"
            autoComplete="off"
            className="h-12 rounded-xl pl-11 text-base md:text-base"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-12 rounded-xl px-5"
          disabled={!text.trim()}
        >
          Ask
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <Eyebrow as="h2">Try one of these</Eyebrow>
        <ul className="flex flex-wrap gap-2">
          {askExamples.map((example) => (
            <li key={example}>
              <Button
                variant="outline"
                size="sm"
                className="h-auto min-h-7 rounded-full py-1 text-left whitespace-normal"
                onClick={() => run(example)}
              >
                {example}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {result ? (
        <Answer result={result} onAsk={run} />
      ) : !hasPeople ? (
        <EmptyState
          icon={<UserPlusIcon />}
          title="Nothing to ask about yet"
          description="Answers come from the record you keep. Add a direct report and hold a 1:1 first."
          action={
            <Button render={<Link href="/people?new=1" />}>Add a person</Button>
          }
        />
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>What you can ask about</CardTitle>
            <CardDescription>
              Eight topics. Anything else falls back to a plain text search over
              commitments, goals, blockers, feedback and 1:1 notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {topics.map((topic) => (
                <div key={topic.title} className="grid gap-0.5">
                  <dt className="text-sm font-medium">{topic.title}</dt>
                  <dd className="text-sm leading-relaxed text-muted-foreground">
                    {topic.body}
                  </dd>
                  <dd>
                    <button
                      type="button"
                      onClick={() => run(topic.example)}
                      className="rounded-sm text-left text-xs text-foreground underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {topic.example}
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-2 border-t pt-4">
              <p className="text-sm font-medium">Time and people</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Add a time phrase to limit the period. Name a person, by first
                or full name, to narrow the answer to them.
              </p>
              <ul aria-label="Time phrases" className="flex flex-wrap gap-1.5">
                {timePhrases.map((phrase) => (
                  <li key={phrase}>
                    <Badge variant="secondary">{phrase}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Recent questions
              <CountPill count={recent.length} />
            </CardTitle>
            <CardDescription>
              Kept for this visit only. They are gone when you leave the page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Questions you ask show up here so you can run them again.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {recent.map((question) => (
                  <li key={question}>
                    <button
                      type="button"
                      onClick={() => run(question)}
                      className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0">{question}</span>
                      <ChevronRightIcon
                        aria-hidden
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function answerText(
  result: AskResult,
  groups: Group[],
  nameOf: (id?: string) => string
) {
  const lines = [
    result.query,
    "",
    result.summary,
    result.interpretation.join(" | "),
  ]
  for (const group of groups) {
    lines.push("", nameOf(group.personId))
    for (const row of group.rows)
      lines.push(`- ${row.text}${row.meta ? ` (${row.meta})` : ""}`)
  }
  return lines.join("\n")
}

function Answer({
  result,
  onAsk,
}: {
  result: AskResult
  onAsk: (question: string) => void
}) {
  const ws = workspace.use()
  const groups = groupRows(result.rows)
  const nameOf = (id?: string) =>
    id ? (getPerson(ws, id)?.name ?? "Removed person") : "Whole team"

  async function copy() {
    if (await copyText(answerText(result, groups, nameOf)))
      toast.success("Answer copied to the clipboard")
    else toast.error("Could not copy. Select the text and copy it by hand.")
  }

  return (
    <section
      aria-label="Answer"
      aria-live="polite"
      className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2.5">
          <p className="font-heading text-lg leading-snug font-medium text-pretty">
            {result.summary}
          </p>
          <ul
            aria-label="How the question was read"
            className="flex flex-wrap gap-1.5"
          >
            {result.interpretation.map((chip) => (
              <li key={chip}>
                <Badge variant="outline">{chip}</Badge>
              </li>
            ))}
          </ul>
        </div>
        {result.rows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={copy}
          >
            <CopyIcon data-icon="inline-start" />
            Copy as text
          </Button>
        )}
      </div>

      {result.rows.length === 0 ? (
        <EmptyState
          bare
          size="sm"
          icon={<SearchXIcon />}
          title="Nothing on record matches"
          description="Try a wider time range, drop the name, or start from a question that names a topic."
          action={askExamples.slice(1, 4).map((example) => (
            <Button
              key={example}
              variant="outline"
              size="sm"
              className="h-auto min-h-7 rounded-full py-1 whitespace-normal"
              onClick={() => onAsk(example)}
            >
              {example}
            </Button>
          ))}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            {plural(result.rows.length, "row")} across{" "}
            {plural(groups.length, "person", "people")}
          </p>
          {groups.map((group) => (
            <div
              key={group.personId ?? "team"}
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2">
                {group.personId ? (
                  <PersonChip personId={group.personId} />
                ) : (
                  <span className="text-sm font-medium">Whole team</span>
                )}
                <CountPill count={group.rows.length} />
              </div>
              <ul className="flex flex-col divide-y rounded-lg border">
                {group.rows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={row.href}
                      className="flex items-start gap-3 px-3 py-2.5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <StatusDot
                        tone={row.tone ?? "neutral"}
                        label={toneLabels[row.tone ?? "neutral"]}
                        className="mt-1.5"
                      />
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="text-sm leading-snug">{row.text}</span>
                        {row.meta && (
                          <span className="text-xs leading-relaxed text-muted-foreground">
                            {row.meta}
                          </span>
                        )}
                      </span>
                      <ChevronRightIcon
                        aria-hidden
                        className="mt-1 size-3.5 shrink-0 text-muted-foreground"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
