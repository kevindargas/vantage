"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import { ChevronRightIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CountPill } from "@/components/shared/count-pill"
import { meetingTypeLabels } from "@/lib/constants"
import { formatDay } from "@/lib/format"
import { dayOf } from "@/lib/time"
import { getMeeting } from "@/lib/vantage/selectors"
import { workspace } from "@/lib/vantage/store"

/** Link to the 1:1 a record came from. Renders nothing when it is gone. */
export function SourceLink({
  meetingId,
  className,
}: {
  meetingId?: string
  className?: string
}) {
  const ws = workspace.use()
  const meeting = meetingId ? getMeeting(ws, meetingId) : undefined
  if (!meeting) return null
  return (
    <Link
      href={`/meetings/session?id=${meeting.id}`}
      className={cn(
        "rounded-sm text-xs text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      From the {meetingTypeLabels[meeting.type].toLowerCase()} on{" "}
      {formatDay(dayOf(meeting.scheduledAt))}
    </Link>
  )
}

export interface Option<T extends string = string> {
  value: T
  label: string
}

/** A labelled-by-id select over a fixed option list. */
export function OptionSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  className,
  size,
  "aria-label": ariaLabel,
}: {
  id?: string
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  className?: string
  size?: "sm" | "default"
  "aria-label"?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      items={options}
    >
      <SelectTrigger
        id={id}
        size={size}
        aria-label={ariaLabel}
        className={cn("w-full", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function optionsFrom<T extends string>(
  labels: Record<T, string>
): Option<T>[] {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }))
}

/** A collapsible list with a count, closed unless `defaultOpen` is set. */
export function History({
  title,
  count,
  children,
  className,
  defaultOpen = false,
}: {
  title: string
  count: number
  children: React.ReactNode
  className?: string
  defaultOpen?: boolean
}) {
  return (
    <Collapsible className={className} defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="group/history flex w-full items-center gap-2 rounded-md py-1 text-left text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRightIcon className="size-3.5 transition-transform group-data-panel-open/history:rotate-90" />
        {title}
        <CountPill count={count} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}

/** "Mar 3 to Jun 12" for a validity range, open ended when still in force. */
export function validityRange(validFrom: string, validTo?: string) {
  return `${formatDay(validFrom)} to ${validTo ? formatDay(validTo) : "today"}`
}

/** One row in a bordered list inside a card. */
export function Row({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className
      )}
    >
      {children}
    </li>
  )
}
