"use client"

import * as React from "react"
import {
  ChevronRightIcon,
  FileTextIcon,
  NotebookPenIcon,
  ShieldOffIcon,
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime, formatDayLong, plural } from "@/lib/format"
import { daysUntil } from "@/lib/time"
import type { Meeting, Person, Settings } from "@/lib/types"
import { actions, workspace } from "@/lib/vantage/store"
import { parseTranscript, sampleTranscript } from "@/lib/vantage/transcript"

/** Shown instead of every transcript control when a conversation is sensitive. */
export function ManualNotesCard({
  title = "Manual notes",
  reason,
  name,
}: {
  title?: string
  reason?: string
  name: string
}) {
  return (
    <div
      data-slot="manual-notes"
      className="flex gap-3 rounded-lg border bg-muted/30 px-3 py-3"
    >
      <NotebookPenIcon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="min-w-0 space-y-1.5 text-sm">
        <p className="font-medium">{title}</p>
        {reason && <p className="text-muted-foreground">{reason}</p>}
        <p className="text-muted-foreground">
          Write down the agreed support right after the conversation, while it
          is fresh. Anchor each note on what you observed, the date and the
          impact it had. Leave out guesses about motive or character, and share
          the summary in step 3 so {name} can correct it.
        </p>
      </div>
    </div>
  )
}

/**
 * Capture stays off until both people agree. The answer is logged either
 * way, and it can be changed for as long as no transcript is stored.
 */
export function ConsentGate({
  meeting,
  name,
  ttlDays,
}: {
  meeting: Meeting
  name: string
  ttlDays: number
}) {
  const uid = React.useId()
  const consent = meeting.consent
  const [editing, setEditing] = React.useState(false)
  const [manager, setManager] = React.useState(consent?.manager ?? false)
  const [report, setReport] = React.useState(consent?.report ?? false)
  const granted = !!consent?.manager && !!consent.report

  function record() {
    actions.recordConsent(meeting.id, manager, report)
    setEditing(false)
    if (manager && report)
      toast.success("Decision recorded: both agreed", {
        description: "You can add a transcript now.",
      })
    else
      toast("Decision recorded: capture is off", {
        description: "Continue with manual notes.",
      })
  }

  if (consent && !editing) {
    const declinedBy =
      !consent.manager && !consent.report
        ? `Neither of you agreed`
        : !consent.manager
          ? "You did not agree"
          : `${name} did not agree`
    return (
      <div
        data-slot="consent-decision"
        className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-3"
      >
        <div className="flex min-w-0 gap-3">
          {!granted && (
            <ShieldOffIcon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
          )}
          <div className="min-w-0 space-y-1 text-sm">
            <p className="font-medium">
              {granted
                ? `You and ${name} both agreed to transcript analysis`
                : "Capture is off for this conversation"}
            </p>
            <p className="text-muted-foreground">
              {granted
                ? `Decision recorded ${formatDateTime(consent.at)}.`
                : `${declinedBy}, so no transcript is analyzed. Decision recorded ${formatDateTime(consent.at)}. Continue with manual notes.`}
            </p>
          </div>
        </div>
        {!meeting.transcript && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setManager(consent.manager)
              setReport(consent.report)
              setEditing(true)
            }}
          >
            Change decision
          </Button>
        )}
      </div>
    )
  }

  return (
    <div
      data-slot="consent-gate"
      className="flex flex-col gap-3 rounded-lg border px-3 py-3"
    >
      <div className="space-y-1.5 text-sm">
        <p className="font-medium">Do you both agree to transcript analysis?</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            The text you paste is analyzed on this device. Nothing is uploaded.
          </li>
          <li>
            It is reduced to notes you approve, and the text is deleted after{" "}
            {plural(ttlDays, "day")}.
          </li>
          <li>No audio is involved at any point.</li>
          <li>
            Either of you can decline. Capture stays off unless both boxes are
            ticked.
          </li>
        </ul>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start gap-2.5">
          <Checkbox
            id={`${uid}-manager`}
            className="mt-0.5"
            checked={manager}
            onCheckedChange={(v) => setManager(v === true)}
            aria-labelledby={`${uid}-manager-label`}
          />
          <label
            id={`${uid}-manager-label`}
            htmlFor={`${uid}-manager`}
            className="text-sm leading-snug"
          >
            I agree to analyze a transcript of this conversation
          </label>
        </div>
        <div className="flex items-start gap-2.5">
          <Checkbox
            id={`${uid}-report`}
            className="mt-0.5"
            checked={report}
            onCheckedChange={(v) => setReport(v === true)}
            aria-labelledby={`${uid}-report-label`}
          />
          <label
            id={`${uid}-report-label`}
            htmlFor={`${uid}-report`}
            className="text-sm leading-snug"
          >
            {name} has agreed
          </label>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={record}>
          Record decision
        </Button>
        {editing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Cancel
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          {manager && report
            ? "Both agreed: the transcript field opens next."
            : "As ticked now, this records that capture is off."}{" "}
          The decision is added to the consent log either way.
        </p>
      </div>
    </div>
  )
}

