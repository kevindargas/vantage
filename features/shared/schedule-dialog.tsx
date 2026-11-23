"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { meetingTypeDescriptions, meetingTypeLabels } from "@/lib/constants"
import { firstName, formatWhen } from "@/lib/format"
import { atTime, dayOf, timeOf, today } from "@/lib/time"
import type { MeetingType } from "@/lib/types"
import { nextOccurrenceAt } from "@/lib/vantage/cadence"
import {
  getQuestion,
  scenariosForMeetingType,
  questionsFor,
} from "@/lib/vantage/question-bank"
import { getPerson } from "@/lib/vantage/selectors"
import { actions, hasMeetingOn, workspace } from "@/lib/vantage/store"
import { PersonSelect } from "./person"

export interface ScheduleMeetingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId?: string
  /** Preselected conversation type. */
  type?: MeetingType
  /** Question bank ids to put on the agenda as the manager's items. */
  questionIds?: string[]
  /** Go to the new meeting after scheduling. Defaults to true. */
  navigate?: boolean
}

const types = Object.keys(meetingTypeLabels) as MeetingType[]
const typeItems = types.map((t) => ({ value: t, label: meetingTypeLabels[t] }))
/** Conversation types whose questions are added to the agenda automatically. */
const SCRIPTED: MeetingType[] = [
  "stay",
  "career",
  "burnout",
  "onboarding",
  "performance",
]

/** Schedule a 1:1. The time defaults to the next slot in the person's cadence. */
export function ScheduleMeetingDialog({
  open,
  onOpenChange,
  personId,
  type: initialType = "weekly",
  questionIds,
  navigate = true,
}: ScheduleMeetingDialogProps) {
  const ws = workspace.use()
  const router = useRouter()
  const [person, setPerson] = React.useState(personId ?? "")
  const [type, setType] = React.useState<MeetingType>(initialType)
  const [day, setDay] = React.useState("")
  const [time, setTime] = React.useState("")
  const [duration, setDuration] = React.useState("")
  const selected = personId ?? person
  const who = getPerson(ws, selected)
  const suggested = who ? nextOccurrenceAt(who, ws.meetings) : undefined
  const effectiveDay = day || (suggested ? dayOf(suggested) : today())
  const effectiveTime = time || (suggested ? timeOf(suggested) : "10:00")
  const effectiveDuration =
    Number(duration) ||
    (type === "career" || type === "stay"
      ? 45
      : (who?.cadence.durationMin ?? 30))
  const clash = !!selected && hasMeetingOn(ws, selected, effectiveDay)
  const afternoon = Number(effectiveTime.split(":")[0]) >= 13

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setDay("")
      setTime("")
      setDuration("")
      setType(initialType)
      setPerson(personId ?? "")
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const ids =
      questionIds ??
      (SCRIPTED.includes(type)
        ? questionsFor(
            scenariosForMeetingType[type][0],
            ws.customQuestions
          ).map((q) => q.id)
        : [])
    const scheduledAt = atTime(effectiveDay, effectiveTime)
    const id = actions.scheduleMeeting({
      personId: selected,
      type,
      scheduledAt,
      durationMin: effectiveDuration,
      agenda: ids
        .map((qid) => getQuestion(qid, ws.customQuestions))
        .filter((q) => q !== undefined)
        .map((q) => ({
          text: q.text,
          owner: "manager" as const,
          questionId: q.id,
        })),
    })
    toast.success(`${meetingTypeLabels[type]} scheduled`, {
      description: `${firstName(who?.name ?? "")}, ${formatWhen(scheduledAt)}`,
    })
    close(false)
    if (navigate) router.push(`/meetings/session?id=${id}`)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Schedule a 1:1</DialogTitle>
            <DialogDescription>
              The suggested time is the next slot in the person&apos;s cadence.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            {!personId && (
              <Field>
                <FieldLabel htmlFor="schedule-person">With</FieldLabel>
                <PersonSelect
                  id="schedule-person"
                  value={person}
                  onChange={setPerson}
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="schedule-type">Conversation</FieldLabel>
              <Select
                value={type}
                onValueChange={(v) => v && setType(v as MeetingType)}
                items={typeItems}
              >
                <SelectTrigger id="schedule-type" className="w-full">
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
              <FieldDescription>
                {meetingTypeDescriptions[type]}
              </FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="schedule-day">Day</FieldLabel>
                <Input
                  id="schedule-day"
                  type="date"
                  value={effectiveDay}
                  min={today()}
                  onChange={(e) => setDay(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-time">Time</FieldLabel>
                <Input
                  id="schedule-time"
                  type="time"
                  value={effectiveTime}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-duration">Minutes</FieldLabel>
                <Input
                  id="schedule-duration"
                  type="number"
                  min={15}
                  max={120}
                  step={5}
                  value={effectiveDuration}
                  onChange={(e) => setDuration(e.target.value)}
                  required
                />
              </Field>
            </div>
            {(clash || afternoon) && (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {clash
                  ? `${firstName(who?.name ?? "They")} already has a 1:1 on that day.`
                  : "Morning 1:1s show higher engagement than afternoon ones. Move it earlier if time zones allow."}
              </p>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!selected}>
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
