"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import { CalendarPlusIcon, ChevronRightIcon } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { MetricTile } from "@/components/shared/metric-tile"
import { Section } from "@/components/shared/page-header"
import { StateBadge, toneClasses } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  CANCEL_DRIFT_WINDOW_DAYS,
  frequencyLabels,
  meetingTypeLabels,
  TALK_SHARE_MAX,
  TALK_SHARE_MIN,
  weekdayLabels,
} from "@/lib/constants"
import {
  dayDistance,
  firstName,
  formatDateTime,
  formatMinutes,
  formatWhen,
} from "@/lib/format"
import type { Meeting, MeetingStatus, Person } from "@/lib/types"
import { cadenceHealth, cadenceStateLabels } from "@/lib/vantage/cadence"
import { meetingsFor, upcomingMeetings } from "@/lib/vantage/selectors"
import { workspace } from "@/lib/vantage/store"
import { ScheduleMeetingDialog } from "@/features/shared/schedule-dialog"
import { timeLabel } from "../../parts"

const statusLabels: Record<MeetingStatus, string> = {
  scheduled: "Scheduled",
  "in-progress": "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

function MeetingRow({ meeting, name }: { meeting: Meeting; name: string }) {
  const upcoming =
    meeting.status === "scheduled" || meeting.status === "in-progress"
  const share = meeting.stats?.reportShare
  const shareOk =
    share !== undefined && share >= TALK_SHARE_MIN && share <= TALK_SHARE_MAX
  const topics = meeting.summary?.topics ?? []
  return (
    <li>
      <Link
        href={`/meetings/session?id=${meeting.id}`}
        className="group/row flex items-start gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium">
              {upcoming
                ? formatWhen(meeting.scheduledAt)
                : formatDateTime(meeting.scheduledAt)}
            </span>
            <Badge variant="outline" className="font-normal">
              {meetingTypeLabels[meeting.type]}
            </Badge>
            <StateBadge state={statusLabels[meeting.status]} size="sm" />
            <span className="text-xs text-muted-foreground">
              {formatMinutes(meeting.durationMin)}
              {!upcoming && `, ${dayDistance(meeting.scheduledAt)}`}
            </span>
          </div>

          {meeting.status === "cancelled" && (
            <p className="text-xs text-muted-foreground">
              Cancelled by{" "}
              {meeting.cancelledBy === "report"
                ? name
                : meeting.cancelledBy === "manager"
                  ? "you"
                  : "someone, not recorded"}
              {meeting.cancelReason
                ? `: ${meeting.cancelReason}`
                : ". No reason recorded."}
            </p>
          )}
          {meeting.rescheduledFrom && meeting.status !== "cancelled" && (
            <p className="text-xs text-muted-foreground">
              Moved from {formatDateTime(meeting.rescheduledFrom)}
            </p>
          )}

          {topics.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Topics">
              {topics.map((topic) => (
                <li
                  key={topic}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {topic}
                </li>
              ))}
            </ul>
          )}

          {share !== undefined && (
            <p className="text-xs text-muted-foreground">
              {name} spoke{" "}
              <span
                className={cn(
                  "font-medium tabular-nums",
                  shareOk ? "text-foreground" : toneClasses.warning.text
                )}
              >
                {Math.round(share)}%
              </span>{" "}
              of the time
              {!shareOk &&
                ` (aim for ${TALK_SHARE_MIN} to ${TALK_SHARE_MAX} percent)`}
            </p>
          )}
        </div>
        <ChevronRightIcon
          aria-hidden
          className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover/row:translate-x-0.5"
        />
      </Link>
    </li>
  )
}

/** Cadence summary and the whole series, upcoming first. */
export function MeetingsTab({ person }: { person: Person }) {
  const ws = workspace.use()
  const [scheduling, setScheduling] = React.useState(false)
  const name = firstName(person.name)
  const archived = person.status === "archived"
  const health = cadenceHealth(person, ws.meetings)
  const upcoming = upcomingMeetings(ws, person.id)
  const past = meetingsFor(ws, person.id).filter(
    (m) => m.status === "completed" || m.status === "cancelled"
  )

  const scheduleButton = (
    <Button size="sm" disabled={archived} onClick={() => setScheduling(true)}>
      <CalendarPlusIcon /> Schedule 1:1
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Cadence"
        description="How often you planned to meet and how well the series is holding."
        actions={<StateBadge state={cadenceStateLabels[health.state]} />}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label="Frequency"
            value={frequencyLabels[person.cadence.frequency]}
            hint={`${formatMinutes(person.cadence.durationMin)} each`}
          />
          <MetricTile
            label="Slot"
            value={weekdayLabels[person.cadence.weekday]}
            hint={`At ${timeLabel(person.cadence.time)}`}
          />
          <MetricTile
            label="Held"
            value={health.heldRate ?? "n/a"}
            unit={health.heldRate === null ? undefined : "%"}
            hint={
              health.lastHeldDay
                ? `Last held ${dayDistance(health.lastHeldDay)}`
                : "None held yet"
            }
          />
          <MetricTile
            label="Cancellations"
            value={health.recentCancellations}
            tone={health.state === "drifting" ? "warning" : undefined}
            hint={`In the last ${CANCEL_DRIFT_WINDOW_DAYS} days`}
          />
        </div>
      </Section>

      <Section
        title="Upcoming"
        count={upcoming.length}
        actions={scheduleButton}
      >
        {upcoming.length === 0 ? (
          <EmptyState
            size="sm"
            title="Nothing scheduled"
            description={
              archived
                ? `${name} is archived, so no 1:1s are planned.`
                : `Put the next 1:1 with ${name} on the list so the cadence does not lapse.`
            }
            action={!archived ? scheduleButton : undefined}
          />
        ) : (
          <Card className="gap-0 py-0">
            <ul className="divide-y">
              {upcoming.map((m) => (
                <MeetingRow key={m.id} meeting={m} name={name} />
              ))}
            </ul>
          </Card>
        )}
      </Section>

      <Section title="Past" count={past.length}>
        {past.length === 0 ? (
          <EmptyState
            size="sm"
            title="No past 1:1s yet"
            description="Completed and cancelled conversations are listed here with their topics."
          />
        ) : (
          <Card className="gap-0 py-0">
            <ul className="divide-y">
              {past.map((m) => (
                <MeetingRow key={m.id} meeting={m} name={name} />
              ))}
            </ul>
          </Card>
        )}
      </Section>

      <ScheduleMeetingDialog
        open={scheduling}
        onOpenChange={setScheduling}
        personId={person.id}
      />
    </div>
  )
}
