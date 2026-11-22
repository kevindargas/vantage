"use client"

import * as React from "react"
import { cn } from "cn"
import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  FlagIcon,
  HandshakeIcon,
  MessageSquareHeartIcon,
  PlusIcon,
  ShieldOffIcon,
} from "lucide-react"
import { toast } from "sonner"

import { RecordLayout } from "@/components/record/record-layout"
import { RecordSection } from "@/components/record/record-section"
import { Eyebrow } from "@/components/shared/eyebrow"
import { Section } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { CommitmentDialog } from "@/features/shared/commitment-dialog"
import { FeedbackComposer } from "@/features/shared/feedback-composer"
import { PulseScale } from "@/features/shared/pulse-scale"
import {
  meetingTypeDescriptions,
  meetingTypeLabels,
  pulseEnergyLabels,
  pulseWorkloadLabels,
  runbookPhases,
} from "@/lib/constants"
import { firstName, formatMinutes, formatSeconds } from "@/lib/format"
import { now, parseDay } from "@/lib/time"
import type { AgendaOwner, Meeting, Person } from "@/lib/types"
import { actions, workspace } from "@/lib/vantage/store"
import { BlockerDialog } from "./meeting-dialogs"
import { CarriedList, DraftTextarea, PrivateBadge, useNow } from "./parts"
import { WrapUpPanel } from "./wrap-up/wrap-up-panel"

type Capture = "commitment" | "blocker" | "feedback"

/**
 * During the conversation. Large type and few controls, so the manager can
 * look at the person instead of the screen.
 */
