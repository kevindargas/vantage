"use client"

import * as React from "react"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  CheckIcon,
  OctagonAlertIcon,
  PlusIcon,
  RepeatIcon,
  RotateCcwIcon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { Section } from "@/components/shared/page-header"
import { StateBadge, toneClasses } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  BLOCKER_RECURRENCE_TRIGGER,
  blockerCategoryLabels,
} from "@/lib/constants"
import { firstName, formatDay, plural } from "@/lib/format"
import type { Blocker, BlockerCategory, Person } from "@/lib/types"
import { questionsFor } from "@/lib/vantage/question-bank"
import { actions, workspace } from "@/lib/vantage/store"
import { Disclosure, NoteDialog, SimpleSelect, type Option } from "../../parts"

const categoryOptions: Option<BlockerCategory>[] = (
  Object.keys(blockerCategoryLabels) as BlockerCategory[]
).map((value) => ({ value, label: blockerCategoryLabels[value] }))

type Prompt = { kind: "again" | "escalate"; blocker: Blocker }

function Occurrences({ blocker }: { blocker: Blocker }) {
  const list = [...blocker.occurrences].sort((a, b) =>
    b.date.localeCompare(a.date)
  )
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>When it came up</Eyebrow>
      <ol className="flex flex-col gap-1.5">
        {list.map((o, i) => (
          <li
            key={`${o.date}-${i}`}
            className="flex flex-wrap items-baseline gap-x-2 text-xs"
          >
            <span className="w-20 shrink-0 text-muted-foreground tabular-nums">
              {formatDay(o.date)}
            </span>
            <span className="min-w-0 flex-1">
              {o.note || <span className="text-muted-foreground">No note</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function GrowPrompt({
  name,
  custom,
}: {
  name: string
  custom: Parameters<typeof questionsFor>[1]
}) {
  const questions = questionsFor("grow", custom)
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border p-3.5",
        toneClasses.danger.badge
      )}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <OctagonAlertIcon className="size-4" /> A GROW conversation is suggested
      </p>
      <p className="text-xs leading-relaxed text-foreground">
        This has come up {BLOCKER_RECURRENCE_TRIGGER} times or more. Instead of
        solving it again, coach {name} through it with these questions.
      </p>
      <ol className="flex flex-col gap-2">
        {questions.map((q) => (
          <li key={q.id} className="flex items-start gap-2.5 text-sm">
            {q.tag && (
              <span className="mt-0.5 w-16 shrink-0 text-2xs font-semibold tracking-wide uppercase">
                {q.tag}
              </span>
            )}
            <span className="min-w-0 text-foreground">{q.text}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function BlockerCard({
  blocker,
  name,
  onPrompt,
}: {
  blocker: Blocker
  name: string
  onPrompt: (prompt: Prompt) => void
}) {
  const ws = workspace.use()
  const count = blocker.occurrences.length
  const recurring = count >= BLOCKER_RECURRENCE_TRIGGER
  const resolved = blocker.status === "resolved"
  return (
    <Card className={cn(resolved && "bg-muted/30")}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h3 className="font-heading text-base leading-snug font-semibold tracking-tight">
              {blocker.title}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="font-normal">
                {blockerCategoryLabels[blocker.category]}
              </Badge>
              <StateBadge
                state={
                  resolved
                    ? "Resolved"
                    : blocker.status === "escalated"
                      ? "Escalated"
                      : "Open"
                }
                size="sm"
              />
              {blocker.status === "escalated" && blocker.escalatedTo && (
                <span className="text-xs text-muted-foreground">
                  to {blocker.escalatedTo}
                </span>
              )}
            </div>
          </div>
          <div
            className={cn(
              "flex shrink-0 flex-col items-center rounded-lg border px-3 py-1.5 leading-tight",
              recurring && !resolved
                ? toneClasses.danger.badge
                : "bg-muted/40 text-foreground"
            )}
          >
            <span className="text-lg font-semibold tabular-nums">{count}</span>
            <span className="text-2xs">
              {count === 1 ? "time raised" : "times raised"}
            </span>
          </div>
        </div>

        {recurring && !resolved && (
          <GrowPrompt name={name} custom={ws.customQuestions} />
        )}

        <Occurrences blocker={blocker} />

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          {resolved ? (
            <>
              <span className="text-xs text-muted-foreground">
                {blocker.validTo
                  ? `Resolved ${formatDay(blocker.validTo)}`
                  : "Resolved"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  actions.setBlockerStatus(blocker.id, "open")
                  toast.success("Blocker reopened", {
                    description: blocker.title,
                  })
                }}
              >
                <RotateCcwIcon /> Reopen
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPrompt({ kind: "again", blocker })}
              >
                <RepeatIcon /> Came up again
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPrompt({ kind: "escalate", blocker })}
              >
                <ArrowUpRightIcon /> Escalate
              </Button>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => {
                  actions.setBlockerStatus(blocker.id, "resolved")
                  toast.success("Blocker resolved", {
                    description: blocker.title,
                  })
                }}
              >
                <CheckIcon /> Resolve
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function AddBlockerDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: Person
}) {
  const [title, setTitle] = React.useState("")
  const [category, setCategory] = React.useState<BlockerCategory>("cross-team")
  const [note, setNote] = React.useState("")

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setTitle("")
      setCategory("cross-team")
      setNote("")
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    actions.addBlocker({
      personId: person.id,
      title,
      category,
      note: note.trim() || undefined,
    })
    toast.success("Blocker logged", { description: title.trim() })
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Log a blocker</DialogTitle>
            <DialogDescription>
              Name what is in {firstName(person.name)}&apos;s way. Each time it
              comes up again the count rises, and at{" "}
              {BLOCKER_RECURRENCE_TRIGGER} a coaching conversation is suggested.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="blocker-title">Blocker</FieldLabel>
              <Input
                id="blocker-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Waiting on the data team for schema approval"
                required
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="blocker-category">Category</FieldLabel>
              <SimpleSelect
                id="blocker-category"
                value={category}
                onChange={setCategory}
                options={categoryOptions}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="blocker-note">Note (optional)</FieldLabel>
              <Textarea
                id="blocker-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What they said, in their words"
                className="min-h-16"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Log blocker
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** What is in the person's way, with a count of how often it came up. */
export function BlockersTab({ person }: { person: Person }) {
  const ws = workspace.use()
  const [adding, setAdding] = React.useState(false)
  const [prompt, setPrompt] = React.useState<Prompt | null>(null)
  const name = firstName(person.name)
  const all = ws.blockers.filter((b) => b.personId === person.id)
  const open = all
    .filter((b) => b.status !== "resolved")
    .sort((a, b) => b.occurrences.length - a.occurrences.length)
  const resolved = all
    .filter((b) => b.status === "resolved")
    .sort((a, b) => (b.validTo ?? "").localeCompare(a.validTo ?? ""))
  const recurring = open.filter(
    (b) => b.occurrences.length >= BLOCKER_RECURRENCE_TRIGGER
  ).length

  const addButton = (
    <Button
      size="sm"
      onClick={() => setAdding(true)}
      disabled={person.status !== "active"}
    >
      <PlusIcon /> Add blocker
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Open blockers"
        count={open.length}
        description={
          recurring
            ? `${plural(recurring, "blocker")} raised ${BLOCKER_RECURRENCE_TRIGGER} times or more.`
            : `A blocker raised ${BLOCKER_RECURRENCE_TRIGGER} times suggests a coaching conversation instead of another fix.`
        }
        actions={addButton}
      >
        {open.length === 0 ? (
          <EmptyState
            size="sm"
            title="No open blockers"
            description={`When ${name} raises something that is in the way, log it here so repeats are counted.`}
            action={addButton}
          />
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {open.map((b) => (
              <BlockerCard
                key={b.id}
                blocker={b}
                name={name}
                onPrompt={setPrompt}
              />
            ))}
          </div>
        )}
      </Section>

      {resolved.length > 0 && (
        <Disclosure label="Resolved" count={resolved.length}>
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {resolved.map((b) => (
              <BlockerCard
                key={b.id}
                blocker={b}
                name={name}
                onPrompt={setPrompt}
              />
            ))}
          </div>
        </Disclosure>
      )}

      <AddBlockerDialog
        open={adding}
        onOpenChange={setAdding}
        person={person}
      />

      <NoteDialog
        open={prompt?.kind === "again"}
        onOpenChange={(next) => !next && setPrompt(null)}
        title="It came up again"
        description={prompt?.blocker.title}
        label="Note (optional)"
        placeholder="What was different this time?"
        hint="Adds an occurrence with today's date."
        submitLabel="Log occurrence"
        onSubmit={(note) => {
          if (!prompt) return
          actions.logBlockerOccurrence(prompt.blocker.id, note || undefined)
          toast.success("Occurrence logged", {
            description: `${prompt.blocker.title}: raised ${plural(prompt.blocker.occurrences.length + 1, "time")}`,
          })
        }}
      />
      <NoteDialog
        open={prompt?.kind === "escalate"}
        onOpenChange={(next) => !next && setPrompt(null)}
        title="Escalate this blocker"
        description={prompt?.blocker.title}
        label="Escalate to"
        placeholder="Name or team that can unblock it"
        hint="This records who you took it to. Vantage does not contact anyone."
        submitLabel="Mark as escalated"
        multiline={false}
        required
        onSubmit={(to) => {
          if (!prompt) return
          actions.setBlockerStatus(
            prompt.blocker.id,
            "escalated",
            `Escalated to ${to}`,
            to
          )
          toast.success("Blocker marked as escalated", {
            description: `${prompt.blocker.title}, to ${to}`,
          })
        }}
      />
    </div>
  )
}
