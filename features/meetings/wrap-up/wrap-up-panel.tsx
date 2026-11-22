"use client"

import * as React from "react"
import { CheckCircle2Icon, CircleCheckBigIcon } from "lucide-react"
import { toast } from "sonner"

import { Eyebrow } from "@/components/shared/eyebrow"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { firstName, formatDateTime, formatWhen, plural } from "@/lib/format"
import type { Meeting, Person } from "@/lib/types"
import { upcomingMeetings } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { isSensitive } from "@/lib/vantage/transcript"
import { analyze, reviewDrafts, type DraftDecisions } from "./analysis"
import {
  ConsentGate,
  ManualNotesCard,
  Retention,
  TranscriptInput,
} from "./capture"
import { CommitmentLock } from "./commitment-lock"
import { ConversationShape } from "./conversation-shape"
import { DraftReview } from "./draft-review"
import { SharedSummary } from "./shared-summary"

function Step({
  n,
  title,
  description,
  children,
}: {
  n: number
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card data-slot="wrap-up-step">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background tabular-nums"
          >
            {n}
          </span>
          <div className="min-w-0 space-y-0.5">
            <CardTitle>
              <h3>
                <span className="sr-only">Step {n}: </span>
                {title}
              </h3>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <Eyebrow as="h4">{children}</Eyebrow>
}

/**
 * The closing step of a 1:1: lock the commitments, review what a transcript
 * suggests, agree the shared summary and complete the conversation. Stays
 * usable on a completed 1:1, because the review is often finished later.
 */
export function WrapUpPanel({
  meeting: initial,
  person,
}: {
  meeting: Meeting
  person: Person
}) {
  const ws = workspace.use()
  const meeting = ws.meetings.find((m) => m.id === initial.id) ?? initial
  const name = firstName(person.name) || "They"
  const [decisions, setDecisions] = React.useState<DraftDecisions>({})
  const [replacing, setReplacing] = React.useState(false)

  const sensitivity = isSensitive(
    meeting.type,
    [
      ...meeting.agenda.flatMap((a) => [a.text, a.notes ?? ""]),
      meeting.sharedNotes,
    ].join("\n"),
    ws.settings.sensitiveKeywords
  )
  const granted = !!meeting.consent?.manager && !!meeting.consent.report
  const analysis = sensitivity.sensitive
    ? undefined
    : analyze(ws, meeting, person)
  const reviewed = analysis
    ? reviewDrafts(ws, meeting, analysis.drafts, decisions)
    : []
  const unreviewed = reviewed.filter((r) => r.status === "pending").length
  const summaryConfirmed = !!meeting.summary?.confirmedAt

  function decide(key: string, status: "accepted" | "discarded" | null) {
    setDecisions((prev) => {
      const next = { ...prev }
      if (status) next[key] = status
      else delete next[key]
      return next
    })
  }

  function complete() {
    const createdId = actions.completeMeeting(meeting.id)
    const after = workspace.get()
    const created = createdId
      ? after.meetings.find((m) => m.id === createdId)
      : undefined
    const next = created ?? upcomingMeetings(after, person.id)[0]
    toast.success(`1:1 with ${name} completed`, {
      description: created
        ? `The next 1:1 is scheduled in Vantage: ${formatWhen(created.scheduledAt)}.`
        : next
          ? `The next 1:1 is already planned: ${formatWhen(next.scheduledAt)}.`
          : "No next 1:1 was scheduled.",
    })
  }

  const showInput =
    granted && !meeting.transcript && (!meeting.stats || replacing)

  return (
    <div data-slot="wrap-up-panel" className="flex flex-col gap-4">
      <Step
        n={1}
        title="Commitment lock"
        description="Say out loud who will do what by when, and close what is finished."
      >
        <CommitmentLock meeting={meeting} person={person} name={name} />
      </Step>

      <Step
        n={2}
        title="Capture and analysis"
        description={
          sensitivity.sensitive
            ? "This conversation is documented by hand."
            : "Optional. A pasted transcript is analyzed on this device and turned into suggestions you review."
        }
      >
        {sensitivity.sensitive ? (
          <div className="flex flex-col gap-3">
            <ManualNotesCard
              name={name}
              reason={`${sensitivity.reason ?? "This is a sensitive conversation."} Transcript analysis is not offered for it.`}
            />
            <Retention meeting={meeting} settings={ws.settings} />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <ConsentGate
              meeting={meeting}
              name={name}
              ttlDays={ws.settings.transcriptTtlDays}
            />

            {meeting.consent && !granted && (
              <ManualNotesCard title="Continue with manual notes" name={name} />
            )}

            {showInput && (
              <TranscriptInput
                meeting={meeting}
                person={person}
                onDone={() => {
                  setReplacing(false)
                  setDecisions({})
                }}
              />
            )}

            {meeting.stats && (
              <section
                aria-label="Conversation shape"
                className="flex flex-col gap-3"
              >
                <SubHeading>Conversation shape</SubHeading>
                <ConversationShape stats={meeting.stats} name={name} />
              </section>
            )}

            {analysis && (
              <section
                aria-label="Drafts to review"
                className="flex flex-col gap-3"
              >
                <SubHeading>Drafts to review</SubHeading>
                {(analysis.unknownSpeakers.length > 0 ||
                  analysis.droppedLines > 0) && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {analysis.unknownSpeakers.length > 0 && (
                      <li>
                        {analysis.unknownSpeakers.length === 1
                          ? "One speaker label was not recognized"
                          : `${analysis.unknownSpeakers.length} speaker labels were not recognized`}{" "}
                        ({analysis.unknownSpeakers.join(", ")}). Their lines
                        were counted as {name}&apos;s.
                      </li>
                    )}
                    {analysis.droppedLines > 0 && (
                      <li>
                        {plural(analysis.droppedLines, "line")} between [paused]
                        and [resumed]{" "}
                        {analysis.droppedLines === 1 ? "was" : "were"} off the
                        record and left out.
                      </li>
                    )}
                  </ul>
                )}
                <DraftReview
                  reviewed={reviewed}
                  meeting={meeting}
                  person={person}
                  name={name}
                  onDecide={decide}
                />
              </section>
            )}

            {meeting.transcript ? (
              <section aria-label="Retention" className="flex flex-col gap-3">
                <SubHeading>Retention</SubHeading>
                <Retention meeting={meeting} settings={ws.settings} />
              </section>
            ) : (
              meeting.stats && (
                <div
                  data-slot="transcript-gone"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-3"
                >
                  <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                    The transcript text is gone. The notes you confirmed and the
                    conversation shape remain.
                  </p>
                  {granted && !replacing && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReplacing(true)}
                    >
                      Analyze another transcript
                    </Button>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </Step>

      <Step
        n={3}
        title="Shared summary"
        description="The one account of this conversation that both of you keep."
      >
        <SharedSummary meeting={meeting} person={person} name={name} />
      </Step>

      <Step
        n={4}
        title="Close"
        description={
          meeting.status === "completed"
            ? "This 1:1 is closed. Steps 1 to 3 stay open for later review."
            : "Complete the 1:1 when you are done. You can finish the review afterwards."
        }
      >
        {meeting.status === "completed" ? (
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2Icon
              aria-hidden
              className="size-4 text-success-text"
            />
            Completed{" "}
            {meeting.endedAt ? formatDateTime(meeting.endedAt) : "earlier"}
          </p>
        ) : meeting.status === "in-progress" ? (
          <div className="flex flex-col gap-3">
            {(unreviewed > 0 || !summaryConfirmed) && (
              <ul
                data-slot="close-reminders"
                className="list-disc space-y-1 pl-5 text-sm text-muted-foreground"
              >
                {unreviewed > 0 && (
                  <li>
                    {plural(unreviewed, "suggestion")} from the transcript{" "}
                    {unreviewed === 1 ? "is" : "are"} still waiting for your
                    review.
                  </li>
                )}
                {!summaryConfirmed && (
                  <li>The shared summary is not confirmed yet.</li>
                )}
                <li>
                  Neither stops you. Both stay available after the 1:1 is
                  completed.
                </li>
              </ul>
            )}
            <div>
              <Button type="button" onClick={complete}>
                <CircleCheckBigIcon />
                Complete 1:1
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {meeting.status === "cancelled"
              ? "This 1:1 was cancelled, so there is nothing to complete."
              : "Start the 1:1 to complete it from here."}
          </p>
        )}
      </Step>
    </div>
  )
}
