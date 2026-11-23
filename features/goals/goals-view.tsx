"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRightIcon, PlusIcon, TargetIcon, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { PageHeader, Section } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { GoalDialog } from "@/features/shared/goal-dialog"
import { PersonChip, PersonSelect } from "@/features/shared/person"
import { useQueryParam } from "@/hooks/use-query-param"
import { goalStatusLabels, readinessLabels } from "@/lib/constants"
import { firstName, formatPercent } from "@/lib/format"
import { inRange, quarterOf, quarterRange, today } from "@/lib/time"
import type { GoalStatus, Readiness } from "@/lib/types"
import { activePeople, getPerson } from "@/lib/vantage/selectors"
import { workspace } from "@/lib/vantage/store"
import { GoalRow, goalStatuses, isClosed, readinessLevels } from "./goal-row"

const readinessItems = [
  { value: "all", label: "Any readiness" },
  ...readinessLevels.map((level) => ({
    value: level,
    label: `${level}: ${readinessLabels[level].style}`,
  })),
]

export function GoalsView() {
  const ws = workspace.use()
  const [newParam, setNewParam] = useQueryParam("new")
  const [personParam, setPersonParam] = useQueryParam("person")
  const [adding, setAdding] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<GoalStatus | "all">(
    "all"
  )
  const [readiness, setReadiness] = React.useState<Readiness | "all">("all")
  const [includeClosed, setIncludeClosed] = React.useState(false)

  const people = activePeople(ws)
  const personId =
    personParam && people.some((p) => p.id === personParam)
      ? personParam
      : undefined
  const scoped = ws.goals.filter((g) =>
    personId ? g.personId === personId : people.some((p) => p.id === g.personId)
  )
  const active = scoped.filter((g) => !isClosed(g))
  const onTrack = active.filter((g) => g.status === "on-track")
  const atRisk = active.filter((g) => g.status === "at-risk")
  const offTrack = active.filter((g) => g.status === "off-track")
  const quarter = quarterOf(today())
  const range = quarterRange(quarter)
  const closedThisQuarter = scoped.filter(
    (g) =>
      isClosed(g) && !!g.validTo && inRange(g.validTo, range.from, range.to)
  )
  const average = active.length
    ? Math.round(active.reduce((sum, g) => sum + g.progress, 0) / active.length)
    : null

  const statusItems = [
    { value: "all", label: "Any status" },
    ...goalStatuses
      .filter((s) => includeClosed || (s !== "done" && s !== "dropped"))
      .map((s) => ({ value: s, label: goalStatusLabels[s] })),
  ]
  const visible = scoped.filter(
    (g) =>
      (includeClosed || !isClosed(g)) &&
      (statusFilter === "all" || g.status === statusFilter) &&
      (readiness === "all" || g.readiness === readiness)
  )
  const groups = people
    .map((p) => ({
      person: p,
      goals: visible
        .filter((g) => g.personId === p.id)
        .sort(
          (a, b) =>
            Number(isClosed(a)) - Number(isClosed(b)) ||
            a.title.localeCompare(b.title)
        ),
    }))
    .filter((group) => group.goals.length > 0)
  const filtered =
    statusFilter !== "all" || readiness !== "all" || Boolean(personId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        nav="/goals"
        description="Every active goal with its readiness level, so you match direction and support to the goal, not to the person."
        actions={
          <Button
            onClick={() => setAdding(true)}
            disabled={people.length === 0}
          >
            <PlusIcon />
            Add goal
          </Button>
        }
      />

      {people.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="No one to set goals with yet"
          description="Add a direct report first. Their goals will be listed here with a readiness level each."
          action={
            <Button render={<Link href="/people?new=1" />}>Add a person</Button>
          }
        />
      ) : (
        <>
          <StatGrid columns={5}>
            <StatCard label="Active goals" value={active.length} />
            <StatCard label="On track" value={onTrack.length} />
            <StatCard
              label="At risk or off track"
              value={atRisk.length + offTrack.length}
              hint={`${atRisk.length} at risk, ${offTrack.length} off track`}
            />
            <StatCard
              label="Average progress"
              value={average === null ? "n/a" : formatPercent(average)}
              hint="Across active goals"
            />
            <StatCard
              label="Closed this quarter"
              value={closedThisQuarter.length}
              hint={`${closedThisQuarter.filter((g) => g.status === "done").length} done, ${closedThisQuarter.filter((g) => g.status === "dropped").length} dropped`}
            />
          </StatGrid>

          <section
            aria-label="Readiness levels"
            className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border/70 ring-1 ring-foreground/10 lg:grid-cols-4"
          >
            {readinessLevels.map((level) => (
              <div key={level} className="bg-card px-4 py-3">
                <Eyebrow>
                  <span className="font-mono">{level}</span>{" "}
                  {readinessLabels[level].style}
                </Eyebrow>
                <p className="mt-1 text-sm">{readinessLabels[level].level}</p>
              </div>
            ))}
          </section>

          <Section
            title="Goals by person"
            count={visible.length}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="goals-person" className="sr-only">
                  Filter by person
                </label>
                <PersonSelect
                  id="goals-person"
                  className="w-44"
                  value={personId ?? "all"}
                  allLabel="Everyone"
                  onChange={(v) => setPersonParam(v === "all" ? null : v)}
                />
                <Select
                  value={statusFilter}
                  onValueChange={(v) =>
                    v && setStatusFilter(v as GoalStatus | "all")
                  }
                  items={statusItems}
                >
                  <SelectTrigger aria-label="Filter by status" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={readiness}
                  onValueChange={(v) =>
                    v && setReadiness(v as Readiness | "all")
                  }
                  items={readinessItems}
                >
                  <SelectTrigger
                    aria-label="Filter by readiness"
                    className="w-40"
                  >
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
                <label
                  htmlFor="goals-include-closed"
                  className="flex items-center gap-2 text-sm"
                >
                  <Switch
                    id="goals-include-closed"
                    size="sm"
                    checked={includeClosed}
                    onCheckedChange={(checked) => {
                      setIncludeClosed(checked)
                      if (
                        !checked &&
                        (statusFilter === "done" || statusFilter === "dropped")
                      )
                        setStatusFilter("all")
                    }}
                  />
                  Include closed
                </label>
              </div>
            }
          >
            {groups.length === 0 ? (
              <EmptyState
                icon={<TargetIcon />}
                title={filtered ? "No goals match" : "No active goals"}
                description={
                  filtered
                    ? "Nothing matches these filters. Widen them or include closed goals."
                    : "Add a goal and set its readiness level to see how closely to lead it."
                }
                action={
                  <Button variant="outline" onClick={() => setAdding(true)}>
                    <PlusIcon />
                    Add goal
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col gap-4">
                {groups.map(({ person, goals }) => (
                  <Card key={person.id} className="gap-0 py-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <PersonChip personId={person.id} showRole />
                        <CountPill
                          count={goals.length}
                          label={goals.length === 1 ? "goal" : "goals"}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        render={
                          <Link
                            href={`/people/profile?id=${person.id}&tab=goals`}
                          />
                        }
                      >
                        Goals on the record
                        <ArrowRightIcon />
                      </Button>
                    </div>
                    <ul
                      aria-label={`Goals for ${person.name}`}
                      className="divide-y divide-border/70"
                    >
                      {goals.map((goal) => (
                        <GoalRow key={goal.id} goal={goal} />
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Lead it this way"
            description="Active goals by readiness level: where to direct, coach, support or delegate this week."
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {readinessLevels.map((level) => {
                const spec = readinessLabels[level]
                const goals = active.filter((g) => g.readiness === level)
                return (
                  <Card key={level} size="sm" className="gap-3 px-3">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                          <span className="font-mono text-xs text-muted-foreground">
                            {level}
                          </span>{" "}
                          {spec.style}
                        </h3>
                        <CountPill
                          count={goals.length}
                          label={goals.length === 1 ? "goal" : "goals"}
                        />
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {spec.guidance}
                      </p>
                    </div>
                    {goals.length === 0 ? (
                      <p className="border-t border-border/70 pt-3 text-xs text-muted-foreground">
                        No active goals at this level.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2 border-t border-border/70 pt-3">
                        {goals.map((g) => (
                          <li key={g.id} className="min-w-0 text-sm">
                            <Link
                              href={`/people/profile?id=${g.personId}&tab=goals`}
                              className="line-clamp-2 rounded-sm leading-snug underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {g.title}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {firstName(getPerson(ws, g.personId)?.name ?? "")}
                              , {goalStatusLabels[g.status].toLowerCase()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                )
              })}
            </div>
          </Section>
        </>
      )}

      <GoalDialog
        open={adding || newParam === "1"}
        personId={personId}
        onOpenChange={(next) => {
          if (next) return
          setAdding(false)
          setNewParam(null)
        }}
      />
    </div>
  )
}
