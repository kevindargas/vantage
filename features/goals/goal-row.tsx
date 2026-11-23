"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Eyebrow } from "@/components/shared/eyebrow"
import { StateBadge } from "@/components/shared/status-badge"
import { AlignControl } from "@/features/shared/align-control"
import { goalStatusLabels, readinessLabels } from "@/lib/constants"
import { formatPercent } from "@/lib/format"
import type { Goal, GoalStatus, Readiness } from "@/lib/types"
import { actions } from "@/lib/vantage/store"

export const goalStatuses = Object.keys(goalStatusLabels) as GoalStatus[]
export const readinessLevels = Object.keys(readinessLabels) as Readiness[]

export function isClosed(goal: Goal) {
  return goal.status === "done" || goal.status === "dropped"
}

/** "2026-Q4" to "Q4 2026". */
function quarterLabel(quarter: string) {
  const [year, q] = quarter.split("-")
  return q && year ? `${q} ${year}` : quarter
}

const optionClass =
  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-muted"

/** Status badge that opens a small form: pick a status, add an optional note. */
function StatusControl({ goal }: { goal: Goal }) {
  const [open, setOpen] = React.useState(false)
  const [status, setStatus] = React.useState<GoalStatus>(goal.status)
  const [note, setNote] = React.useState("")
  const noteId = `goal-status-note-${goal.id}`

  function toggle(next: boolean) {
    setOpen(next)
    if (next) {
      setStatus(goal.status)
      setNote("")
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (status === goal.status) return
    actions.setGoalStatus(goal.id, status, note.trim() || undefined)
    toast.success(`Goal marked ${goalStatusLabels[status].toLowerCase()}`, {
      description: goal.title,
    })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger
        aria-label={`Change status of ${goal.title}, now ${goalStatusLabels[goal.status]}`}
        className="inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <StateBadge state={goalStatusLabels[goal.status]} />
        <ChevronDownIcon
          aria-hidden
          className="size-3.5 text-muted-foreground"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <form onSubmit={save} className="contents">
          <PopoverHeader>
            <PopoverTitle>Change status</PopoverTitle>
            <PopoverDescription className="text-xs">
              The change is added to the goal&apos;s history with today&apos;s
              date.
            </PopoverDescription>
          </PopoverHeader>
          <div className="flex flex-col gap-0.5">
            {goalStatuses.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={optionClass}
              >
                <StateBadge state={goalStatusLabels[s]} />
                {status === s && <CheckIcon aria-hidden className="size-4" />}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={noteId} className="text-xs font-medium">
              Note (optional)
            </label>
            <Input
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What changed"
            />
          </div>
          <Button type="submit" size="sm" disabled={status === goal.status}>
            Save status
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

/** Readiness chip with the guidance for that level and a way to change it. */
function ReadinessControl({ goal }: { goal: Goal }) {
  const [open, setOpen] = React.useState(false)
  const current = readinessLabels[goal.readiness]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Readiness for ${goal.title}: ${goal.readiness}, ${current.style}`}
        className="inline-flex h-5 items-center gap-1.5 rounded-full border border-border bg-card px-2 text-xs font-medium whitespace-nowrap outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-mono text-2xs text-muted-foreground">
          {goal.readiness}
        </span>
        {current.style}
        <ChevronDownIcon aria-hidden className="size-3 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <PopoverHeader>
          <PopoverTitle>
            {goal.readiness}: {current.level}
          </PopoverTitle>
          <PopoverDescription className="text-xs leading-relaxed">
            Lead by {current.style.toLowerCase()}. {current.guidance}
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-0.5 border-t pt-2">
          <Eyebrow className="px-2 pb-1">Change the level</Eyebrow>
          {readinessLevels.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={goal.readiness === level}
              onClick={() => {
                if (level !== goal.readiness) {
                  actions.update("goals", goal.id, { readiness: level })
                  toast.success(
                    `Readiness set to ${level}, ${readinessLabels[level].style.toLowerCase()}`,
                    { description: goal.title }
                  )
                }
                setOpen(false)
              }}
              className={optionClass}
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {level}
                </span>
                <span className="truncate">{readinessLabels[level].level}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {readinessLabels[level].style}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** One goal inside a person's group. */
export function GoalRow({ goal }: { goal: Goal }) {
  const total = goal.keyResults.length
  const done = goal.keyResults.filter((k) => k.done).length
  const last = goal.history[goal.history.length - 1]

  return (
    <li className="flex flex-col gap-2.5 px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-64">
          <Link
            href={`/people/profile?id=${goal.personId}&tab=goals`}
            className={cn(
              "rounded-sm text-sm leading-snug font-medium text-pretty underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring",
              isClosed(goal) && "text-muted-foreground"
            )}
          >
            {goal.title}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {quarterLabel(goal.quarter)}
            {last?.note ? `. ${last.note}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusControl goal={goal} />
          <ReadinessControl goal={goal} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Progress
          value={goal.progress}
          aria-label={`Progress on ${goal.title}`}
          className="w-40 max-w-full"
        />
        <span className="font-medium text-foreground tabular-nums">
          {formatPercent(goal.progress)}
        </span>
        {total > 0 && (
          <span>
            {done} of {total} key results
          </span>
        )}
        {!isClosed(goal) && <AlignControl goal={goal} className="ml-auto" />}
      </div>
    </li>
  )
}
