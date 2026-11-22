"use client"

import * as React from "react"
import { CheckIcon, LockIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import { ChartEmpty } from "@/components/charts/chart-primitives"
import { Eyebrow } from "@/components/shared/eyebrow"
import { MetricTile } from "@/components/shared/metric-tile"
import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { TALK_SHARE_MAX, TALK_SHARE_MIN } from "@/lib/constants"
import { firstName, formatDateTime } from "@/lib/format"
import type { Meeting, Person } from "@/lib/types"
import { completedMeetings } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { coachingFor, isSensitive } from "@/lib/vantage/transcript"
import { analyze, confirmedItems, shareState } from "./analysis"
import { ShapeTargetTiles } from "./conversation-shape"
import { TalkShareMeter } from "./talk-share-meter"
import { TalkShareTrend } from "./talk-share-trend"

const TREND_LENGTH = 6

/**
 * Private coaching for the manager on one conversation, built only from the
 * counts kept on the meeting. Never part of a shared summary or an export.
 */
export function CoachingCardPanel({
  meeting: initial,
  person,
}: {
  meeting: Meeting
  person: Person
}) {
  const ws = workspace.use()
  const uid = React.useId()
  const meeting = ws.meetings.find((m) => m.id === initial.id) ?? initial
  const name = firstName(person.name) || "They"
  const stats = meeting.stats
  const saved = ws.coachingCards.find((c) => c.meetingId === meeting.id)

  const header = (
    <CardHeader>
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle>
          <h3>Coaching card</h3>
        </CardTitle>
        <StateBadge state="Private" icon={<LockIcon />} />
      </div>
      <CardDescription>
        Only you see this. It is never shared, exported with a summary or shown
        to anyone else.
      </CardDescription>
    </CardHeader>
  )

  if (!stats) {
    const sensitive = isSensitive(
      meeting.type,
      [
        ...meeting.agenda.flatMap((a) => [a.text, a.notes ?? ""]),
        meeting.sharedNotes,
      ].join("\n"),
      ws.settings.sensitiveKeywords
    ).sensitive
    const why = sensitive
      ? "This conversation is documented by hand, so no transcript was analyzed."
      : meeting.consent && !(meeting.consent.manager && meeting.consent.report)
        ? "Capture is off for this conversation, so no transcript was analyzed."
        : "No transcript has been analyzed for this conversation."
    return (
      <Card data-slot="coaching-card" data-state="empty">
        {header}
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border border-dashed px-3 py-3 text-sm">
            <p className="font-medium">No coaching for this conversation</p>
            <p className="mt-1 text-muted-foreground">
              Coaching comes from the shape of a transcript: who spoke how much,
              how long your turns ran and what kind of questions you asked.{" "}
              {why} You can still reflect on it yourself.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-notes`} className="text-sm font-medium">
              What will you do differently next time?
            </label>
            <Textarea
              id={`${uid}-notes`}
              value={meeting.privateNotes}
              onChange={(e) =>
                actions.updateMeeting(meeting.id, {
                  privateNotes: e.target.value,
                })
              }
              placeholder={`For example: ask ${name} one open question and wait before adding anything.`}
              className="min-h-24"
              aria-describedby={`${uid}-notes-help`}
            />
            <p
              id={`${uid}-notes-help`}
              className="text-xs text-muted-foreground"
            >
              Without a transcript there is no card to attach a reflection to,
              so this field is the private notes of this conversation. It saves
              as you type and shows the same text wherever those notes appear.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const analysis = analyze(ws, meeting, person)
  const coaching = analysis
    ? coachingFor(stats, analysis.drafts)
    : saved
      ? { nudges: saved.nudges, strengths: saved.strengths }
      : coachingFor(stats, confirmedItems(ws, meeting))
  const upToDate =
    !!saved &&
    JSON.stringify([saved.stats, saved.nudges, saved.strengths]) ===
      JSON.stringify([stats, coaching.nudges, coaching.strengths])

  function save(reflection: string | undefined, announce: boolean) {
    if (!stats) return
    actions.saveCoachingCard({
      meetingId: meeting.id,
      personId: person.id,
      stats,
      nudges: coaching.nudges,
      strengths: coaching.strengths,
      reflection: reflection?.trim() ? reflection : undefined,
    })
    if (announce)
      toast.success("Coaching card saved", {
        description: "It stays private to you.",
      })
  }

  const trend = completedMeetings(ws, person.id)
    .filter((m) => m.stats)
    .slice(0, TREND_LENGTH)
    .reverse()
  const share = shareState(stats.reportShare)

  return (
    <Card data-slot="coaching-card" data-state="ready">
      {header}
      <CardContent className="flex flex-col gap-5">
        <TalkShareMeter share={stats.reportShare} name={name} compact />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MetricTile
            label="Their share"
            value={stats.reportShare}
            unit="%"
            tone={share === "in" ? undefined : "warning"}
            hint={`Target ${TALK_SHARE_MIN} to ${TALK_SHARE_MAX}%`}
          />
          <ShapeTargetTiles stats={stats} />
        </div>

        <section aria-label="What went well" className="flex flex-col gap-2">
          <Eyebrow as="h4">What went well</Eyebrow>
          {coaching.strengths.length ? (
            <ul className="flex flex-col gap-1.5">
              {coaching.strengths.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm">
                  <CheckIcon
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-success-text"
                  />
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing stood out in the counts this time. The points below are
              where to start.
            </p>
          )}
        </section>

        <section aria-label="To try next time" className="flex flex-col gap-2">
          <Eyebrow as="h4">To try next time</Eyebrow>
          {coaching.nudges.length ? (
            <ul className="flex flex-col gap-2">
              {coaching.nudges.map((n) => (
                <li
                  key={n.title}
                  className="rounded-lg border bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    <Badge variant="outline">{n.framework}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No suggestions: the shape of this conversation met every target.
            </p>
          )}
          {!analysis && saved && (
            <p className="text-xs text-muted-foreground">
              Shown as saved on {formatDateTime(saved.createdAt)}. The
              transcript text has been deleted since.
            </p>
          )}
          {!analysis && !saved && (
            <p className="text-xs text-muted-foreground">
              The transcript text is gone and no card was saved, so these points
              use the counts and the records confirmed from this conversation.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-reflection`} className="text-sm font-medium">
            What will you do differently next time?
          </label>
          <Textarea
            id={`${uid}-reflection`}
            value={saved?.reflection ?? ""}
            onChange={(e) => save(e.target.value, false)}
            placeholder="One thing, small enough to do in the next 1:1."
            className="min-h-20"
            aria-describedby={`${uid}-reflection-help`}
          />
          <p
            id={`${uid}-reflection-help`}
            className="text-xs text-muted-foreground"
          >
            Your reflection is part of the card. Typing here saves the card.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant={upToDate ? "outline" : "default"}
            disabled={upToDate}
            onClick={() => save(saved?.reflection, true)}
          >
            {upToDate ? <CheckIcon /> : <SaveIcon />}
            {upToDate
              ? "Saved"
              : saved
                ? "Update saved card"
                : "Save coaching card"}
          </Button>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {saved
              ? `Last saved ${formatDateTime(saved.createdAt)}.`
              : "Not saved yet. A saved card keeps these points after the transcript text is deleted."}
          </p>
        </div>

        <section
          aria-label="Listening trend"
          className="flex flex-col gap-2 border-t pt-4"
        >
          <Eyebrow as="h4">
            {name}&apos;s share over the last {TREND_LENGTH} conversations
          </Eyebrow>
          {ws.settings.worksCouncilMode ? (
            <p
              data-slot="trend-hidden"
              className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground"
            >
              The trend for one person is hidden because works council mode is
              on. It shows team totals only and can be changed in the trust
              settings.
            </p>
          ) : trend.length >= 2 ? (
            <TalkShareTrend
              meetings={trend}
              name={name}
              currentId={meeting.id}
            />
          ) : (
            <ChartEmpty
              height={120}
              title="Not enough conversations yet"
              description={`A trend appears once two completed 1:1s with ${name} have an analyzed transcript.`}
            />
          )}
        </section>
      </CardContent>
    </Card>
  )
}
