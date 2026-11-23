"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  Building2Icon,
  FlagIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  WaypointsIcon,
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
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { PageHeader, Section } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { AlignControl } from "@/features/shared/align-control"
import { ObjectiveDialog } from "@/features/shared/objective-dialog"
import { PersonChip } from "@/features/shared/person"
import { useQueryParam } from "@/hooks/use-query-param"
import { goalStatusLabels } from "@/lib/constants"
import { firstName, formatPercent, plural } from "@/lib/format"
import type { Goal, GoalStatus, Objective, ObjectiveLevel } from "@/lib/types"
import {
  buildAlignment,
  type ObjectiveSupport,
  type PersonAlignment,
} from "@/lib/vantage/alignment"
import { actions, workspace } from "@/lib/vantage/store"

const STATUSES = Object.keys(goalStatusLabels) as GoalStatus[]

type Editor =
  | { mode: "add"; level: ObjectiveLevel; parentId?: string }
  | { mode: "edit"; objective: Objective }

/** Status, edit and remove for one objective. */
function ObjectiveMenu({
  objective,
  onEdit,
  onRemove,
}: {
  objective: Objective
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${objective.title}`}
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Set status</DropdownMenuLabel>
          {STATUSES.filter((s) => s !== objective.status).map((s) => (
            <DropdownMenuItem
              key={s}
              onClick={() => {
                actions.setObjectiveStatus(objective.id, s)
                toast.success(
                  `Goal marked ${goalStatusLabels[s].toLowerCase()}`,
                  { description: objective.title }
                )
              }}
            >
              {goalStatusLabels[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onEdit}>
          <PencilIcon />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onRemove}>
          <Trash2Icon />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** One team goal under the manager goal it supports. */
function SupportingGoal({ goal }: { goal: Goal }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2">
      <PersonChip personId={goal.personId} className="w-40 shrink-0" />
      <Link
        href={`/people/profile?id=${goal.personId}&tab=goals`}
        className="min-w-0 flex-1 basis-56 rounded-sm text-sm leading-snug underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        {goal.title}
      </Link>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatPercent(goal.progress)}
        </span>
        <StateBadge state={goalStatusLabels[goal.status]} />
      </span>
    </li>
  )
}

/** One of the manager's goals with the team goals behind it. */
function ManagerGoal({
  support,
  onEdit,
  onRemove,
}: {
  support: ObjectiveSupport
  onEdit: (o: Objective) => void
  onRemove: (o: Objective) => void
}) {
  const { objective, goals, people, progress, atRisk } = support
  return (
    <li
      aria-label={objective.title}
      className="flex flex-col gap-2 border-l-2 border-primary/40 py-1 pl-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-64">
          <Eyebrow>My goal</Eyebrow>
          <h4 className="mt-0.5 text-sm leading-snug font-semibold text-pretty">
            {objective.title}
          </h4>
          {objective.measure && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Measured by: {objective.measure}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StateBadge state={goalStatusLabels[objective.status]} />
          <ObjectiveMenu
            objective={objective}
            onEdit={() => onEdit(objective)}
            onRemove={() => onRemove(objective)}
          />
        </div>
      </div>
      {goals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
          No one on the team has a goal that supports this yet. Tie a goal to it
          under &quot;Each person&apos;s line of sight&quot; below, or raise it
          in your next 1:1s.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Progress
              value={progress ?? 0}
              aria-label={`Team progress toward ${objective.title}`}
              className="w-40 max-w-full"
            />
            <span>
              <span className="font-medium text-foreground tabular-nums">
                {formatPercent(progress ?? 0)}
              </span>{" "}
              across {plural(goals.length, "goal")} from{" "}
              {plural(people.length, "person", "people")}
              {atRisk > 0 && `, ${atRisk} at risk or off track`}
            </span>
          </div>
          <ul
            aria-label={`Team goals that support ${objective.title}`}
            className="divide-y divide-border/70"
          >
            {goals.map((g) => (
              <SupportingGoal key={g.id} goal={g} />
            ))}
          </ul>
        </>
      )}
    </li>
  )
}

/** A person's goals, split by whether they support one of the manager's. */
function PersonLine({ row }: { row: PersonAlignment }) {
  const { person, aligned, unaligned, objectives } = row
  const total = aligned.length + unaligned.length
  const name = firstName(person.name)
  return (
    <li aria-label={person.name} className="flex flex-col gap-2.5 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PersonChip personId={person.id} showRole />
        <span
          className={cn(
            "text-xs tabular-nums",
            total > 0 && aligned.length === 0
              ? "font-medium text-warning-text"
              : "text-muted-foreground"
          )}
        >
          {aligned.length} of {plural(total, "goal")} tied to yours
        </span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          {name} has no active goals.{" "}
          <Link
            href={`/goals?new=1&person=${person.id}`}
            className="text-foreground underline underline-offset-4"
          >
            Add one
          </Link>
        </p>
      ) : (
        <>
          {objectives.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Contributes to: {objectives.map((o) => o.title).join("; ")}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {[...unaligned, ...aligned].map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
              >
                <Link
                  href={`/people/profile?id=${g.personId}&tab=goals`}
                  className="min-w-0 flex-1 basis-56 rounded-sm text-sm leading-snug underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {g.title}
                </Link>
                <AlignControl goal={g} />
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  )
}

export function AlignmentView() {
  const ws = workspace.use()
  const [newParam, setNewParam] = useQueryParam("new")
  const [editor, setEditor] = React.useState<Editor | null>(null)
  const [removing, setRemoving] = React.useState<Objective | null>(null)
  const a = buildAlignment(ws)

  const fromUrl: Editor | null =
    newParam === "business" || newParam === "mine"
      ? { mode: "add", level: newParam === "business" ? "business" : "manager" }
      : null
  const active = editor ?? fromUrl
  const empty = a.business.length === 0 && a.mine.length === 0
  const linkedPeople = a.people.filter((p) => p.aligned.length > 0).length

  const addButtons = (
    <>
      <Button
        variant="outline"
        onClick={() => setEditor({ mode: "add", level: "business" })}
      >
        <Building2Icon />
        Add business goal
      </Button>
      <Button onClick={() => setEditor({ mode: "add", level: "manager" })}>
        <PlusIcon />
        Add my goal
      </Button>
    </>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        nav="/alignment"
        description="Where the business is going, what you are accountable for, and how each person's goals connect to it."
        actions={addButtons}
      />

      {empty ? (
        <EmptyState
          icon={<WaypointsIcon />}
          title="Start with the direction"
          description="Write down the business goals you answer to and your own goals for the period. Then tie each person's goals to the one they support, so everyone can see why their work matters."
          action={<div className="flex flex-wrap gap-2">{addButtons}</div>}
        />
      ) : (
        <>
          <StatGrid columns={4}>
            <StatCard
              label="Business goals"
              value={a.business.length}
              hint={
                a.uncovered.length
                  ? `${a.uncovered.length} with none of your goals behind it`
                  : "Each has one of your goals behind it"
              }
            />
            <StatCard
              label="My goals"
              value={a.mine.length}
              hint={
                a.unsupported.length
                  ? `${a.unsupported.length} with no one on the team behind it`
                  : "Each has team goals behind it"
              }
            />
            <StatCard
              label="Team goals tied to mine"
              value={a.coverage === null ? "n/a" : formatPercent(a.coverage)}
              hint={`${a.alignedGoals.length} of ${plural(a.teamGoals.length, "active goal")}`}
            />
            <StatCard
              label="People with a line of sight"
              value={`${linkedPeople} of ${a.people.length}`}
              hint={
                a.peopleWithoutLink.length
                  ? `Not yet: ${a.peopleWithoutLink.map((p) => firstName(p.name)).join(", ")}`
                  : "Everyone with goals supports one of yours"
              }
            />
          </StatGrid>

          <Section
            title="From the business to the team"
            description="Each business goal, your goals that serve it, and the team goals behind each of yours."
          >
            <div className="flex flex-col gap-4">
              {a.branches.map(({ business, objectives }) => (
                <Card
                  key={business?.id ?? "own"}
                  className="gap-0 py-0"
                  role="group"
                  aria-label={
                    business?.title ?? "My goals outside a business goal"
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border/70 px-4 py-3">
                    <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
                      <span
                        aria-hidden
                        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4"
                      >
                        {business ? <Building2Icon /> : <FlagIcon />}
                      </span>
                      <div className="min-w-0">
                        <Eyebrow>
                          {business ? "Business goal" : "Yours alone"}
                        </Eyebrow>
                        <h3 className="mt-0.5 font-heading text-base leading-snug font-semibold tracking-tight text-pretty">
                          {business?.title ??
                            "My goals outside a business goal"}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {business
                            ? business.measure
                              ? `Measured by: ${business.measure}`
                              : null
                            : "Goals you hold that no business goal asks for, such as growing the team."}
                        </p>
                      </div>
                    </div>
                    {business && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <StateBadge state={goalStatusLabels[business.status]} />
                        <ObjectiveMenu
                          objective={business}
                          onEdit={() =>
                            setEditor({ mode: "edit", objective: business })
                          }
                          onRemove={() => setRemoving(business)}
                        />
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-4">
                    {objectives.length === 0 ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2.5">
                        <p className="text-sm text-muted-foreground">
                          None of your goals serves this yet.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditor({
                              mode: "add",
                              level: "manager",
                              parentId: business?.id,
                            })
                          }
                        >
                          <PlusIcon />
                          Add my goal
                        </Button>
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-5">
                        {objectives.map((support) => (
                          <ManagerGoal
                            key={support.objective.id}
                            support={support}
                            onEdit={(objective) =>
                              setEditor({ mode: "edit", objective })
                            }
                            onRemove={setRemoving}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </Section>

          <Section
            title="Each person's line of sight"
            description="Whether each person can trace a goal of theirs to one of yours. Not every goal has to: a development goal can stand on its own."
            count={a.people.length}
          >
            {a.people.length === 0 ? (
              <EmptyState
                size="sm"
                title="No one on the team yet"
                description="Add a direct report and their goals to see how they connect to yours."
                action={
                  <Button
                    variant="outline"
                    render={<Link href="/people?new=1" />}
                  >
                    Add a person
                  </Button>
                }
              />
            ) : a.mine.length === 0 ? (
              <EmptyState
                size="sm"
                title="Add one of your goals first"
                description="Team goals are tied to your goals, so there is nothing to connect them to yet."
              />
            ) : (
              <Card className="gap-0 py-0">
                <ul className="divide-y divide-border/70">
                  {[...a.people]
                    .sort(
                      (x, y) =>
                        Number(x.aligned.length > 0) -
                          Number(y.aligned.length > 0) ||
                        x.person.name.localeCompare(y.person.name)
                    )
                    .map((row) => (
                      <PersonLine key={row.person.id} row={row} />
                    ))}
                </ul>
              </Card>
            )}
          </Section>
        </>
      )}

      <ObjectiveDialog
        open={active !== null}
        level={active?.mode === "add" ? active.level : undefined}
        parentId={active?.mode === "add" ? active.parentId : undefined}
        objective={active?.mode === "edit" ? active.objective : undefined}
        onOpenChange={(next) => {
          if (next) return
          setEditor(null)
          setNewParam(null)
        }}
      />

      <AlertDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{removing?.title}&quot; will be deleted. Goals that pointed
              at it stay on the record and lose the link. To keep the history,
              set its status to done or dropped instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!removing) return
                actions.removeObjective(removing.id)
                toast.success("Goal removed", { description: removing.title })
                setRemoving(null)
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
