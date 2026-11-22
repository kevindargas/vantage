"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  blockerCategoryLabels,
  meetingTypeDescriptions,
  meetingTypeLabels,
} from "@/lib/constants"
import { firstName, formatWhen, plural } from "@/lib/format"
import { atTime, dayOf, timeOf, today } from "@/lib/time"
import type {
  AgendaOwner,
  BlockerCategory,
  Meeting,
  MeetingType,
  Person,
} from "@/lib/types"
import { actions, workspace } from "@/lib/vantage/store"
import { meetingTypes } from "./parts"

interface MeetingDialogProps {
  meeting: Meeting
  person: Person
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* -------------------------------------------------------------- reschedule */

/** Move a 1:1 to another day and time. Also brings a cancelled one back. */
export function RescheduleDialog({
  meeting,
  person,
  open,
  onOpenChange,
}: MeetingDialogProps) {
  const [day, setDay] = React.useState("")
  const [time, setTime] = React.useState("")
  const original = dayOf(meeting.scheduledAt)
  const effectiveDay = day || (original < today() ? today() : original)
  const effectiveTime = time || timeOf(meeting.scheduledAt)
  const name = firstName(person.name)
  const cancelled = meeting.status === "cancelled"

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setDay("")
      setTime("")
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const scheduledAt = atTime(effectiveDay, effectiveTime)
    actions.rescheduleMeeting(meeting.id, scheduledAt)
    toast.success(cancelled ? "1:1 back on the calendar" : "1:1 moved", {
      description: `${formatWhen(scheduledAt)}. Let ${name} know the new time yourself.`,
    })
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>
              {cancelled ? "Reschedule this 1:1" : "Move this 1:1"}
            </DialogTitle>
            <DialogDescription>
              Pick a new day and time with {name}. The original time stays on
              the record.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="reschedule-day">Day</FieldLabel>
                <Input
                  id="reschedule-day"
                  type="date"
                  value={effectiveDay}
                  min={today()}
                  onChange={(e) => setDay(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="reschedule-time">Time</FieldLabel>
                <Input
                  id="reschedule-time"
                  type="time"
                  value={effectiveTime}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              Keep the current time
            </Button>
            <Button type="submit">
              {cancelled ? "Reschedule" : "Move 1:1"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ cancel */

/**
 * Cancelling is a two-step dialog. The first step offers to move the 1:1
 * instead; only the second records who cancelled and why.
 */
export function CancelDialog({
  meeting,
  person,
  open,
  onOpenChange,
  onReschedule,
}: MeetingDialogProps & { onReschedule: () => void }) {
  const [step, setStep] = React.useState<"offer" | "confirm">("offer")
  const [by, setBy] = React.useState<AgendaOwner>("manager")
  const [reason, setReason] = React.useState("")
  const name = firstName(person.name)

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setStep("offer")
      setBy("manager")
      setReason("")
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    actions.cancelMeeting(meeting.id, by, reason)
    toast("1:1 cancelled", {
      description: `It stays on the record. Let ${name} know yourself, and reschedule it from this page when you can.`,
    })
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        {step === "offer" ? (
          <>
            <DialogHeader>
              <DialogTitle>Move it instead?</DialogTitle>
              <DialogDescription>
                A cancelled 1:1 tells them it is optional. Move it within the
                week instead.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("confirm")}
              >
                Cancel it anyway
              </Button>
              <Button
                type="button"
                onClick={() => {
                  close(false)
                  onReschedule()
                }}
              >
                Reschedule instead
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="contents">
            <DialogHeader>
              <DialogTitle>Cancel this 1:1</DialogTitle>
              <DialogDescription>
                The cancellation stays on the record and counts toward cadence
                drift for {name}.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel>Who cancelled</FieldLabel>
                <ToggleGroup
                  value={[by]}
                  onValueChange={(v) => {
                    const next = v[0] as AgendaOwner | undefined
                    if (next) setBy(next)
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <ToggleGroupItem value="manager" className="flex-1">
                    You
                  </ToggleGroupItem>
                  <ToggleGroupItem value="report" className="flex-1">
                    {name}
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="cancel-reason">Reason</FieldLabel>
                <Textarea
                  id="cancel-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Out sick, release day, travel"
                  className="min-h-16"
                />
                <FieldDescription>
                  Optional. A short reason helps when you look back at the
                  pattern.
                </FieldDescription>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("offer")}
              >
                Back
              </Button>
              <Button type="submit" variant="destructive">
                Cancel 1:1
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------- change type */

const typeItems = meetingTypes.map((t) => ({
  value: t,
  label: meetingTypeLabels[t],
}))

export function ChangeTypeDialog({
  meeting,
  open,
  onOpenChange,
}: Omit<MeetingDialogProps, "person">) {
  const [picked, setPicked] = React.useState<MeetingType | null>(null)
  const type = picked ?? meeting.type

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) setPicked(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (type !== meeting.type) {
      actions.updateMeeting(meeting.id, { type })
      toast.success(`Changed to ${meetingTypeLabels[type].toLowerCase()}`)
    }
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Change the conversation type</DialogTitle>
            <DialogDescription>
              The type sets the suggested questions and the guidance during the
              conversation. The agenda is kept as it is.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="change-type">Conversation</FieldLabel>
            <Select
              value={type}
              onValueChange={(v) => v && setPicked(v as MeetingType)}
              items={typeItems}
            >
              <SelectTrigger id="change-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{meetingTypeDescriptions[type]}</FieldDescription>
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              Keep it
            </Button>
            <Button type="submit" disabled={type === meeting.type}>
              Change type
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------------- blocker */

const NEW_BLOCKER = "new"
const categories = Object.keys(blockerCategoryLabels) as BlockerCategory[]

/**
 * Log a blocker from inside a 1:1: either an open one came up again, or a
 * new one is added to the record.
 */
export function BlockerDialog({
  meeting,
  person,
  open,
  onOpenChange,
}: MeetingDialogProps) {
  const ws = workspace.use()
  const existing = ws.blockers.filter(
    (b) => b.personId === person.id && b.status !== "resolved"
  )
  const [choice, setChoice] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState("")
  const [category, setCategory] = React.useState<BlockerCategory>("cross-team")
  const [note, setNote] = React.useState("")
  const selected =
    choice && (choice === NEW_BLOCKER || existing.some((b) => b.id === choice))
      ? choice
      : existing.length
        ? null
        : NEW_BLOCKER
  const isNew = selected === NEW_BLOCKER
  const name = firstName(person.name)

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setChoice(null)
      setTitle("")
      setCategory("cross-team")
      setNote("")
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const trimmed = note.trim() || undefined
    if (isNew) {
      if (!title.trim()) return
      actions.addBlocker({
        personId: person.id,
        title,
        category,
        note: trimmed,
        sourceMeetingId: meeting.id,
      })
      toast.success("Blocker added", { description: title.trim() })
    } else {
      const blocker = existing.find((b) => b.id === selected)
      actions.logBlockerOccurrence(selected, trimmed, meeting.id)
      toast.success("Logged: it came up again", {
        description: blocker
          ? `${blocker.title}: raised ${plural(blocker.occurrences.length + 1, "time")}`
          : undefined,
      })
    }
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Log a blocker</DialogTitle>
            <DialogDescription>
              Mark an open blocker as raised again, or add a new one to {name}
              &apos;s record.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-medium">
                Which blocker
              </legend>
              {existing.map((b) => (
                <BlockerOption
                  key={b.id}
                  value={b.id}
                  checked={selected === b.id}
                  onSelect={setChoice}
                  title={b.title}
                  detail={`${blockerCategoryLabels[b.category]}, raised ${plural(b.occurrences.length, "time")}`}
                />
              ))}
              <BlockerOption
                value={NEW_BLOCKER}
                checked={isNew}
                onSelect={setChoice}
                title="A new blocker"
                detail={
                  existing.length
                    ? "Not on the record yet"
                    : `${name} has no open blockers on the record`
                }
              />
            </fieldset>
            {isNew && (
              <>
                <Field>
                  <FieldLabel htmlFor="blocker-title">
                    What is in the way
                  </FieldLabel>
                  <Input
                    id="blocker-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Waiting on the platform team for staging access"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="blocker-category">Category</FieldLabel>
                  <NativeSelect
                    id="blocker-category"
                    className="w-full"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as BlockerCategory)
                    }
                  >
                    {categories.map((c) => (
                      <NativeSelectOption key={c} value={c}>
                        {blockerCategoryLabels[c]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              </>
            )}
            {selected && (
              <Field>
                <FieldLabel htmlFor="blocker-note">Note</FieldLabel>
                <Textarea
                  id="blocker-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    isNew
                      ? "What they said, in their words"
                      : "What was different this time"
                  }
                  className="min-h-16"
                />
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              Close
            </Button>
            <Button
              type="submit"
              disabled={!selected || (isNew && !title.trim())}
            >
              {isNew ? "Add blocker" : "Log it came up again"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BlockerOption({
  value,
  checked,
  onSelect,
  title,
  detail,
}: {
  value: string
  checked: boolean
  onSelect: (value: string) => void
  title: string
  detail: string
}) {
  return (
    <label className="grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg border bg-card px-3 py-2 transition-colors hover:bg-muted/60 has-checked:border-brand/40 has-checked:bg-brand/10 has-focus-visible:ring-2 has-focus-visible:ring-ring">
      <input
        type="radio"
        name="blocker-choice"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="row-span-2 mt-1 accent-(--brand)"
      />
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </label>
  )
}
