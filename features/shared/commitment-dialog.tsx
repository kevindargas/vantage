"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { firstName } from "@/lib/format"
import { addDays, today } from "@/lib/time"
import type { AgendaOwner } from "@/lib/types"
import { getPerson } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { PersonSelect } from "./person"

export interface CommitmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Preselect and lock the person. */
  personId?: string
  /** Link the commitment to the 1:1 it was made in. */
  sourceMeetingId?: string
  defaultOwner?: AgendaOwner
}

/** Add a commitment: who owes it, to whom, by when. */
export function CommitmentDialog({
  open,
  onOpenChange,
  personId,
  sourceMeetingId,
  defaultOwner = "manager",
}: CommitmentDialogProps) {
  const ws = workspace.use()
  const [person, setPerson] = React.useState(personId ?? "")
  const [owner, setOwner] = React.useState<AgendaOwner>(defaultOwner)
  const [text, setText] = React.useState("")
  const [due, setDue] = React.useState(() => addDays(today(), 7))
  const selected = personId ?? person
  const name = firstName(getPerson(ws, selected)?.name ?? "") || "They"

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setText("")
      setOwner(defaultOwner)
      setPerson(personId ?? "")
      setDue(addDays(today(), 7))
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !text.trim()) return
    actions.addCommitment({
      personId: selected,
      owner,
      text,
      dueDate: due || undefined,
      sourceMeetingId,
    })
    toast.success("Commitment added", {
      description: `${owner === "manager" ? "You owe" : `${name} owes`}: ${text.trim()}`,
    })
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Add a commitment</DialogTitle>
            <DialogDescription>
              Every commitment has an owner and a date. It stays at the top of
              each 1:1 until it is done or dropped.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            {!personId && (
              <Field>
                <FieldLabel htmlFor="commit-person">With</FieldLabel>
                <PersonSelect
                  id="commit-person"
                  value={person}
                  onChange={setPerson}
                />
              </Field>
            )}
            <Field>
              <FieldLabel>Who owes it</FieldLabel>
              <ToggleGroup
                value={[owner]}
                onValueChange={(v) => {
                  const next = v[0] as AgendaOwner | undefined
                  if (next) setOwner(next)
                }}
                variant="outline"
                className="w-full"
              >
                <ToggleGroupItem value="manager" className="flex-1">
                  You
                </ToggleGroupItem>
                <ToggleGroupItem value="report" className="flex-1">
                  {name}
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="commit-text">What</FieldLabel>
              <Textarea
                id="commit-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Get an owner named for the pipeline approval"
                className="min-h-16"
                required
                autoFocus
              />
              <FieldDescription>
                Start with a verb. One outcome per commitment.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="commit-due">Due</FieldLabel>
              <Input
                id="commit-due"
                type="date"
                value={due}
                min={today()}
                onChange={(e) => setDue(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!selected || !text.trim()}>
              Add commitment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