export function LiveView({
  meeting,
  person,
  initialWrap = false,
}: {
  meeting: Meeting
  person: Person
  /** Open the wrap-up panel straight away (`?tab=wrap-up`). */
  initialWrap?: boolean
}) {
  const nowMs = useNow()
  const [offSince, setOffSince] = React.useState<number | null>(null)
  const [lastCheckAt, setLastCheckAt] = React.useState<number | null>(null)
  const [capture, setCapture] = React.useState<Capture | null>(null)
  const [wrapping, setWrapping] = React.useState(initialWrap)
  const wrapRef = React.useRef<HTMLDivElement>(null)

  const name = firstName(person.name)
  const offRecord = offSince !== null
  const startMs = parseDay(meeting.startedAt ?? meeting.scheduledAt).getTime()
  const elapsedSec = Math.max(0, (nowMs - startMs) / 1000)
  const totalSec = meeting.durationMin * 60

  // The first unchecked item is the one being talked about. It has been open
  // since the last check-off, or since the start when nothing is checked yet.
  const current = meeting.agenda.find((a) => !a.done)
  const openSince =
    lastCheckAt ?? (meeting.agenda.some((a) => a.done) ? null : startMs)
  const timeCheck =
    current && openSince !== null && nowMs - openSince > (totalSec * 1000) / 2
      ? current.text
      : null

  function toggleOffRecord(on: boolean) {
    const at = now().getTime()
    if (on) {
      setOffSince(at)
      return
    }
    if (offSince !== null) {
      const minutes = Math.ceil((at - offSince) / 60_000)
      if (minutes > 0)
        actions.updateMeeting(meeting.id, {
          pausedMinutes: (meeting.pausedMinutes ?? 0) + minutes,
        })
    }
    setOffSince(null)
  }

  function wrapUp() {
    setWrapping(true)
    window.requestAnimationFrame(() =>
      wrapRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Runbook
        meeting={meeting}
        elapsedSec={elapsedSec}
        totalSec={totalSec}
        timeCheck={timeCheck}
      />

      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
          offRecord ? "border-warning/40 bg-warning/10" : "bg-card"
        )}
      >
        <div className="flex items-start gap-3">
          <ShieldOffIcon
            aria-hidden
            className={cn(
              "mt-0.5 size-5 shrink-0",
              offRecord ? "text-warning-text" : "text-muted-foreground"
            )}
          />
          <div className="grid gap-0.5">
            {offRecord ? (
              <p role="status" className="text-base font-medium">
                Off the record. Nothing typed or pasted for this stretch is
                kept.
              </p>
            ) : (
              <p className="text-sm font-medium">Off the record</p>
            )}
            <p className="text-xs text-muted-foreground">
              {offRecord
                ? "The notes fields are locked until you switch this off."
                : `Either of you can ask for it. While it is on, the notes fields are locked.${
                    meeting.pausedMinutes
                      ? ` Off the record so far: ${formatMinutes(meeting.pausedMinutes)}.`
                      : ""
                  }`}
            </p>
          </div>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
          <Switch
            checked={offRecord}
            onCheckedChange={toggleOffRecord}
            aria-label="Off the record"
          />
          {offRecord ? "On" : "Off"}
        </label>
      </div>

      <RecordLayout
        aside={
          <>
            <RecordSection
              title="Carried over"
              size="sm"
              description="Check off what is done."
            >
              <CarriedList meeting={meeting} person={person} />
            </RecordSection>

            <RecordSection title="Capture" size="sm">
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => setCapture("commitment")}
                >
                  <HandshakeIcon /> Add commitment
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => setCapture("blocker")}
                >
                  <FlagIcon /> Log blocker
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => setCapture("feedback")}
                >
                  <MessageSquareHeartIcon /> Write feedback
                </Button>
              </div>
            </RecordSection>

            <PulseCard meeting={meeting} person={person} />
          </>
        }
      >
        <LiveAgenda
          meeting={meeting}
          person={person}
          locked={offRecord}
          onCheck={() => setLastCheckAt(now().getTime())}
        />
        <LiveNotes meeting={meeting} locked={offRecord} />
      </RecordLayout>

      <div ref={wrapRef} className="scroll-mt-28">
        {wrapping ? (
          <Section
            title="Wrap up"
            description="Recap the commitments, confirm the summary and close the 1:1."
          >
            <WrapUpPanel meeting={meeting} person={person} />
          </Section>
        ) : (
          <div className="flex flex-col items-start gap-2 rounded-xl border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              When the conversation is done, wrap up with {name}: recap who owes
              what, then close the 1:1.
            </p>
            <Button size="lg" onClick={wrapUp}>
              <CheckIcon /> Wrap up
            </Button>
          </div>
        )}
      </div>

      <CommitmentDialog
        open={capture === "commitment"}
        onOpenChange={(open) => setCapture(open ? "commitment" : null)}
        personId={person.id}
        sourceMeetingId={meeting.id}
      />
      <BlockerDialog
        open={capture === "blocker"}
        onOpenChange={(open) => setCapture(open ? "blocker" : null)}
        meeting={meeting}
        person={person}
      />
      {capture === "feedback" && (
        <FeedbackComposer
          open
          onOpenChange={(open) => setCapture(open ? "feedback" : null)}
          personId={person.id}
          sourceMeetingId={meeting.id}
        />
      )}
    </div>
  )
}

/* ----------------------------------------------------------------- runbook */

