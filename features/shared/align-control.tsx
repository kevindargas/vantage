"use client"

import { cn } from "cn"
import { toast } from "sonner"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Goal } from "@/lib/types"
import { openObjectives } from "@/lib/vantage/alignment"
import { actions, workspace } from "@/lib/vantage/store"

export const NOT_ALIGNED = "none"

/** Select items for "which of my goals does this support". */
export function useObjectiveItems() {
  const ws = workspace.use()
  return [
    { value: NOT_ALIGNED, label: "Not tied to one of my goals" },
    ...openObjectives(ws, "manager").map((o) => ({
      value: o.id,
      label: o.title,
    })),
  ]
}

/**
 * Shows which of the manager's goals a team goal supports and lets the
 * manager change it. Renders nothing until the manager has a goal of their
 * own to point at.
 */
export function AlignControl({
  goal,
  className,
}: {
  goal: Goal
  className?: string
}) {
  const items = useObjectiveItems()
  if (items.length === 1) return null
  const value = items.some((i) => i.value === goal.objectiveId)
    ? goal.objectiveId!
    : NOT_ALIGNED

  return (
    <Select
      value={value}
      items={items}
      onValueChange={(next) => {
        if (!next || next === value) return
        const target = next === NOT_ALIGNED ? undefined : next
        actions.alignGoal(goal.id, target)
        toast.success(
          target
            ? `Supports: ${items.find((i) => i.value === target)?.label}`
            : "Link to your goal removed",
          { description: goal.title }
        )
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Which of my goals ${goal.title} supports`}
        className={cn(
          "h-6! max-w-64 min-w-0 rounded-full py-0 pl-2 text-xs",
          value === NOT_ALIGNED && "border-dashed text-muted-foreground",
          className
        )}
      >
        <span className="shrink-0 text-muted-foreground">Supports</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" className="max-w-80">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
