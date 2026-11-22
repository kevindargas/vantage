"use client"

import * as React from "react"
import { cn } from "cn"

import { EmptyState } from "@/components/shared/empty-state"
import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { meetingTypeLabels } from "@/lib/constants"
import { firstName, formatDay, plural } from "@/lib/format"
import { now } from "@/lib/time"
import type { Meeting, MeetingStatus, MeetingType, Person } from "@/lib/types"
import { carriedInto, carryCount, isOverdue } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"

export const meetingStatusLabels: Record<MeetingStatus, string> = {
  scheduled: "Scheduled",
  "in-progress": "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const meetingTypes = Object.keys(meetingTypeLabels) as MeetingType[]

export function isMeetingType(value: string | null): value is MeetingType {
  return !!value && (meetingTypes as string[]).includes(value)
}

/** The conversation type as a quiet outline badge. */
export function TypeBadge({
  type,
  className,
}: {
  type: MeetingType
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn("font-medium", className)}>
      {meetingTypeLabels[type]}
    </Badge>
  )
}

/** Marks content only the manager sees. */
export function PrivateBadge() {
  return <StateBadge state="Private" size="sm" />
}

/** Current time in milliseconds, refreshed on an interval. */
export function useNow(intervalMs = 1000): number {
  const [at, setAt] = React.useState(() => now().getTime())
  React.useEffect(() => {
    const id = window.setInterval(() => setAt(now().getTime()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return at
}

/**
 * A textarea that keeps what is being typed locally and saves it after a
 * short pause, on blur and when it leaves the page.
 */
export function DraftTextarea({
  value,
  onCommit,
  delay = 600,
  ...props
}: Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> & {
  value: string
  onCommit: (value: string) => void
  delay?: number
}) {
  const [draft, setDraft] = React.useState(value)
  const [synced, setSynced] = React.useState(value)
  if (value !== synced) {
    setSynced(value)
    setDraft(value)
  }
  const pending = React.useRef<string | null>(null)
  const timer = React.useRef<number | undefined>(undefined)
  const commit = React.useRef(onCommit)
  React.useEffect(() => {
    commit.current = onCommit
  })

  const flush = React.useCallback(() => {
    window.clearTimeout(timer.current)
    if (pending.current !== null) {
      const next = pending.current
      pending.current = null
      commit.current(next)
    }
  }, [])

  React.useEffect(() => flush, [flush])

  return (
    <Textarea
      {...props}
      value={draft}
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        pending.current = next
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(flush, delay)
      }}
      onBlur={(e) => {
        flush()
        props.onBlur?.(e)
      }}
    />
  )
}

/**
 * Commitments that were open before this 1:1, each with a checkbox. Checking
 * one marks it done on the record; unchecking reopens it.
 */
export function CarriedList({
  meeting,
  person,
  large = false,
}: {
  meeting: Meeting
  person: Person
  /** Larger type for the live view. */
  large?: boolean
}) {
  const ws = workspace.use()
  const carried = carriedInto(ws, meeting)
    .map((c) => ({ ...c, carries: carryCount(ws, c), overdue: isOverdue(c) }))
    .sort(
      (a, b) =>
        Number(a.status !== "open") - Number(b.status !== "open") ||
        Number(b.overdue) - Number(a.overdue) ||
        b.carries - a.carries
    )

  if (!carried.length)
    return (
      <EmptyState
        size="sm"
        bare
        title="Nothing carried over"
        description={`No open commitments between you and ${firstName(person.name)} from earlier 1:1s.`}
      />
    )

  return (
    <ul className="flex flex-col divide-y">
      {carried.map((c) => {
        const done = c.status !== "open"
        const fieldId = `carried-${c.id}`
        return (
          <li
            key={c.id}
            className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <Checkbox
              id={fieldId}
              checked={done}
              onCheckedChange={(checked) =>
                actions.setCommitmentStatus(c.id, checked ? "done" : "open")
              }
              className="mt-0.5"
            />
            <div className="grid min-w-0 flex-1 gap-1">
              <label
                htmlFor={fieldId}
                className={cn(
                  "cursor-pointer leading-snug",
                  large ? "text-base" : "text-sm",
                  done && "text-muted-foreground line-through"
                )}
              >
                {c.text}
              </label>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <StateBadge
                  state={c.owner === "manager" ? "You owe" : "They owe"}
                  size="sm"
                  dot={false}
                />
                {c.dueDate && <span>Due {formatDay(c.dueDate)}</span>}
                {c.overdue && <StateBadge state="Overdue" size="sm" />}
                {c.carries > 0 && (
                  <span>Carried through {plural(c.carries, "1:1")}</span>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
