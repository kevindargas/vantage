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
import type { Objective, ObjectiveLevel } from "@/lib/types"
import { openObjectives } from "@/lib/vantage/alignment"
import { actions, workspace } from "@/lib/vantage/store"

export interface ObjectiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Level of a new objective. Ignored when editing. */
  level?: ObjectiveLevel
  /** Preselected business goal for a new manager objective. */
  parentId?: string
  /** Pass an objective to edit it. */
  objective?: Objective
}

const NO_PARENT = "none"

const copy: Record<
  ObjectiveLevel,
  { add: string; edit: string; description: string; placeholder: string }
> = {
  business: {
    add: "Add a business goal",
    edit: "Edit business goal",
    description:
      "A goal the company or your department has set. Your own goals line up behind it.",
    placeholder: "Grow net revenue retention to 115 percent",
  },
  manager: {
    add: "Add one of my goals",
    edit: "Edit my goal",
    description:
      "What you are accountable for. The team's goals can then name it as the one they support.",
    placeholder: "Hold 99.95 percent uptime while shipping daily",
  },
}

/** Add or edit a business goal or one of the manager's own goals. */
export function ObjectiveDialog(props: ObjectiveDialogProps) {
  // Remount per target so the fields start from the right values.
  const key = props.objective?.id ?? `${props.level}-${props.parentId ?? ""}`
  return <ObjectiveForm key={key} {...props} />
}

function ObjectiveForm({
  open,
  onOpenChange,
  level: levelProp = "manager",
  parentId,
  objective,
}: ObjectiveDialogProps) {
  const ws = workspace.use()
  const level = objective?.level ?? levelProp
  const text = copy[level]
  const [title, setTitle] = React.useState(objective?.title ?? "")
  const [measure, setMeasure] = React.useState(objective?.measure ?? "")
  const [parent, setParent] = React.useState(
    objective?.parentId ?? parentId ?? NO_PARENT
  )
  const parents = [
    { value: NO_PARENT, label: "No business goal" },
    ...openObjectives(ws, "business").map((o) => ({
      value: o.id,
      label: o.title,
    })),
  ]
  const parentValue = parents.some((p) => p.value === parent)
    ? parent
    : NO_PARENT

  function close(next: boolean) {
    onOpenChange(next)
    if (!next && !objective) {
      setTitle("")
      setMeasure("")
      setParent(parentId ?? NO_PARENT)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const linked = parentValue === NO_PARENT ? undefined : parentValue
    if (objective) {
      actions.update("objectives", objective.id, {
        title: title.trim(),
        measure: measure.trim() || undefined,
        parentId: level === "manager" ? linked : undefined,
      })
      toast.success("Goal updated", { description: title.trim() })
    } else {
      actions.addObjective({ level, title, measure, parentId: linked })
      toast.success(
        level === "business" ? "Business goal added" : "Your goal added",
        { description: title.trim() }
      )
    }
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{objective ? text.edit : text.add}</DialogTitle>
            <DialogDescription>{text.description}</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="objective-title">Goal</FieldLabel>
              <Input
                id="objective-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={text.placeholder}
                required
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="objective-measure">
                How it is measured (optional)
              </FieldLabel>
              <Input
                id="objective-measure"
                value={measure}
                onChange={(e) => setMeasure(e.target.value)}
                placeholder="The number or outcome that shows it is done"
              />
            </Field>
            {level === "manager" && (
              <Field>
                <FieldLabel htmlFor="objective-parent">
                  Business goal it supports
                </FieldLabel>
                <Select
                  value={parentValue}
                  onValueChange={(v) => v && setParent(v)}
                  items={parents}
                >
                  <SelectTrigger id="objective-parent" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {parents.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Leave it open when the goal is yours alone, such as growing
                  the team.
                </FieldDescription>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {objective ? "Save" : "Add goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
