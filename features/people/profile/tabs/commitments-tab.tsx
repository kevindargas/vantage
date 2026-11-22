"use client"

import * as React from "react"
import { cn } from "cn"
import { ListPlusIcon, RotateCcwIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { MetricTile } from "@/components/shared/metric-tile"
import { StateBadge, toneClasses } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { CommitmentDialog } from "@/features/shared/commitment-dialog"
import { dayDistance, firstName, formatDay, plural } from "@/lib/format"
import { dayOf } from "@/lib/time"
import type { AgendaOwner, Commitment, Person, Workspace } from "@/lib/types"
import {
  carryCount,
  followThrough,
  isOverdue,
  type FollowThrough,
} from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { Disclosure } from "../../parts"

function OpenItem({ ws, c }: { ws: Workspace; c: Commitment }) {
  const overdue = isOverdue(c)
  const carried = carryCount(ws, c)
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <Checkbox
        className="mt-0.5"
        checked={false}
        aria-label={`Mark done: ${c.text}`}
        onCheckedChange={() => {
          actions.setCommitmentStatus(c.id, "done")
          toast.success("Commitment done", {
            description: c.text,
            action: {
              label: "Undo",
              onClick: () => actions.setCommitmentStatus(c.id, "open"),
            },
          })
        }}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-snug">{c.text}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {overdue && <StateBadge state="Overdue" size="sm" />}
          <span className={cn(overdue && toneClasses.danger.text)}>
            {c.dueDate
              ? `Due ${formatDay(c.dueDate)}, ${dayDistance(c.dueDate)}`
              : "No due date"}
          </span>
          {carried > 0 && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5",
                toneClasses[carried >= 2 ? "warning" : "muted"].soft
              )}
            >
              carried through {plural(carried, "1:1")}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Drop: ${c.text}`}
        title="Drop"
        className="text-muted-foreground"
        onClick={() => {
          actions.setCommitmentStatus(c.id, "dropped")
          toast.success("Commitment dropped", {
            description: c.text,
            action: {
              label: "Undo",
              onClick: () => actions.setCommitmentStatus(c.id, "open"),
            },
          })
        }}
      >
        <XIcon />
      </Button>
    </li>
  )
}

function ClosedItem({ c }: { c: Commitment }) {
  return (
    <li className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <StateBadge
        state={c.status === "done" ? "Done" : "Dropped"}
        size="sm"
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-snug",
            c.status === "dropped" && "text-muted-foreground line-through"
          )}
        >
          {c.text}
        </p>
        {c.completedAt && (
          <p className="text-xs text-muted-foreground">
            Closed {formatDay(dayOf(c.completedAt))}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Reopen: ${c.text}`}
        title="Reopen"
        className="text-muted-foreground"
        onClick={() => {
          actions.setCommitmentStatus(c.id, "open")
          toast.success("Commitment reopened", { description: c.text })
        }}
      >
        <RotateCcwIcon />
      </Button>
    </li>
  )
}

function Column({
  ws,
  title,
  description,
  emptyText,
  items,
  stats,
  onAdd,
  canAdd,
}: {
  ws: Workspace
  title: string
  description: string
  emptyText: string
  items: Commitment[]
  stats: FollowThrough
  onAdd: () => void
  canAdd: boolean
}) {
  const open = items
    .filter((c) => c.status === "open")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
  const closed = items
    .filter((c) => c.status !== "open")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={onAdd}
            disabled={!canAdd}
          >
            <ListPlusIcon /> Add
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <MetricTile
            label="Follow-through"
            value={stats.rate ?? "n/a"}
            unit={stats.rate === null ? undefined : "%"}
            hint={stats.rate === null ? "Nothing has come due" : undefined}
          />
          <MetricTile label="Open" value={stats.open} />
          <MetricTile
            label="Overdue"
            value={stats.missed}
            tone={stats.missed > 0 ? "danger" : undefined}
          />
        </div>
        {open.length === 0 ? (
          <EmptyState
            bare
            size="sm"
            title="Nothing open"
            description={emptyText}
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {open.map((c) => (
              <OpenItem key={c.id} ws={ws} c={c} />
            ))}
          </ul>
        )}
        {closed.length > 0 && (
          <Disclosure label="Closed" count={closed.length}>
            <ul className="flex flex-col divide-y">
              {closed.map((c) => (
                <ClosedItem key={c.id} c={c} />
              ))}
            </ul>
          </Disclosure>
        )}
      </CardContent>
    </Card>
  )
}

/** What each side owes, with carry-forward and follow-through. */
export function CommitmentsTab({ person }: { person: Person }) {
  const ws = workspace.use()
  const [adding, setAdding] = React.useState<AgendaOwner | null>(null)
  const name = firstName(person.name)
  const all = ws.commitments.filter((c) => c.personId === person.id)
  const canAdd = person.status === "active"

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Column
        ws={ws}
        title="You owe"
        description={`What you promised ${name}. Kept promises are what the 1:1 runs on.`}
        emptyText={`You owe ${name} nothing right now.`}
        items={all.filter((c) => c.owner === "manager")}
        stats={followThrough(ws.commitments, "manager", person.id)}
        onAdd={() => setAdding("manager")}
        canAdd={canAdd}
      />
      <Column
        ws={ws}
        title="They owe"
        description={`What ${name} took on.`}
        emptyText={`${name} has nothing open.`}
        items={all.filter((c) => c.owner === "report")}
        stats={followThrough(ws.commitments, "report", person.id)}
        onAdd={() => setAdding("report")}
        canAdd={canAdd}
      />
      {/* Remounted per owner so the dialog opens on the right side. */}
      <CommitmentDialog
        key={adding ?? "closed"}
        open={adding !== null}
        onOpenChange={(open) => !open && setAdding(null)}
        personId={person.id}
        defaultOwner={adding ?? "manager"}
      />
    </div>
  )
}
