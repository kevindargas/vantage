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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { readinessLabels } from "@/lib/constants"
import type { Readiness } from "@/lib/types"
import { actions } from "@/lib/vantage/store"
import { PersonSelect } from "./person"

export interface GoalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId?: string
  sourceMeetingId?: string
}

const levels = Object.keys(readinessLabels) as Readiness[]
const readinessItems = levels.map((level) => ({
  value: level,
  label: `${level} · ${readinessLabels[level].level}`,
}))

/** Add a goal with a readiness level, which sets how closely to lead it. */
export function GoalDialog({
  open,
  onOpenChange,
  personId,
  sourceMeetingId,
}: GoalDialogProps) {
  const [person, setPerson] = React.useState(personId ?? "")
  const [title, setTitle] = React.useState("")
  const [readiness, setReadiness] = React.useState<Readiness>("D3")
  const [keyResults, setKeyResults] = React.useState("")
  const selected = personId ?? person

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setTitle("")
      setKeyResults("")
      setReadiness("D3")
      setPerson(personId ?? "")
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !title.trim()) return
    actions.addGoal({
      personId: selected,
      title,
      readiness,
      keyResults: keyResults.split("\n"),
      sourceMeetingId,
    })
    toast.success("Goal added", { description: title.trim() })
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Add a goal</DialogTitle>
            <DialogDescription>
              Tie day-to-day work to an outcome for the quarter, and say how
              ready the person is to run it alone.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            {!personId && (
              <Field>
                <FieldLabel htmlFor="goal-person">For</FieldLabel>
                <PersonSelect
                  id="goal-person"
                  value={person}
                  onChange={setPerson}
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="goal-title">Goal</FieldLabel>
              <Input
                id="goal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Migrate ingestion to the new pipeline"
                required
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="goal-readiness">
                Readiness on this goal
              </FieldLabel>
              <Select
                value={readiness}
                onValueChange={(v) => v && setReadiness(v as Readiness)}
                items={readinessItems}
              >
                <SelectTrigger id="goal-readiness" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {readinessItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {readinessLabels[readiness].style}:{" "}
                {readinessLabels[readiness].guidance}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="goal-krs">Key results (optional)</FieldLabel>
              <Textarea
                id="goal-krs"
                value={keyResults}
                onChange={(e) => setKeyResults(e.target.value)}
                placeholder={
                  "One per line\nDual-write running in staging\nProduction cutover"
                }
                className="min-h-20"
              />
              <FieldDescription>
                Progress is the share of key results that are complete.
              </FieldDescription>
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
            <Button type="submit" disabled={!selected || !title.trim()}>
              Add goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
