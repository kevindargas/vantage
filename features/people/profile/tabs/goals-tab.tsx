"use client"

import * as React from "react"
import { cn } from "cn"
import { ChevronDownIcon, CompassIcon, TargetIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { Section } from "@/components/shared/page-header"
import { StateBadge, toneClasses } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { AlignControl } from "@/features/shared/align-control"
import { GoalDialog } from "@/features/shared/goal-dialog"
import { goalStatusLabels, readinessLabels } from "@/lib/constants"
import { firstName, formatDay } from "@/lib/format"
import type { Goal, GoalStatus, Person, Readiness } from "@/lib/types"
import { actions, workspace } from "@/lib/vantage/store"
import { Disclosure, NoteDialog, readinessLevels } from "../../parts"

const STATUSES = Object.keys(goalStatusLabels) as GoalStatus[]

function isClosed(goal: Goal) {
  return goal.status === "done" || goal.status === "dropped"
}

function History({ goal }: { goal: Goal }) {
  const entries = [...goal.history].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt)
  )
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>Status history</Eyebrow>
      <ol className="flex flex-col gap-1.5">
        {entries.map((h, i) => (
          <li
            key={`${h.recordedAt}-${i}`}
            className="flex flex-wrap items-baseline gap-x-2 text-xs"
          >
            <span className="w-20 shrink-0 text-muted-foreground tabular-nums">
              {formatDay(h.date)}
            </span>
            <span className="font-medium">{goalStatusLabels[h.status]}</span>
            {h.note && (
              <span className="min-w-0 text-muted-foreground">{h.note}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function GoalCard({
  goal,
  name,
  onStatus,
}: {
  goal: Goal
  name: string
  onStatus: (goal: Goal, status: GoalStatus) => void
}) {
  const closed = isClosed(goal)
  const lead = readinessLabels[goal.readiness]
  const doneCount = goal.keyResults.filter((k) => k.done).length
  return (
    <Card className={cn(closed && "bg-muted/30")}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-base leading-snug font-semibold tracking-tight">
              {goal.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              {goal.quarter.replace("-", " ")}
              {goal.description && `. ${goal.description}`}
            </p>
            {!closed && <AlignControl goal={goal} className="mt-1" />}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <StateBadge state={goalStatusLabels[goal.status]} />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Change status of ${goal.title}`}
                  />
                }
              >
                Status <ChevronDownIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Set status</DropdownMenuLabel>
                  {STATUSES.filter((s) => s !== goal.status).map((s) => (
                    <DropdownMenuItem key={s} onClick={() => onStatus(goal, s)}>
                      {goalStatusLabels[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Progress
            value={goal.progress}
            aria-label={`Progress on ${goal.title}`}
            className="flex-1"
          />
          {goal.keyResults.length === 0 && !closed ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={5}
                aria-label={`Progress on ${goal.title}, percent`}
                value={goal.progress}
                onChange={(e) => {
                  const n = e.target.valueAsNumber
                  if (!Number.isFinite(n)) return
                  actions.update("goals", goal.id, {
                    progress: Math.min(100, Math.max(0, Math.round(n))),
                  })
                }}
                className="h-7 w-16 text-right tabular-nums"
              />
              %
            </span>
          ) : (
            <span className="w-10 text-right text-sm font-medium tabular-nums">
              {goal.progress}%
            </span>
          )}
        </div>

        {goal.keyResults.length > 0 && (
          <div className="flex flex-col gap-2">
            <Eyebrow>
              Key results, {doneCount} of {goal.keyResults.length} done
            </Eyebrow>
            <ul className="flex flex-col gap-2">
              {goal.keyResults.map((kr) => {
                const id = `${goal.id}-${kr.id}`
                return (
                  <li key={kr.id} className="flex items-start gap-2.5">
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      checked={kr.done}
                      disabled={closed}
                      onCheckedChange={() =>
                        actions.toggleKeyResult(goal.id, kr.id)
                      }
                    />
                    <label
                      htmlFor={id}
                      className={cn(
                        "text-sm leading-snug",
                        kr.done && "text-muted-foreground line-through"
                      )}
                    >
                      {kr.text}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {!closed && (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-lg border p-3.5",
              toneClasses.brand.badge
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <CompassIcon className="size-3.5" /> How to lead this goal
                </p>
                <p className="font-heading text-lg font-semibold tracking-tight">
                  {lead.style}
                </p>
              </div>
              <ToggleGroup
                aria-label={`Readiness of ${name} on ${goal.title}`}
                value={[goal.readiness]}
                onValueChange={(v) => {
                  const next = v[0] as Readiness | undefined
                  if (!next || next === goal.readiness) return
                  actions.update("goals", goal.id, { readiness: next })
                  toast.success(`Readiness set to ${next}`, {
                    description: `${readinessLabels[next].style}: ${goal.title}`,
                  })
                }}
                variant="outline"
                size="sm"
                className="bg-card"
              >
                {readinessLevels.map((level) => (
                  <ToggleGroupItem
                    key={level}
                    value={level}
                    className="px-2.5 tabular-nums"
                    title={readinessLabels[level].level}
                    aria-label={`${level}: ${readinessLabels[level].level}`}
                  >
                    {level}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {lead.guidance}
            </p>
            <p className="text-xs text-muted-foreground">
              {name} on this goal: {goal.readiness}, {lead.level.toLowerCase()}.
              Readiness is set per goal, so change it as they grow into the
              work.
            </p>
          </div>
        )}

        <History goal={goal} />
      </CardContent>
    </Card>
  )
}

/** Goals with the situational guidance for leading each one. */
export function GoalsTab({ person }: { person: Person }) {
  const ws = workspace.use()
  const [adding, setAdding] = React.useState(false)
  const [pending, setPending] = React.useState<{
    goal: Goal
    status: GoalStatus
  } | null>(null)
  const name = firstName(person.name)
  const goals = ws.goals
    .filter((g) => g.personId === person.id)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
  const active = goals.filter((g) => !isClosed(g))
  const closed = goals.filter(isClosed)
  const onStatus = (goal: Goal, status: GoalStatus) =>
    setPending({ goal, status })

  const addButton = (
    <Button
      size="sm"
      onClick={() => setAdding(true)}
      disabled={person.status !== "active"}
    >
      <TargetIcon /> Add goal
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Active goals"
        count={active.length}
        description="Each goal carries its own readiness level, which sets how much direction and support you give."
        actions={addButton}
      >
        {active.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<TargetIcon />}
            title="No active goals"
            description={`Add a goal for ${name} and say how ready they are to run it alone.`}
            action={addButton}
          />
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {active.map((g) => (
              <GoalCard key={g.id} goal={g} name={name} onStatus={onStatus} />
            ))}
          </div>
        )}
      </Section>

      {closed.length > 0 && (
        <Disclosure label="Closed goals" count={closed.length}>
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {closed.map((g) => (
              <GoalCard key={g.id} goal={g} name={name} onStatus={onStatus} />
            ))}
          </div>
        </Disclosure>
      )}

      <GoalDialog open={adding} onOpenChange={setAdding} personId={person.id} />

      <NoteDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending
            ? `Mark as ${goalStatusLabels[pending.status].toLowerCase()}`
            : "Change status"
        }
        description={pending?.goal.title}
        label="Note (optional)"
        placeholder="What changed since the last update?"
        hint="Saved in the status history with today's date."
        submitLabel="Save status"
        onSubmit={(note) => {
          if (!pending) return
          actions.setGoalStatus(
            pending.goal.id,
            pending.status,
            note || undefined
          )
          toast.success(
            `Goal marked ${goalStatusLabels[pending.status].toLowerCase()}`,
            { description: pending.goal.title }
          )
        }}
      />
    </div>
  )
}
