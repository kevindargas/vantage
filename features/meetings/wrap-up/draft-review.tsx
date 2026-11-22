"use client"

import * as React from "react"
import { cn } from "cn"
import { CheckIcon, PencilIcon, RotateCcwIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { CountPill } from "@/components/shared/count-pill"
import { StateBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { FeedbackComposer } from "@/features/shared/feedback-composer"
import {
  blockerCategoryLabels,
  burnoutDimensionLabels,
  careerTrackLabels,
  workloadMarkerLabels,
} from "@/lib/constants"
import { formatDay, plural } from "@/lib/format"
import type {
  AgendaOwner,
  BlockerCategory,
  CareerTrack,
  Meeting,
  Person,
  WorkloadMarkerKind,
} from "@/lib/types"
import { actions, workspace } from "@/lib/vantage/store"
import type {
  BlockerDraft,
  CareerDraft,
  CommitmentDraft,
  Draft,
  RecognitionDraft,
  UpwardDraft,
  WorkloadDraft,
} from "@/lib/vantage/transcript"
import type { DraftStatus, ReviewedDraft } from "./analysis"

type Decide = (status: "accepted" | "discarded" | null) => void

interface CardProps<D extends Draft> {
  draft: D
  status: DraftStatus
  meeting: Meeting
  person: Person
  /** Direct report's first name. */
  name: string
  onDecide: Decide
}

const categories = Object.keys(blockerCategoryLabels) as BlockerCategory[]
const tracks = Object.keys(careerTrackLabels) as CareerTrack[]
const markers = Object.keys(workloadMarkerLabels) as WorkloadMarkerKind[]

/** A labelled inline field for the edit state of a draft. */
function EditField({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string
  htmlFor: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}

/**
 * The shared frame of a draft: the proposed record, the exact words it came
 * from, optional edit fields, and the three decisions. Once decided it folds
 * down to a single line.
 */
function DraftFrame({
  kindLabel,
  title,
  meta,
  quote,
  status,
  editing,
  onEdit,
  editLabel = "Edit",
  acceptLabel = "Accept",
  canAccept = true,
  onAccept,
  onDecide,
  note,
  children,
}: {
  kindLabel: string
  title: string
  meta?: React.ReactNode
  quote: string
  status: DraftStatus
  editing?: boolean
  /** Omit when the draft has nothing to edit in place. */
  onEdit?: () => void
  editLabel?: string
  acceptLabel?: string
  canAccept?: boolean
  onAccept: () => void
  onDecide: Decide
  note?: React.ReactNode
  /** Edit fields, rendered while `editing`. */
  children?: React.ReactNode
}) {
  if (status !== "pending")
    return (
      <li
        data-slot="draft"
        data-status={status}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2"
      >
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {title}
        </p>
        <StateBadge
          size="sm"
          state={status === "accepted" ? "Accepted" : "Discarded"}
          tone={status === "accepted" ? "success" : "muted"}
        />
        {status === "discarded" && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-label={`Restore ${kindLabel}: ${title}`}
            onClick={() => onDecide(null)}
          >
            <RotateCcwIcon />
            Restore
          </Button>
        )}
      </li>
    )

  return (
    <li
      data-slot="draft"
      data-status="pending"
      className="flex flex-col gap-2.5 rounded-lg border bg-card px-3 py-3"
    >
      <div className="min-w-0">
        <p className="text-sm leading-snug font-medium">{title}</p>
        {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
      </div>
      <blockquote className="border-l-2 border-border pl-3 text-sm text-muted-foreground">
        <span className="sr-only">From the transcript: </span>
        &ldquo;{quote}&rdquo;
      </blockquote>
      {editing && children && (
        <div className="grid gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-2">
          {children}
        </div>
      )}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!canAccept}
          aria-label={`${acceptLabel} ${kindLabel}: ${title}`}
          onClick={onAccept}
        >
          <CheckIcon />
          {acceptLabel}
        </Button>
        {onEdit && !editing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`${editLabel} ${kindLabel}: ${title}`}
            onClick={onEdit}
          >
            <PencilIcon />
            {editLabel}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Discard ${kindLabel}: ${title}`}
          onClick={() => onDecide("discarded")}
        >
          <XIcon />
          Discard
        </Button>
      </div>
    </li>
  )
}

function CommitmentCard({
  draft,
  status,
  meeting,
  person,
  name,
  onDecide,
}: CardProps<CommitmentDraft>) {
  const uid = React.useId()
  const [editing, setEditing] = React.useState(false)
  const [owner, setOwner] = React.useState<AgendaOwner>(draft.owner)
  const [text, setText] = React.useState(draft.text)
  const [due, setDue] = React.useState(draft.dueDate ?? "")
  const who = owner === "manager" ? "You" : name
  return (
    <DraftFrame
      kindLabel="commitment"
      title={`${who}: ${text.trim() || draft.text}`}
      meta={due ? `Due ${formatDay(due)}` : "No due date was mentioned"}
      quote={draft.quote}
      status={status}
      editing={editing}
      onEdit={() => setEditing(true)}
      canAccept={!!text.trim()}
      onAccept={() => {
        actions.addCommitment({
          personId: person.id,
          owner,
          text,
          dueDate: due || undefined,
          sourceMeetingId: meeting.id,
        })
        onDecide("accepted")
      }}
      onDecide={onDecide}
    >
      <EditField label="What" htmlFor={`${uid}-text`} className="sm:col-span-2">
        <Input
          id={`${uid}-text`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </EditField>
      <EditField label="Who owes it" htmlFor={`${uid}-owner`}>
        <NativeSelect
          id={`${uid}-owner`}
          className="w-full"
          value={owner}
          onChange={(e) => setOwner(e.target.value as AgendaOwner)}
        >
          <NativeSelectOption value="manager">You</NativeSelectOption>
          <NativeSelectOption value="report">{name}</NativeSelectOption>
        </NativeSelect>
      </EditField>
      <EditField label="Due" htmlFor={`${uid}-due`}>
        <Input
          id={`${uid}-due`}
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </EditField>
    </DraftFrame>
  )
}

function BlockerCard({
  draft,
  status,
  meeting,
  person,
  onDecide,
}: CardProps<BlockerDraft>) {
  const ws = workspace.use()
  const uid = React.useId()
  const existing = ws.blockers.find((b) => b.id === draft.matchesBlockerId)
  const [editing, setEditing] = React.useState(false)
  const [asNew, setAsNew] = React.useState(false)
  const [title, setTitle] = React.useState(draft.title)
  const [category, setCategory] = React.useState(draft.category)
  const target = asNew ? undefined : existing
  const again = !!target
  return (
    <DraftFrame
      kindLabel="blocker"
      title={
        target
          ? `Came up again: ${target.title}`
          : `New blocker: ${title.trim() || draft.title}`
      }
      meta={
        target
          ? `Already on the record ${plural(target.occurrences.length, "time")}. Accepting adds one more.`
          : blockerCategoryLabels[category]
      }
      quote={draft.quote}
      status={status}
      editing={editing}
      onEdit={() => setEditing(true)}
      canAccept={again || !!title.trim()}
      onAccept={() => {
        if (target)
          actions.logBlockerOccurrence(target.id, draft.quote, meeting.id)
        else
          actions.addBlocker({
            personId: person.id,
            title,
            category,
            note: draft.quote,
            sourceMeetingId: meeting.id,
          })
        onDecide("accepted")
      }}
      onDecide={onDecide}
      note={
        existing && !editing ? (
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto p-0"
            onClick={() => setAsNew(again)}
          >
            {again
              ? "Create a new blocker instead"
              : "Log it on the existing blocker instead"}
          </Button>
        ) : undefined
      }
    >
      {existing && (
        <EditField
          label="Record as"
          htmlFor={`${uid}-mode`}
          className="sm:col-span-2"
        >
          <NativeSelect
            id={`${uid}-mode`}
            className="w-full"
            value={asNew ? "new" : "again"}
            onChange={(e) => setAsNew(e.target.value === "new")}
          >
            <NativeSelectOption value="again">
              Came up again: {existing.title}
            </NativeSelectOption>
            <NativeSelectOption value="new">A new blocker</NativeSelectOption>
          </NativeSelect>
        </EditField>
      )}
      {!again && (
        <>
          <EditField
            label="Title"
            htmlFor={`${uid}-title`}
            className="sm:col-span-2"
          >
            <Input
              id={`${uid}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </EditField>
          <EditField label="Category" htmlFor={`${uid}-category`}>
            <NativeSelect
              id={`${uid}-category`}
              className="w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value as BlockerCategory)}
            >
              {categories.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {blockerCategoryLabels[c]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </EditField>
        </>
      )}
    </DraftFrame>
  )
}

/**
 * Recognition and upward feedback need a situation and an impact before they
 * are worth keeping, so accepting opens the feedback form with the behavior
 * filled in. The draft counts as accepted only when that form was saved.
 */
function FeedbackCard({
  draft,
  status,
  meeting,
  person,
  name,
  onDecide,
}: CardProps<RecognitionDraft | UpwardDraft>) {
  const [open, setOpen] = React.useState(false)
  const savedBefore = React.useRef(0)
  const upward = draft.kind === "upward"
  const savedCount = () =>
    workspace.get().feedback.filter((f) => f.sourceMeetingId === meeting.id)
      .length
  return (
    <>
      <DraftFrame
        kindLabel={upward ? "feedback for you" : "recognition"}
        title={draft.behavior}
        meta={upward ? `Said by ${name}` : `Praise you gave ${name}`}
        quote={draft.quote}
        status={status}
        acceptLabel="Complete and accept"
        onAccept={() => {
          savedBefore.current = savedCount()
          setOpen(true)
        }}
        onDecide={onDecide}
        note="Opens the feedback form with the behavior filled in. Add the situation and the impact, then save. Closing the form without saving leaves this suggestion open."
      />
      {open && (
        <FeedbackComposer
          open
          onOpenChange={(next) => {
            if (next) return
            setOpen(false)
            if (savedCount() > savedBefore.current) onDecide("accepted")
          }}
          personId={person.id}
          sourceMeetingId={meeting.id}
          initial={
            upward
              ? { direction: "upward", behavior: draft.behavior }
              : { kind: "recognition", behavior: draft.behavior }
          }
        />
      )}
    </>
  )
}

function CareerCard({
  draft,
  status,
  meeting,
  person,
  onDecide,
}: CardProps<CareerDraft>) {
  const uid = React.useId()
  const [editing, setEditing] = React.useState(false)
  const [mode, setMode] = React.useState<"aspiration" | "milestone">(
    "aspiration"
  )
  const [statement, setStatement] = React.useState(draft.statement)
  const [track, setTrack] = React.useState<CareerTrack>(
    /\b(manage|management|manager)\b/i.test(draft.statement)
      ? "management"
      : "ic"
  )
  return (
    <DraftFrame
      kindLabel="career signal"
      title={statement.trim() || draft.statement}
      meta={
        mode === "aspiration"
          ? `Record as aspiration, track: ${careerTrackLabels[track]}. The current aspiration is closed and kept in history.`
          : "Add as a stretch milestone"
      }
      quote={draft.quote}
      status={status}
      editing={editing}
      onEdit={() => setEditing(true)}
      canAccept={!!statement.trim()}
      onAccept={() => {
        if (mode === "aspiration")
          actions.setAspiration({
            personId: person.id,
            statement,
            track,
            sourceMeetingId: meeting.id,
          })
        else
          actions.addMilestone({
            personId: person.id,
            kind: "stretch",
            title: statement,
            sourceMeetingId: meeting.id,
          })
        onDecide("accepted")
      }}
      onDecide={onDecide}
      note={
        !editing ? (
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto p-0"
            onClick={() =>
              setMode(mode === "aspiration" ? "milestone" : "aspiration")
            }
          >
            {mode === "aspiration"
              ? "Add as milestone instead"
              : "Record as aspiration instead"}
          </Button>
        ) : undefined
      }
    >
      <EditField
        label="In their words"
        htmlFor={`${uid}-statement`}
        className="sm:col-span-2"
      >
        <Textarea
          id={`${uid}-statement`}
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          className="min-h-14"
        />
      </EditField>
      <EditField label="Record as" htmlFor={`${uid}-mode`}>
        <NativeSelect
          id={`${uid}-mode`}
          className="w-full"
          value={mode}
          onChange={(e) =>
            setMode(e.target.value as "aspiration" | "milestone")
          }
        >
          <NativeSelectOption value="aspiration">Aspiration</NativeSelectOption>
          <NativeSelectOption value="milestone">
            Stretch milestone
          </NativeSelectOption>
        </NativeSelect>
      </EditField>
      {mode === "aspiration" && (
        <EditField label="Track" htmlFor={`${uid}-track`}>
          <NativeSelect
            id={`${uid}-track`}
            className="w-full"
            value={track}
            onChange={(e) => setTrack(e.target.value as CareerTrack)}
          >
            {tracks.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {careerTrackLabels[t]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </EditField>
      )}
    </DraftFrame>
  )
}

function WorkloadCard({
  draft,
  status,
  meeting,
  person,
  onDecide,
}: CardProps<WorkloadDraft>) {
  const uid = React.useId()
  const [editing, setEditing] = React.useState(false)
  const [marker, setMarker] = React.useState(draft.marker)
  const [note, setNote] = React.useState(draft.note)
  return (
    <DraftFrame
      kindLabel="workload marker"
      title={workloadMarkerLabels[marker]}
      meta={
        draft.dimension
          ? `They described: ${burnoutDimensionLabels[draft.dimension].label.toLowerCase()}`
          : undefined
      }
      quote={draft.quote}
      status={status}
      editing={editing}
      onEdit={() => setEditing(true)}
      canAccept={!!note.trim()}
      onAccept={() => {
        actions.addWorkloadMarker({
          personId: person.id,
          kind: marker,
          note: note.trim(),
          dimension: draft.dimension,
          sourceMeetingId: meeting.id,
        })
        onDecide("accepted")
      }}
      onDecide={onDecide}
    >
      <EditField label="Marker" htmlFor={`${uid}-marker`}>
        <NativeSelect
          id={`${uid}-marker`}
          className="w-full"
          value={marker}
          onChange={(e) => setMarker(e.target.value as WorkloadMarkerKind)}
        >
          {markers.map((m) => (
            <NativeSelectOption key={m} value={m}>
              {workloadMarkerLabels[m]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </EditField>
      <EditField
        label="Note, in their words"
        htmlFor={`${uid}-note`}
        className="sm:col-span-2"
      >
        <Textarea
          id={`${uid}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-14"
        />
      </EditField>
    </DraftFrame>
  )
}

function DraftCard(props: CardProps<Draft>) {
  const { draft, ...rest } = props
  switch (draft.kind) {
    case "commitment":
      return <CommitmentCard draft={draft} {...rest} />
    case "blocker":
      return <BlockerCard draft={draft} {...rest} />
    case "recognition":
    case "upward":
      return <FeedbackCard draft={draft} {...rest} />
    case "career":
      return <CareerCard draft={draft} {...rest} />
    case "workload":
      return <WorkloadCard draft={draft} {...rest} />
  }
}

/**
 * Suggestions from the transcript, grouped by kind. Nothing is written to the
 * record until the manager accepts a draft.
 */
export function DraftReview({
  reviewed,
  meeting,
  person,
  name,
  onDecide,
}: {
  reviewed: ReviewedDraft[]
  meeting: Meeting
  person: Person
  name: string
  onDecide: (key: string, status: "accepted" | "discarded" | null) => void
}) {
  const groups: { kind: Draft["kind"]; title: string; hint: string }[] = [
    {
      kind: "commitment",
      title: "Commitments",
      hint: "Who said they will do what, and by when.",
    },
    {
      kind: "blocker",
      title: "Blockers",
      hint: `What ${name} said is in the way. A repeat of a known blocker is logged on that blocker.`,
    },
    {
      kind: "recognition",
      title: "Recognition",
      hint: `Praise you gave ${name}. Add the situation and impact so it stays specific.`,
    },
    {
      kind: "career",
      title: "Career signals",
      hint: `What ${name} said about where they want to go.`,
    },
    {
      kind: "workload",
      title: "Stated workload pressure",
      hint: `These are things ${name} said in words. Nothing is inferred.`,
    },
    {
      kind: "upward",
      title: "Feedback for you",
      hint: `What ${name} asked you to do differently.`,
    },
  ]

  const done = reviewed.filter((r) => r.status !== "pending").length

  function acceptAllCommitments() {
    const pending = reviewed.filter(
      (r) => r.status === "pending" && r.draft.kind === "commitment"
    )
    for (const r of pending) {
      if (r.draft.kind !== "commitment") continue
      actions.addCommitment({
        personId: person.id,
        owner: r.draft.owner,
        text: r.draft.text,
        dueDate: r.draft.dueDate,
        sourceMeetingId: meeting.id,
      })
      onDecide(r.key, "accepted")
    }
    toast.success(`${plural(pending.length, "commitment")} added`, {
      description: "They now appear in the commitment lock above.",
    })
  }

  if (!reviewed.length)
    return (
      <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
        No suggestions came out of this transcript. Add what matters by hand:
        commitments in step 1, everything else from {name}&apos;s profile.
      </p>
    )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          These are suggestions. Nothing is written to {name}&apos;s record
          until you accept it.
        </p>
        <p
          className="text-sm font-medium tabular-nums"
          aria-live="polite"
          data-slot="review-progress"
        >
          {done} of {reviewed.length} reviewed
        </p>
      </div>
      {groups.map((group) => {
        const items = reviewed.filter((r) => r.draft.kind === group.kind)
        if (!items.length) return null
        const pending = items.filter((r) => r.status === "pending").length
        return (
          <section
            key={group.kind}
            aria-label={group.title}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  {group.title}
                  <CountPill count={items.length} size="default" />
                </h4>
                <p className="text-xs text-muted-foreground">{group.hint}</p>
              </div>
              {group.kind === "commitment" && pending > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={acceptAllCommitments}
                >
                  Accept all commitments
                </Button>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {items.map((r) => (
                <DraftCard
                  key={r.key}
                  draft={r.draft}
                  status={r.status}
                  meeting={meeting}
                  person={person}
                  name={name}
                  onDecide={(status) => onDecide(r.key, status)}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
