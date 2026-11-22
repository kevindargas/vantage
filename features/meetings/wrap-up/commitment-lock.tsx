"use client"

import * as React from "react"
import { cn } from "cn"
import { CheckIcon, PlusIcon, RotateCcwIcon, XIcon } from "lucide-react"

import { CountPill } from "@/components/shared/count-pill"
import { Eyebrow } from "@/components/shared/eyebrow"
import { StateBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { CommitmentDialog } from "@/features/shared/commitment-dialog"
import { formatDay } from "@/lib/format"
import type { AgendaOwner, Commitment, Meeting, Person } from "@/lib/types"
import { carriedInto, isOverdue } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"

function CommitmentRow({
  commitment,
  showOwner,
  name,
}: {
  commitment: Commitment
  /** Name the owner on the row, for lists that mix both sides. */
  showOwner?: boolean
  name: string
}) {
  const open = commitment.status === "open"
  const overdue = open && isOverdue(commitment)
  return (
    <li className="flex items-start gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-snug",
            !open && "text-muted-foreground line-through"
          )}
        >
          {showOwner && (
            <span className="font-medium">
              {commitment.owner === "manager" ? "You" : name}:{" "}
            </span>
          )}
          {commitment.text}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {commitment.dueDate ? (
            <span className={cn(overdue && "text-danger-text")}>
              Due {formatDay(commitment.dueDate)}
              {overdue && ", overdue"}
            </span>
          ) : (
            <span>No due date</span>
          )}
          {!open && (
            <StateBadge
              size="sm"
              state={commitment.status === "done" ? "Done" : "Dropped"}
              tone={commitment.status === "done" ? "success" : "muted"}
            />
          )}
        </p>
      </div>
      {open ? (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="xs"
            aria-label={`Mark done: ${commitment.text}`}
            onClick={() => actions.setCommitmentStatus(commitment.id, "done")}
          >
            <CheckIcon />
            Done
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            aria-label={`Drop: ${commitment.text}`}
            onClick={() =>
              actions.setCommitmentStatus(commitment.id, "dropped")
            }
          >
            <XIcon />
            Drop
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={`Reopen: ${commitment.text}`}
          onClick={() => actions.setCommitmentStatus(commitment.id, "open")}
        >
          <RotateCcwIcon />
          Reopen
        </Button>
      )}
    </li>
  )
}

/**
 * Step 1 of the wrap-up: say out loud who will do what by when. Commitments
 * made in this 1:1 are split by owner; items carried in from earlier stay
 * visible until they are done or dropped.
 */
export function CommitmentLock({
  meeting,
  person,
  name,
}: {
  meeting: Meeting
  person: Person
  name: string
}) {
  const ws = workspace.use()
  const [adding, setAdding] = React.useState<AgendaOwner | null>(null)
  const made = ws.commitments.filter((c) => c.sourceMeetingId === meeting.id)
  const carried = carriedInto(ws, meeting)

  const sides: { owner: AgendaOwner; title: string; empty: string }[] = [
    {
      owner: "manager",
      title: "You",
      empty: `Nothing on your side yet. Ask what you can take off ${name}'s plate.`,
    },
    {
      owner: "report",
      title: name,
      empty: `Nothing on ${name}'s side yet. Ask what they will take away from today.`,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {sides.map((side) => {
          const items = made.filter((c) => c.owner === side.owner)
          return (
            <section
              key={side.owner}
              aria-label={`Commitments: ${side.title}`}
              className="flex flex-col rounded-lg border bg-muted/30 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <Eyebrow as="h4" className="flex items-center gap-1.5">
                  {side.title}
                  <CountPill count={items.length} />
                </Eyebrow>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setAdding(side.owner)}
                  aria-label={
                    side.owner === "manager"
                      ? "Add a commitment for you"
                      : `Add a commitment for ${name}`
                  }
                >
                  <PlusIcon />
                  Add
                </Button>
              </div>
              {items.length ? (
                <ul className="divide-y">
                  {items.map((c) => (
                    <CommitmentRow key={c.id} commitment={c} name={name} />
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-sm text-muted-foreground">
                  {side.empty}
                </p>
              )}
            </section>
          )
        })}
      </div>

      <section aria-label="Carried in from earlier 1:1s">
        <Eyebrow as="h4" className="flex items-center gap-1.5">
          Carried in from before
          <CountPill count={carried.length} />
        </Eyebrow>
        {carried.length ? (
          <ul className="divide-y">
            {carried.map((c) => (
              <CommitmentRow key={c.id} commitment={c} name={name} showOwner />
            ))}
          </ul>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            Nothing was carried in. Every earlier commitment is closed.
          </p>
        )}
      </section>

      {adding && (
        <CommitmentDialog
          key={adding}
          open
          onOpenChange={(open) => {
            if (!open) setAdding(null)
          }}
          personId={person.id}
          sourceMeetingId={meeting.id}
          defaultOwner={adding}
        />
      )}
    </div>
  )
}
