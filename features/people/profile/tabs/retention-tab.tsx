"use client"

import * as React from "react"
import { AnchorIcon, CalendarPlusIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { MetricTile } from "@/components/shared/metric-tile"
import { Section } from "@/components/shared/page-header"
import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { ScheduleMeetingDialog } from "@/features/shared/schedule-dialog"
import {
  focusLabels,
  recognitionLabels,
  STAY_INTERVAL_DAYS,
  stayDriverLabels,
} from "@/lib/constants"
import { dayDistance, firstName, formatDay, formatWhen } from "@/lib/format"
import { dayOf, daysUntil } from "@/lib/time"
import type {
  Person,
  RecognitionPref,
  StayDriver,
  StayDriverKind,
} from "@/lib/types"
import { stayInterviewDue } from "@/lib/vantage/nudges"
import { questionsFor } from "@/lib/vantage/question-bank"
import {
  lastMeetingOfType,
  tenureDays,
  upcomingMeetings,
} from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import {
  History,
  OptionSelect,
  optionsFrom,
  Row,
  SourceLink,
  validityRange,
} from "./parts/common"

const kinds = Object.keys(stayDriverLabels) as StayDriverKind[]
const kindOptions = optionsFrom(stayDriverLabels)
const kindTone: Record<StayDriverKind, Tone> = {
  energizer: "success",
  learning: "info",
  "stay-reason": "brand",
  "leave-trigger": "danger",
  friction: "warning",
}
const recognitionPrefs = Object.keys(recognitionLabels) as RecognitionPref[]

/** Stay drivers, stay interview status and how the person likes to be treated. */
export function RetentionTab({ person }: { person: Person }) {
  const ws = workspace.use()
  const [driverOpen, setDriverOpen] = React.useState(false)
  const [scheduling, setScheduling] = React.useState(false)
  const name = firstName(person.name)

  const due = stayInterviewDue(ws, person)
  const lastStay = lastMeetingOfType(ws, person.id, "stay")
  const nextStay = upcomingMeetings(ws, person.id).find(
    (m) => m.type === "stay"
  )
  const untilDue = due ? daysUntil(due) : null
  const notApplicable =
    person.focus !== "standard"
      ? `Stay interviews wait while ${name} is in ${focusLabels[person.focus].toLowerCase()}. That time is for other conversations.`
      : tenureDays(person) < STAY_INTERVAL_DAYS
        ? `${name} has been here under six months. The first stay interview comes due ${STAY_INTERVAL_DAYS} days after the start date.`
        : null
  const questions = questionsFor("stay", ws.customQuestions)

  const drivers = ws.stayDrivers
    .filter((s) => s.personId === person.id)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
  const active = drivers.filter((s) => !s.validTo)
  const retired = drivers.filter((s) => s.validTo)
  const groups = kinds
    .map((kind) => ({ kind, items: active.filter((s) => s.kind === kind) }))
    .filter((g) => g.items.length > 0)

  const scheduleButton = (
    <Button
      size="sm"
      variant={
        untilDue !== null && untilDue <= 0 && !nextStay ? "default" : "outline"
      }
      onClick={() => setScheduling(true)}
    >
      <CalendarPlusIcon data-icon="inline-start" />
      Schedule stay interview
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Stay interview</CardTitle>
          <CardDescription>
            Every {STAY_INTERVAL_DAYS} days, kept apart from the review cycle.
          </CardDescription>
          <CardAction>{scheduleButton}</CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile
              label="Next due"
              value={due ? formatDay(due) : "Not applicable yet"}
              tone={untilDue !== null && untilDue <= 0 ? "warning" : undefined}
              hint={
                untilDue === null
                  ? notApplicable
                  : untilDue < 0
                    ? `Came due ${dayDistance(due!)}`
                    : untilDue === 0
                      ? "Due today"
                      : `Due ${dayDistance(due!)}`
              }
            />
            <MetricTile
              label="Last stay interview"
              value={
                lastStay ? formatDay(dayOf(lastStay.scheduledAt)) : "None yet"
              }
              hint={
                lastStay ? (
                  <SourceLink meetingId={lastStay.id} />
                ) : (
                  "No stay interview on the record"
                )
              }
            />
            <MetricTile
              label="Scheduled"
              value={nextStay ? formatDay(dayOf(nextStay.scheduledAt)) : "No"}
              hint={
                nextStay
                  ? formatWhen(nextStay.scheduledAt)
                  : "Nothing on the calendar in this workspace"
              }
            />
          </div>
          <History
            title="The stay questions"
            count={questions.length}
            defaultOpen
          >
            <ol className="flex flex-col gap-3">
              {questions.map((q, i) => (
                <li
                  key={q.id}
                  className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 text-sm"
                >
                  <span className="text-muted-foreground tabular-nums">
                    {i + 1}.
                  </span>
                  <div className="space-y-0.5">
                    <p className="leading-relaxed">{q.text}</p>
                    {q.purpose && (
                      <p className="text-xs text-muted-foreground">
                        {q.purpose}
                      </p>
                    )}
                    {q.followUp && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Follow up:
                        </span>{" "}
                        {q.followUp}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </History>
        </CardContent>
      </Card>

      <Section
        title="Stay drivers"
        count={active.length}
        description={`What keeps ${name} here and what could pull them away, as they told you.`}
        actions={
          <Button size="sm" onClick={() => setDriverOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Add driver
          </Button>
        }
      >
        {drivers.length === 0 ? (
          <EmptyState
            icon={<AnchorIcon />}
            title="No stay drivers yet"
            description={`Note what ${name} looks forward to, wants to learn and finds frustrating. A stay interview is the best source.`}
            action={
              <Button size="sm" onClick={() => setDriverOpen(true)}>
                Add driver
              </Button>
            }
          />
        ) : (
          <>
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No drivers in force. Everything recorded so far has been
                retired.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {groups.map((group) => (
                  <Card key={group.kind} size="sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <StateBadge
                          state={stayDriverLabels[group.kind]}
                          tone={kindTone[group.kind]}
                        />
                        <CountPill count={group.items.length} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="flex flex-col divide-y">
                        {group.items.map((s) => (
                          <DriverRow key={s.id} driver={s} />
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {retired.length > 0 && (
              <History title="No longer applies" count={retired.length}>
                <ul className="flex flex-col divide-y rounded-lg border px-3 py-1">
                  {retired.map((s) => (
                    <li key={s.id} className="flex flex-col gap-0.5 py-2">
                      <p className="text-sm text-muted-foreground">{s.text}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {stayDriverLabels[s.kind]}, held from{" "}
                        {validityRange(s.validFrom, s.validTo)}
                      </p>
                    </li>
                  ))}
                </ul>
              </History>
            )}
          </>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>How {name} likes to be recognized</CardTitle>
            <CardDescription>
              Shown in the feedback composer when you write to {name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="ret-recognition">
                  Recognition preference
                </FieldLabel>
                <NativeSelect
                  id="ret-recognition"
                  className="w-full"
                  value={person.recognitionPref}
                  onChange={(e) => {
                    const next = e.target.value as RecognitionPref
                    actions.updatePerson(person.id, { recognitionPref: next })
                    toast.success("Recognition preference updated", {
                      description: recognitionLabels[next],
                    })
                  }}
                >
                  {recognitionPrefs.map((r) => (
                    <NativeSelectOption key={r} value={r}>
                      {recognitionLabels[r]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="ret-style">Feedback style</FieldLabel>
                <Input
                  id="ret-style"
                  key={person.feedbackStyle ?? ""}
                  defaultValue={person.feedbackStyle ?? ""}
                  placeholder="Direct, in writing first, with time to think"
                  onBlur={(e) => {
                    const next = e.target.value.trim()
                    if (next === (person.feedbackStyle ?? "")) return
                    actions.updatePerson(person.id, {
                      feedbackStyle: next || undefined,
                    })
                    toast.success("Feedback style saved")
                  }}
                />
                <FieldDescription>
                  In their words. Saved when you leave the field.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Rapport notes
              <StateBadge state="Private" size="sm" />
            </CardTitle>
            <CardDescription>
              Yours alone. Never shared with {name} and never exported with a
              summary or a review draft.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field>
              <FieldLabel htmlFor="ret-rapport" className="sr-only">
                Rapport notes
              </FieldLabel>
              <Textarea
                id="ret-rapport"
                key={person.rapportNotes ?? ""}
                defaultValue={person.rapportNotes ?? ""}
                placeholder="Family, hobbies, what matters to them outside work"
                className="min-h-28"
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (next === (person.rapportNotes ?? "")) return
                  actions.updatePerson(person.id, {
                    rapportNotes: next || undefined,
                  })
                  toast.success("Rapport notes saved")
                }}
              />
              <FieldDescription>
                Saved when you leave the field.
              </FieldDescription>
            </Field>
          </CardContent>
        </Card>
      </div>

      <DriverDialog
        key={`d-${driverOpen}`}
        open={driverOpen}
        onOpenChange={setDriverOpen}
        person={person}
      />
      <ScheduleMeetingDialog
        open={scheduling}
        onOpenChange={setScheduling}
        personId={person.id}
        type="stay"
      />
    </div>
  )
}

function DriverRow({ driver: s }: { driver: StayDriver }) {
  return (
    <Row>
      <div className="min-w-0 space-y-1">
        <p className="text-sm leading-relaxed">{s.text}</p>
        {s.action && (
          <p className="rounded-md bg-muted/50 px-2 py-1 text-xs leading-relaxed">
            <Eyebrow as="span" className="mr-1.5">
              Stay action
            </Eyebrow>
            {s.action}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Recorded {formatDay(s.validFrom)}</span>
          <SourceLink meetingId={s.sourceMeetingId} />
        </div>
      </div>
      <Button
        size="xs"
        variant="ghost"
        className="shrink-0 self-start text-muted-foreground"
        aria-label={`No longer applies: ${s.text}`}
        onClick={() => {
          actions.retireStayDriver(s.id)
          toast.success("Stay driver moved to history")
        }}
      >
        No longer applies
      </Button>
    </Row>
  )
}

function DriverDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: Person
}) {
  const [kind, setKind] = React.useState<StayDriverKind>("energizer")
  const [text, setText] = React.useState("")
  const [action, setAction] = React.useState("")
  const name = firstName(person.name)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    actions.addStayDriver({ personId: person.id, kind, text, action })
    toast.success("Stay driver added", {
      description: stayDriverLabels[kind],
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Add a stay driver</DialogTitle>
            <DialogDescription>
              Something {name} told you about why they stay or what could make
              them leave.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="driver-kind">Kind</FieldLabel>
              <OptionSelect
                id="driver-kind"
                value={kind}
                onChange={setKind}
                options={kindOptions}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="driver-text">What they said</FieldLabel>
              <Textarea
                id="driver-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Hard problems with room to solve them their way"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="driver-action">Stay action</FieldLabel>
              <Input
                id="driver-action"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="What you will do about it"
              />
              <FieldDescription>
                Optional. The thing you committed to in response.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!text.trim()}>
              Add driver
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
