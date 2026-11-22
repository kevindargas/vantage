"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarClockIcon,
  CalendarXIcon,
  ChevronLeftIcon,
  PlayIcon,
  RepeatIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { RecordNotFound } from "@/components/record/record-not-found"
import {
  RecordOverflowMenu,
  type RecordOverflowItem,
} from "@/components/record/record-overflow-menu"
import { PageHeader } from "@/components/shared/page-header"
import { StateBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { PersonChip } from "@/features/shared/person"
import { useQueryParam } from "@/hooks/use-query-param"
import { meetingTypeLabels } from "@/lib/constants"
import {
  firstName,
  formatDay,
  formatDayLong,
  formatMinutes,
  formatTime,
} from "@/lib/format"
import { dayOf } from "@/lib/time"
import type { Meeting } from "@/lib/types"
import { getMeeting, getPerson } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { isSensitive } from "@/lib/vantage/transcript"
import { CancelledView, CompletedView } from "./closed-views"
import { LiveView } from "./live-view"
import {
  CancelDialog,
  ChangeTypeDialog,
  RescheduleDialog,
} from "./meeting-dialogs"
import { meetingStatusLabels } from "./parts"
import { PrepareView } from "./prepare-view"

type OpenDialog = "reschedule" | "cancel" | "type"

/** Everything typed into a 1:1, for the sensitive keyword check. */
function meetingText(meeting: Meeting) {
  return [
    ...meeting.agenda.flatMap((a) => [a.text, a.notes ?? ""]),
    meeting.sharedNotes,
    meeting.privateNotes,
  ].join("\n")
}

/** One 1:1: prepare, run, and read it back, depending on its status. */
export function MeetingView({ id }: { id: string }) {
  const ws = workspace.use()
  const router = useRouter()
  const [tab] = useQueryParam("tab")
  const [dialog, setDialog] = React.useState<OpenDialog | null>(null)
  const meeting = getMeeting(ws, id)
  const person = meeting ? getPerson(ws, meeting.personId) : undefined

  if (!meeting || !person)
    return (
      <RecordNotFound
        number={id}
        backHref="/meetings"
        backLabel="1:1s"
        description="This 1:1 is not in your workspace. It may have been deleted."
      />
    )

  const name = firstName(person.name)
  const { status } = meeting
  const sensitivity = isSensitive(
    meeting.type,
    meetingText(meeting),
    ws.settings.sensitiveKeywords
  )
  const open = status === "scheduled" || status === "in-progress"

  const overflow: RecordOverflowItem[] = [
    {
      label: "Change type",
      icon: <RepeatIcon />,
      disabled: !open,
      onSelect: () => {
        setDialog("type")
        return false
      },
    },
    {
      label: "Reschedule",
      icon: <CalendarClockIcon />,
      disabled: status !== "scheduled" && status !== "cancelled",
      onSelect: () => {
        setDialog("reschedule")
        return false
      },
    },
    {
      label: "Cancel 1:1",
      icon: <CalendarXIcon />,
      disabled: status !== "scheduled",
      onSelect: () => {
        setDialog("cancel")
        return false
      },
    },
    {
      label: "Delete 1:1",
      icon: <Trash2Icon />,
      destructive: true,
      separatorBefore: true,
      message: "1:1 deleted",
      confirm: {
        title: "Delete this 1:1?",
        description: `The agenda and notes of this 1:1 with ${name} are removed for good. Commitments made in it stay on the record. To keep the history, cancel it instead.`,
        actionLabel: "Delete 1:1",
      },
      onSelect: () => {
        router.push("/meetings")
        actions.remove("meetings", meeting.id)
      },
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Link href="/meetings" className="inline-flex items-center gap-1">
            <ChevronLeftIcon className="size-3.5" /> 1:1s
          </Link>
        }
        title={meetingTypeLabels[meeting.type]}
        meta={
          <>
            <StateBadge
              state={meetingStatusLabels[status]}
              pulse={status === "in-progress"}
            />
            {meeting.rescheduledFrom && status === "scheduled" && (
              <StateBadge state="Rescheduled" />
            )}
            {sensitivity.sensitive && <StateBadge state="Manual notes" />}
          </>
        }
        description={`${formatDayLong(dayOf(meeting.scheduledAt))} at ${formatTime(meeting.scheduledAt)}, ${formatMinutes(meeting.durationMin)}`}
        actions={
          <>
            {status === "scheduled" && (
              <>
                <Button
                  onClick={() => {
                    actions.startMeeting(meeting.id)
                    toast.success(`1:1 with ${name} started`)
                  }}
                >
                  <PlayIcon /> Start 1:1
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDialog("reschedule")}
                >
                  Reschedule
                </Button>
                <Button variant="outline" onClick={() => setDialog("cancel")}>
                  Cancel
                </Button>
              </>
            )}
            {status === "cancelled" && (
              <Button onClick={() => setDialog("reschedule")}>
                <CalendarClockIcon /> Reschedule
              </Button>
            )}
            <RecordOverflowMenu items={overflow} label="More actions" />
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <PersonChip personId={person.id} size="lg" showRole />
          {meeting.rescheduledFrom && status === "scheduled" && (
            <p className="text-xs text-muted-foreground">
              Moved from {formatDay(meeting.rescheduledFrom)},{" "}
              {formatTime(meeting.rescheduledFrom)}.
            </p>
          )}
          {sensitivity.sensitive && (
            <p className="text-xs text-muted-foreground">
              Manual notes: {sensitivity.reason} Transcript capture is off for
              this conversation.
            </p>
          )}
        </div>
      </PageHeader>

      {status === "scheduled" && (
        <PrepareView meeting={meeting} person={person} />
      )}
      {status === "in-progress" && (
        <LiveView
          meeting={meeting}
          person={person}
          initialWrap={tab === "wrap-up"}
        />
      )}
      {status === "completed" && (
        <CompletedView meeting={meeting} person={person} />
      )}
      {status === "cancelled" && (
        <CancelledView
          meeting={meeting}
          person={person}
          onReschedule={() => setDialog("reschedule")}
        />
      )}

      <RescheduleDialog
        meeting={meeting}
        person={person}
        open={dialog === "reschedule"}
        onOpenChange={(next) => setDialog(next ? "reschedule" : null)}
      />
      <CancelDialog
        meeting={meeting}
        person={person}
        open={dialog === "cancel"}
        onOpenChange={(next) => setDialog(next ? "cancel" : null)}
        onReschedule={() => setDialog("reschedule")}
      />
      <ChangeTypeDialog
        meeting={meeting}
        open={dialog === "type"}
        onOpenChange={(next) => setDialog(next ? "type" : null)}
      />
    </div>
  )
}