function Runbook({
  meeting,
  elapsedSec,
  totalSec,
  timeCheck,
}: {
  meeting: Meeting
  elapsedSec: number
  totalSec: number
  timeCheck: string | null
}) {
  const weekly = meeting.type === "weekly"
  const over = elapsedSec >= totalSec
  const phases = runbookPhases.map((p, i) => {
    const start =
      runbookPhases.slice(0, i).reduce((sum, q) => sum + q.share, 0) * totalSec
    return { ...p, start, end: start + p.share * totalSec }
  })
  const segments = weekly
    ? phases
    : [{ id: "all", share: 1, start: 0, end: totalSec }]
  const index = phases.findIndex((p) => elapsedSec < p.end)
  const phase = index === -1 ? undefined : phases[index]
  const next = index === -1 ? undefined : phases[index + 1]

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <Eyebrow>
              {over
                ? "Past the planned time"
                : weekly && phase
                  ? `Part ${index + 1} of ${phases.length}`
                  : meetingTypeLabels[meeting.type]}
            </Eyebrow>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance md:text-3xl">
              {over
                ? "Time is up"
                : weekly && phase
                  ? phase.title
                  : meetingTypeLabels[meeting.type]}
            </h2>
          </div>
          <p
            role="timer"
            aria-label="Elapsed time"
            className={cn(
              "text-2xl font-semibold tabular-nums md:text-3xl",
              over && "text-warning-text"
            )}
          >
            {formatSeconds(elapsedSec)}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              of {formatMinutes(meeting.durationMin)}
            </span>
          </p>
        </div>

        <div
          role="progressbar"
          aria-label="Time used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(
            100,
            Math.round((elapsedSec / totalSec) * 100)
          )}
          className="flex h-2.5 gap-1"
        >
          {segments.map((s) => {
            const fill = Math.min(
              1,
              Math.max(0, (elapsedSec - s.start) / (s.end - s.start))
            )
            return (
              <div
                key={s.id}
                style={{ flexGrow: s.share }}
                className="h-full basis-0 overflow-hidden rounded-full bg-muted"
              >
                <div
                  style={{ width: `${fill * 100}%` }}
                  className={cn(
                    "h-full rounded-full transition-[width] duration-1000 ease-linear",
                    over ? "bg-warning" : "bg-brand"
                  )}
                />
              </div>
            )
          })}
        </div>

        <div className="grid gap-2">
          <p className="max-w-3xl text-base leading-relaxed md:text-lg">
            {over
              ? "Recap what each of you committed to, thank them and wrap up when you are ready. Nothing ends by itself."
              : weekly && phase
                ? phase.guidance
                : meetingTypeDescriptions[meeting.type]}
          </p>
          {weekly && !over && (
            <p className="text-sm text-muted-foreground">
              {next
                ? `Next: ${next.title.toLowerCase()}, from ${formatMinutes(next.start / 60)}.`
                : "This is the last part. End on time."}
            </p>
          )}
          {timeCheck && !over && (
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
              Time check: &quot;{timeCheck}&quot; has been open for more than
              half the time. Ask whether to stay with it or move on.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ agenda */

function LiveAgenda({
  meeting,
  person,
  locked,
  onCheck,
}: {
  meeting: Meeting
  person: Person
  locked: boolean
  onCheck: () => void
}) {
  const [text, setText] = React.useState("")
  const [owner, setOwner] = React.useState<AgendaOwner>("report")
  const name = firstName(person.name)
  const items = [
    ...meeting.agenda.filter((a) => a.owner === "report"),
    ...meeting.agenda.filter((a) => a.owner === "manager"),
  ]

  function add(e: React.FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    actions.addAgendaItem(meeting.id, { text: value, owner })
    setText("")
  }

  return (
    <RecordSection
      title="Agenda"
      count={items.length}
      description={`${name}'s items first, then yours.`}
      contentClassName="flex flex-col gap-4"
    >
      {items.length ? (
        <ul className="flex flex-col divide-y">
          {items.map((item) => {
            const fieldId = `live-item-${item.id}`
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Checkbox
                  id={fieldId}
                  checked={item.done}
                  onCheckedChange={(checked) => {
                    actions.updateAgendaItem(meeting.id, item.id, {
                      done: !!checked,
                    })
                    if (checked) onCheck()
                  }}
                  className="mt-1 size-5"
                />
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <label
                    htmlFor={fieldId}
                    className={cn(
                      "cursor-pointer text-lg leading-snug",
                      item.done && "text-muted-foreground line-through"
                    )}
                  >
                    {item.text}
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {item.owner === "report" ? name : "You"}
                  </span>
                  <DraftTextarea
                    value={item.notes ?? ""}
                    onCommit={(notes) =>
                      actions.updateAgendaItem(meeting.id, item.id, { notes })
                    }
                    disabled={locked}
                    aria-label={`Notes on "${item.text}"`}
                    placeholder="Notes on this item"
                    className="min-h-9 text-sm"
                    rows={1}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-base text-muted-foreground">
          The agenda is empty. Start with: what is the number one thing you want
          to talk about?
        </p>
      )}
      <form
        onSubmit={add}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Add an agenda item"
          placeholder="Add an item that just came up"
          className="min-w-0 flex-1"
        />
        <div className="flex items-center gap-2">
          <NativeSelect
            aria-label="Whose item"
            value={owner}
            onChange={(e) => setOwner(e.target.value as AgendaOwner)}
          >
            <NativeSelectOption value="report">
              {name}&apos;s item
            </NativeSelectOption>
            <NativeSelectOption value="manager">Your item</NativeSelectOption>
          </NativeSelect>
          <Button type="submit" variant="outline" disabled={!text.trim()}>
            <PlusIcon /> Add
          </Button>
        </div>
      </form>
    </RecordSection>
  )
}

/* ------------------------------------------------------------------- notes */

function LiveNotes({ meeting, locked }: { meeting: Meeting; locked: boolean }) {
  const [showPrivate, setShowPrivate] = React.useState(true)
  return (
    <RecordSection title="Notes" contentClassName="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="live-shared-notes" className="text-sm font-medium">
          Shared notes
        </label>
        <p className="text-xs text-muted-foreground">
          Both of you see these. They are part of the shared summary.
        </p>
        <DraftTextarea
          id="live-shared-notes"
          value={meeting.sharedNotes}
          onCommit={(sharedNotes) =>
            actions.updateMeeting(meeting.id, { sharedNotes })
          }
          disabled={locked}
          placeholder="Decisions, context, what was said"
          className="min-h-28"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor="live-private-notes" className="text-sm font-medium">
              Private scratchpad
            </label>
            <PrivateBadge />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={showPrivate}
            aria-controls="live-private-panel"
            onClick={() => setShowPrivate((v) => !v)}
          >
            {showPrivate ? (
              <>
                <EyeOffIcon /> Hide
              </>
            ) : (
              <>
                <EyeIcon /> Show
              </>
            )}
          </Button>
        </div>
        <div id="live-private-panel">
          {showPrivate ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">
                Only you see this. It never appears in a shared summary. Hide it
                before you share your screen.
              </p>
              <DraftTextarea
                id="live-private-notes"
                value={meeting.privateNotes}
                onCommit={(privateNotes) =>
                  actions.updateMeeting(meeting.id, { privateNotes })
                }
                disabled={locked}
                placeholder="Your own observations and reminders"
                className="min-h-20"
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Hidden. What you wrote is kept.
            </p>
          )}
        </div>
      </div>
    </RecordSection>
  )
}

/* ------------------------------------------------------------------- pulse */

function PulseCard({ meeting, person }: { meeting: Meeting; person: Person }) {
  const ws = workspace.use()
  const [energy, setEnergy] = React.useState<number | null>(null)
  const [workload, setWorkload] = React.useState<number | null>(null)
  const logged = ws.pulses.find((p) => p.sourceMeetingId === meeting.id)
  const name = firstName(person.name)

  function log() {
    if (energy === null || workload === null) return
    actions.logPulse({
      personId: person.id,
      energy,
      workload,
      sourceMeetingId: meeting.id,
    })
    toast.success("Pulse logged", {
      description: `Energy ${energy}, workload ${workload}, as ${name} reported them.`,
    })
    setEnergy(null)
    setWorkload(null)
  }

  return (
    <RecordSection
      title="Pulse"
      size="sm"
      description={`Voluntary. Ask ${name} for a 1 to 5 read and log what they say. Skip it if they prefer.`}
    >
      {logged ? (
        <div className="flex flex-col gap-1 text-sm">
          <p className="inline-flex items-center gap-1.5 font-medium text-success-text">
            <CheckIcon className="size-4" /> Logged
          </p>
          <p className="text-muted-foreground">
            Energy {logged.energy} ({pulseEnergyLabels[logged.energy - 1]}),
            workload {logged.workload} (
            {pulseWorkloadLabels[logged.workload - 1]})
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <PulseScale
            legend="Energy"
            name={`pulse-energy-${meeting.id}`}
            labels={pulseEnergyLabels}
            value={energy}
            onChange={setEnergy}
          />
          <PulseScale
            legend="Workload"
            name={`pulse-workload-${meeting.id}`}
            labels={pulseWorkloadLabels}
            value={workload}
            onChange={setWorkload}
          />
          <Button
            variant="outline"
            disabled={energy === null || workload === null}
            onClick={log}
          >
            Log pulse
          </Button>
        </div>
      )}
    </RecordSection>
  )
}
