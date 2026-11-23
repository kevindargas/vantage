"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  CircleSlashIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { StateBadge } from "@/components/shared/status-badge"
import { PersonChip } from "@/features/shared/person"
import { dayDistance, firstName, formatDay, plural } from "@/lib/format"
import type { Commitment } from "@/lib/types"
import {
  carryCount,
  getMeeting,
  getPerson,
  isOverdue,
} from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"

export function ownerLabel(owner: Commitment["owner"]) {
  return owner === "manager" ? "You owe" : "They owe"
}

/** One open commitment: complete it, see who owes it and how long it has run. */
export function CommitmentRow({ commitment }: { commitment: Commitment }) {
  const ws = workspace.use()
  const [editing, setEditing] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const carried = carryCount(ws, commitment)
  const overdue = isOverdue(commitment)
  const source = commitment.sourceMeetingId
    ? getMeeting(ws, commitment.sourceMeetingId)
    : undefined
  const name =
    firstName(getPerson(ws, commitment.personId)?.name ?? "") || "this person"

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Checkbox
        checked={false}
        aria-label={`Mark done: ${commitment.text}`}
        className="mt-0.5"
        onCheckedChange={() => {
          actions.setCommitmentStatus(commitment.id, "done")
          toast.success("Commitment marked done", {
            description: commitment.text,
          })
        }}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm leading-snug font-medium text-pretty">
          {commitment.text}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <StateBadge size="sm" state={ownerLabel(commitment.owner)} />
          <PersonChip personId={commitment.personId} size="xs" />
          {commitment.dueDate ? (
            <span
              className={cn(
                "whitespace-nowrap",
                overdue && "font-medium text-danger-text"
              )}
            >
              Due {formatDay(commitment.dueDate)},{" "}
              {dayDistance(commitment.dueDate)}
            </span>
          ) : (
            <span>No due date</span>
          )}
          {carried > 0 && (
            <span
              className={cn(
                "whitespace-nowrap",
                carried > 1 && "font-medium text-warning-text"
              )}
            >
              Carried through {plural(carried, "1:1")}
            </span>
          )}
          {source && (
            <Link
              href={`/meetings/session?id=${source.id}`}
              className="rounded-sm whitespace-nowrap underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              From the 1:1 on {formatDay(source.scheduledAt)}
            </Link>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for: ${commitment.text}`}
              className="-mr-1.5 text-muted-foreground"
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              actions.setCommitmentStatus(commitment.id, "dropped")
              toast.success("Commitment dropped", {
                description: commitment.text,
              })
            }}
          >
            <CircleSlashIcon />
            Drop
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleting(true)}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && (
        <EditCommitmentDialog
          commitment={commitment}
          onClose={() => setEditing(false)}
        />
      )}
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this commitment?</AlertDialogTitle>
            <AlertDialogDescription>
              It is removed from the record with {name} for good, as if it was
              never made. To keep the history, drop it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                actions.remove("commitments", commitment.id)
                setDeleting(false)
                toast.success("Commitment deleted", {
                  description: commitment.text,
                })
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

/** Edit the wording and the due date. Owner and person stay as they were. */
function EditCommitmentDialog({
  commitment,
  onClose,
}: {
  commitment: Commitment
  onClose: () => void
}) {
  const [text, setText] = React.useState(commitment.text)
  const [due, setDue] = React.useState(commitment.dueDate ?? "")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    actions.update("commitments", commitment.id, {
      text: text.trim(),
      dueDate: due || undefined,
    })
    toast.success("Commitment updated", { description: text.trim() })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Edit commitment</DialogTitle>
            <DialogDescription>
              Change the wording or agree a new date. Who owes it stays the
              same.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="edit-commit-text">What</FieldLabel>
              <Textarea
                id="edit-commit-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-16"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-commit-due">Due</FieldLabel>
              <Input
                id="edit-commit-due"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!text.trim()}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