/**
 * WebVTT files carry a header, cue numbers and timing lines that are not
 * speech. Strip them and turn `<v Name>` voice tags into "Name: text" lines.
 * Cue times are dropped on purpose: without them, consecutive lines by the
 * same speaker are joined into one turn.
 */
export function vttToLines(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/^WEBVTT\b/i.test(line) &&
        !line.includes("-->") &&
        !/^\d+$/.test(line) &&
        !/^(NOTE|STYLE|REGION)\b/.test(line)
    )
    .map((line) =>
      line
        .replace(/^<v(?:\.[^\s>]+)?\s+([^>]+)>\s*/i, "$1: ")
        .replace(/<\/?[^>]+>/g, "")
    )
    .join("\n")
}

/** Paste, load or pick a transcript, then analyze it on this device. */
export function TranscriptInput({
  meeting,
  person,
  onDone,
}: {
  meeting: Meeting
  person: Person
  onDone?: () => void
}) {
  const ws = workspace.use()
  const uid = React.useId()
  const [text, setText] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  function readFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : ""
      const isVtt = /\.vtt$/i.test(file.name) || /^\s*WEBVTT\b/.test(raw)
      setText(isVtt ? vttToLines(raw) : raw)
      setError(null)
    }
    reader.onerror = () =>
      setError("That file could not be read. Paste the text instead.")
    reader.readAsText(file)
  }

  function analyzeText() {
    const { turns } = parseTranscript(text, ws.manager.name, person.name)
    if (!turns.length) {
      setError(
        `No speaker lines were found. Each line needs a name, a colon and the words, such as "${person.name.split(" ")[0]}: The rollout is on track."`
      )
      return
    }
    if (!actions.attachTranscript(meeting.id, text)) {
      setError("Capture is off until both of you agree.")
      return
    }
    setText("")
    setError(null)
    toast.success("Transcript analyzed on this device", {
      description: "Review the suggestions before anything is recorded.",
    })
    onDone?.()
  }

  return (
    <div data-slot="transcript-input" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-text`} className="text-sm font-medium">
          Transcript
        </label>
        <Textarea
          id={`${uid}-text`}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          placeholder={`[00:00] ${ws.manager.name.split(" ")[0] || "Manager"}: What is top of mind?\n[00:08] ${person.name.split(" ")[0]}: The migration.`}
          className="max-h-72 min-h-32 font-mono text-xs md:text-xs"
          aria-describedby={`${uid}-help`}
          aria-invalid={error ? true : undefined}
        />
        <p id={`${uid}-help`} className="text-xs text-muted-foreground">
          One &ldquo;Name: text&rdquo; line per turn. A [mm:ss] stamp at the
          start of a line is optional. Lines between [paused] and [resumed] are
          off the record and are dropped before anything is counted.
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`${uid}-file`} className="text-xs font-medium">
            Or choose a .txt or .vtt file
          </label>
          <Input
            id={`${uid}-file`}
            type="file"
            accept=".txt,.vtt,text/plain,text/vtt"
            onChange={readFile}
            className="max-w-64"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setText(sampleTranscript(ws.manager.name, person.name))
            setError(null)
          }}
        >
          <FileTextIcon />
          Load an example
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!text.trim()}
          onClick={analyzeText}
        >
          Analyze
        </Button>
      </div>
    </div>
  )
}

/** The countdown to deletion, the delete action and a viewer of the raw text. */
export function Retention({
  meeting,
  settings,
}: {
  meeting: Meeting
  settings: Pick<Settings, "legalHold">
}) {
  const [confirming, setConfirming] = React.useState(false)
  const transcript = meeting.transcript
  if (!transcript) return null
  const left = daysUntil(transcript.expiresOn)
  const when = settings.legalHold
    ? "Kept: legal hold is on. The transcript text is not deleted while the hold is in force."
    : left > 0
      ? `Transcript text will be deleted on ${formatDayLong(transcript.expiresOn)} (in ${plural(left, "day")}).`
      : left === 0
        ? `Transcript text will be deleted today, ${formatDayLong(transcript.expiresOn)}.`
        : "Transcript text is past its deletion day and is removed the next time the workspace loads."

  return (
    <div
      data-slot="retention"
      className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm">{when}</p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          <Trash2Icon />
          Delete transcript now
        </Button>
      </div>
      <Collapsible>
        <CollapsibleTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="group/viewer -ml-1.5 text-muted-foreground"
            />
          }
        >
          <ChevronRightIcon className="transition-transform group-data-[panel-open]/viewer:rotate-90" />
          View the transcript text
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 max-h-72 overflow-auto rounded-md border bg-card p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {transcript.text}
          </pre>
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the transcript text?</AlertDialogTitle>
            <AlertDialogDescription>
              The text is removed from this device and cannot be brought back.
              Suggestions you have not accepted yet go with it. Records you
              confirmed and the conversation shape stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                actions.purgeTranscript(meeting.id)
                setConfirming(false)
                toast.success("Transcript text deleted", {
                  description:
                    "Confirmed notes and the conversation shape remain.",
                })
              }}
            >
              Delete transcript
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
