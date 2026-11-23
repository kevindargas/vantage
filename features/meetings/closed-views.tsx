"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CheckIcon,
  ChevronDownIcon,
  LockIcon,
} from "lucide-react"

import { RecordLayout } from "@/components/record/record-layout"
import { RecordSection } from "@/components/record/record-section"
import { EmptyState } from "@/components/shared/empty-state"
import { Section } from "@/components/shared/page-header"
import { StateBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  CANCEL_DRIFT_WINDOW_DAYS,
  meetingTypeLabels,
  pulseEnergyLabels,
  pulseWorkloadLabels,
} from "@/lib/constants"
import {
  firstName,
  formatDateTime,
  formatDay,
  formatMinutes,
  formatWhen,
  plural,
} from "@/lib/format"
import type { Meeting, Person } from "@/lib/types"
import { cadenceHealth, nextScheduled } from "@/lib/vantage/cadence"
import { isOverdue } from "@/lib/vantage/selectors"
import { workspace } from "@/lib/vantage/store"
import { PrivateBadge } from "./parts"
import { CoachingCardPanel } from "./wrap-up/coaching-card-panel"
import { WrapUpPanel } from "./wrap-up/wrap-up-panel"

/* --------------------------------------------------------------- completed */

/** The record of a held 1:1. Read only, apart from the wrap-up panels. */
export function CompletedView({
  meeting,
  person,
}: {
  meeting: Meeting
  person: Person
}) {
  const ws = workspace.use()
  const [showPrivate, setShowPrivate] = React.useState(false)
  const name = firstName(person.name)
  const items = [
    ...meeting.agenda.filter((a) => a.owner === "report"),
    ...meeting.agenda.filter((a) => a.owner === "manager"),
  ]
  const made = ws.commitments.filter((c) => c.sourceMeetingId === meeting.id)
  const pulse = ws.pulses.find((p) => p.sourceMeetingId === meeting.id)
  const next = nextScheduled(ws.meetings, person.id)

  return (
    <div className="flex flex-col gap-6">
      {next && (
        <Link
          href={`/meetings/session?id=${next.id}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2">
            <CalendarClockIcon
              aria-hidden
              className="size-4 text-muted-foreground"
            />
            <span>
              Next 1:1 with {name}:{" "}
              <span className="font-medium">
                {formatWhen(next.scheduledAt)}
              </span>
              <span className="text-muted-foreground">
                , {meetingTypeLabels[next.type].toLowerCase()}
              </span>
            </span>
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            Prepare <ArrowRightIcon className="size-3.5" />
          </span>
        </Link>
      )}

      <RecordLayout
        aside={
          <>
            <RecordSection title="Pulse" size="sm">
              {pulse ? (
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Energy</dt>
                    <dd>
                      {pulse.energy} of 5, {pulseEnergyLabels[pulse.energy - 1]}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Workload</dt>
                    <dd>
                      {pulse.workload} of 5,{" "}
                      {pulseWorkloadLabels[pulse.workload - 1]}
                    </dd>
                  </div>
                  {pulse.note && (
                    <p className="leading-relaxed text-muted-foreground">
                      {pulse.note}
                    </p>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No pulse was logged in this 1:1. It is voluntary.
                </p>
              )}
            </RecordSection>

            <RecordSection title="Details" size="sm">
              <dl className="flex flex-col gap-2 text-sm">
                {meeting.startedAt && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Started</dt>
                    <dd>{formatDateTime(meeting.startedAt)}</dd>
                  </div>
                )}
                {meeting.endedAt && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Closed</dt>
                    <dd>{formatDateTime(meeting.endedAt)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Off the record</dt>
                  <dd>
                    {meeting.pausedMinutes
                      ? formatMinutes(meeting.pausedMinutes)
                      : "None"}
                  </dd>
                </div>
                {meeting.rescheduledFrom && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Moved from</dt>
                    <dd>{formatDay(meeting.rescheduledFrom)}</dd>
                  </div>
                )}
              </dl>
            </RecordSection>
          </>
        }
      >
        <RecordSection title="Agenda" count={items.length}>
          {items.length ? (
            <ul className="flex flex-col divide-y">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                      item.done
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-input"
                    )}
                  >
                    {item.done && <CheckIcon className="size-3" />}
                    <span className="sr-only">
                      {item.done ? "Covered" : "Not covered"}
                    </span>
                  </span>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className="text-sm leading-snug">{item.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.owner === "report" ? name : "You"}
                      {item.done ? "" : ", not covered"}
                    </p>
                    {item.notes?.trim() && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {item.notes.trim()}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              size="sm"
              bare
              title="No agenda"
              description="This 1:1 was held without agenda items."
            />
          )}
        </RecordSection>

        <RecordSection
          title="Shared notes"
          description="Both of you see these."
        >
          {meeting.sharedNotes.trim() ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {meeting.sharedNotes.trim()}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No shared notes were taken.
            </p>
          )}
        </RecordSection>

        <RecordSection
          title="Commitments made"
          count={made.length}
          description="What each of you took away from this conversation."
        >
          {made.length ? (
            <ul className="flex flex-col divide-y">
              {made.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0"
                >
                  <p
                    className={cn(
                      "text-sm leading-snug",
                      c.status === "dropped" &&
                        "text-muted-foreground line-through"
                    )}
                  >
                    {c.text}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <StateBadge
                      state={c.owner === "manager" ? "You owe" : "They owe"}
                      size="sm"
                      dot={false}
                    />
                    <StateBadge
                      size="sm"
                      state={
                        c.status === "done"
                          ? "Done"
                          : c.status === "dropped"
                            ? "Dropped"
                            : isOverdue(c)
                              ? "Overdue"
                              : "Open"
                      }
                    />
                    {c.dueDate && <span>Due {formatDay(c.dueDate)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              size="sm"
              bare
              title="No commitments"
              description="Nothing was committed to in this 1:1."
            />
          )}
        </RecordSection>

        <RecordSection
          title={
            <>
              Private notes <PrivateBadge />
            </>
          }
          description="Only you see these. They are never part of a shared summary."
          action={
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={showPrivate}
              aria-controls="completed-private-notes"
              onClick={() => setShowPrivate((v) => !v)}
            >
              <ChevronDownIcon
                className={cn(
                  "transition-transform",
                  showPrivate && "rotate-180"
                )}
              />
              {showPrivate ? "Hide" : "Show"}
            </Button>
          }
        >
          <div id="completed-private-notes">
            {!showPrivate ? (
              <p className="text-sm text-muted-foreground">Hidden.</p>
            ) : meeting.privateNotes.trim() ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {meeting.privateNotes.trim()}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                You wrote no private notes.
              </p>
            )}
          </div>
        </RecordSection>
      </RecordLayout>

      <Section
        title="Wrap-up"
        description="The shared record of this conversation."
      >
        <WrapUpPanel meeting={meeting} person={person} />
      </Section>

      <section
        aria-labelledby="coaching-heading"
        className="flex flex-col gap-3 rounded-xl border border-brand/25 bg-brand/5 p-4"
      >
        <div className="grid gap-0.5">
          <h2
            id="coaching-heading"
            className="flex flex-wrap items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <LockIcon aria-hidden className="size-4 text-muted-foreground" />
            For you only
            <PrivateBadge />
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Coaching on how you ran this conversation. {name} never sees it, and
            it is left out of every shared summary and review draft.
          </p>
        </div>
        <CoachingCardPanel meeting={meeting} person={person} />
      </section>
    </div>
  )
}

/* --------------------------------------------------------------- cancelled */

export function CancelledView({
  meeting,
  person,
  onReschedule,
}: {
  meeting: Meeting
  person: Person
  onReschedule: () => void
}) {
  const ws = workspace.use()
  const name = firstName(person.name)
  const health = cadenceHealth(person, ws.meetings)
  const next = nextScheduled(ws.meetings, person.id)

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            This 1:1 was cancelled
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A cancelled 1:1 tells them it is optional. Bring it back within the
            week if you can.
          </p>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Cancelled by</dt>
            <dd className="font-medium">
              {meeting.cancelledBy === "report"
                ? name
                : meeting.cancelledBy === "manager"
                  ? "You"
                  : "Not recorded"}
            </dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Cancelled on</dt>
            <dd className="font-medium">
              {meeting.cancelledAt
                ? formatDateTime(meeting.cancelledAt)
                : "Not recorded"}
            </dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Was planned for</dt>
            <dd className="font-medium">
              {formatDateTime(meeting.scheduledAt)}
            </dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">
              Cancelled in the last {CANCEL_DRIFT_WINDOW_DAYS} days
            </dt>
            <dd className="font-medium">
              {plural(health.recentCancellations, "1:1")} with {name}
            </dd>
          </div>
          <div className="grid gap-0.5 sm:col-span-2">
            <dt className="text-muted-foreground">Reason</dt>
            <dd className="leading-relaxed">
              {meeting.cancelReason ?? "No reason was recorded."}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button size="lg" onClick={onReschedule}>
            <CalendarClockIcon /> Reschedule
          </Button>
          {next ? (
            <Link
              href={`/meetings/session?id=${next.id}`}
              className="text-sm underline-offset-4 hover:underline"
            >
              Next 1:1 with {name}: {formatWhen(next.scheduledAt)}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">
              {name} has no other 1:1 on the calendar.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
