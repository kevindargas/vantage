"use client"

import * as React from "react"
import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  CheckCheckIcon,
  ListChecksIcon,
  PlusIcon,
  RotateCcwIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  actionsColumnMeta,
  DataTable,
  DataTableColumnHeader,
  DateCell,
  EmptyValue,
  type DataTableFeatures,
} from "@/components/data-table"
import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader, Section } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { CommitmentDialog } from "@/features/shared/commitment-dialog"
import { PersonChip, PersonSelect } from "@/features/shared/person"
import { useQueryParam } from "@/hooks/use-query-param"
import { firstName, formatPercent, plural } from "@/lib/format"
import { daysUntil } from "@/lib/time"
import type { AgendaOwner, Commitment, CommitmentStatus } from "@/lib/types"
import {
  activePeople,
  carryCount,
  followThrough,
  getPerson,
  isOverdue,
} from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { CommitmentRow, ownerLabel } from "./commitment-row"

type Urgency = "overdue" | "week" | "later" | "none"

const urgencyGroups: {
  id: Urgency
  title: string
  description: string
  tone: Tone
}[] = [
  {
    id: "overdue",
    title: "Overdue",
    description: "Past the agreed date. Close it, move the date or drop it.",
    tone: "danger",
  },
  {
    id: "week",
    title: "Due this week",
    description: "Due within the next seven days.",
    tone: "warning",
  },
  {
    id: "later",
    title: "Later",
    description: "Due more than a week from now.",
    tone: "muted",
  },
  {
    id: "none",
    title: "No date",
    description: "No date agreed yet. A date makes it a commitment.",
    tone: "muted",
  },
]

function urgencyOf(c: Commitment): Urgency {
  if (!c.dueDate) return "none"
  const days = daysUntil(c.dueDate)
  if (days < 0) return "overdue"
  return days <= 7 ? "week" : "later"
}

function rateLabel(rate: number | null) {
  return rate === null ? "n/a" : formatPercent(rate)
}

const col = createColumnHelper<DataTableFeatures, Commitment>()

const closedColumns = col.columns([
  col.accessor("text", {
    header: "Commitment",
    cell: ({ getValue }) => (
      <span className="line-clamp-2 font-medium">{getValue()}</span>
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { width: "min-w-64 max-w-md" },
  }),
  col.accessor("owner", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Owner" />
    ),
    cell: ({ getValue }) => (
      <StateBadge size="sm" state={ownerLabel(getValue())} />
    ),
    meta: { width: "w-28", label: "Owner" },
  }),
  col.accessor("personId", {
    header: "Person",
    cell: ({ getValue }) => <PersonChip personId={getValue()} size="xs" />,
    enableSorting: false,
    meta: { width: "w-44" },
  }),
  col.accessor("dueDate", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Due" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} mode="absolute" />,
    meta: { width: "w-28", label: "Due" },
  }),
  col.accessor("completedAt", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Closed" />
    ),
    cell: ({ getValue }) =>
      getValue() ? (
        <DateCell value={getValue()} mode="absolute" />
      ) : (
        <EmptyValue />
      ),
    meta: { width: "w-28", label: "Closed" },
  }),
  col.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          actions.setCommitmentStatus(row.original.id, "open")
          toast.success("Commitment reopened", {
            description: row.original.text,
          })
        }}
      >
        <RotateCcwIcon />
        Reopen
      </Button>
    ),
    enableSorting: false,
    enableHiding: false,
    meta: actionsColumnMeta,
  }),
])

export function CommitmentsView() {
  const ws = workspace.use()
  const [newParam, setNewParam] = useQueryParam("new")
  const [ownerParam, setOwnerParam] = useQueryParam("owner")
  const [personParam, setPersonParam] = useQueryParam("person")
  const [adding, setAdding] = React.useState(false)
  const [status, setStatus] = React.useState<CommitmentStatus>("open")

  const people = activePeople(ws)
  const personId =
    personParam && people.some((p) => p.id === personParam)
      ? personParam
      : undefined
  const owner: AgendaOwner | undefined =
    ownerParam === "manager" || ownerParam === "report" ? ownerParam : undefined

  // Everything on the page is scoped to active people and the person filter.
  const scoped = ws.commitments.filter((c) =>
    personId ? c.personId === personId : people.some((p) => p.id === c.personId)
  )
  const open = scoped
    .filter((c) => c.status === "open")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
  const overdue = open.filter(isOverdue)
  const yours = followThrough(scoped, "manager")
  const theirs = followThrough(scoped, "report")
  const carriedTwice = open.filter((c) => carryCount(ws, c) > 1)
  const yoursOverdue = overdue.filter((c) => c.owner === "manager")

  const byOwner = (list: Commitment[]) =>
    owner ? list.filter((c) => c.owner === owner) : list
  const visibleOpen = byOwner(open)
  const done = byOwner(scoped.filter((c) => c.status === "done"))
  const dropped = byOwner(scoped.filter((c) => c.status === "dropped"))
  const scopeName = personId
    ? firstName(getPerson(ws, personId)?.name ?? "")
    : ""

  const dialogOpen = adding || newParam === "1"
  const addButton = (
    <Button onClick={() => setAdding(true)} disabled={people.length === 0}>
      <PlusIcon />
      Add commitment
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        nav="/commitments"
        description="What you owe your people and what they owe you. Your own follow-through is tracked as closely as theirs."
        actions={addButton}
      />

      {people.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title="No one to make commitments with yet"
          description="Add a direct report first. Commitments from your 1:1s will collect here."
          action={
            <Button render={<Link href="/people?new=1" />}>Add a person</Button>
          }
        />
      ) : (
        <>
          <StatGrid columns={5}>
            <StatCard
              label="Open"
              value={open.length}
              hint={`${open.filter((c) => c.owner === "manager").length} yours, ${open.filter((c) => c.owner === "report").length} theirs`}
            />
            <StatCard
              label="Overdue"
              value={overdue.length}
              hint={`${yoursOverdue.length} of them yours`}
            />
            <StatCard
              label="Your follow-through"
              value={rateLabel(yours.rate)}
              hint={`${yours.done} kept, ${yours.missed} overdue`}
            />
            <StatCard
              label="Their follow-through"
              value={rateLabel(theirs.rate)}
              hint={`${theirs.done} kept, ${theirs.missed} overdue`}
            />
            <StatCard
              label="Carried more than once"
              value={carriedTwice.length}
              hint="Open through two or more 1:1s"
            />
          </StatGrid>

          {yoursOverdue.length > 0 && owner !== "manager" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/25 bg-brand/5 px-4 py-3">
              <p className="min-w-0 text-sm">
                <span className="font-medium">
                  You owe {plural(yoursOverdue.length, "overdue commitment")}
                  {scopeName ? ` to ${scopeName}` : ""}.
                </span>{" "}
                <span className="text-muted-foreground">
                  Close them or agree a new date before the next 1:1.
                </span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus("open")
                  setOwnerParam("manager")
                }}
              >
                Show what you owe
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              aria-label="Filter by who owes it"
              variant="outline"
              spacing={0}
              value={[owner ?? "all"]}
              onValueChange={(v) => {
                const next = v[0]
                if (next) setOwnerParam(next === "all" ? null : next)
              }}
            >
              <ToggleGroupItem value="all" className="gap-1.5">
                All
                <CountPill count={open.length} />
              </ToggleGroupItem>
              <ToggleGroupItem value="manager" className="gap-1.5">
                You owe
                <CountPill
                  count={open.filter((c) => c.owner === "manager").length}
                  tone="brand"
                />
              </ToggleGroupItem>
              <ToggleGroupItem value="report" className="gap-1.5">
                They owe
                <CountPill
                  count={open.filter((c) => c.owner === "report").length}
                />
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="w-full sm:w-56">
              <label htmlFor="commitments-person" className="sr-only">
                Filter by person
              </label>
              <PersonSelect
                id="commitments-person"
                value={personId ?? "all"}
                allLabel="Everyone"
                onChange={(v) => setPersonParam(v === "all" ? null : v)}
              />
            </div>
          </div>

          <Tabs
            value={status}
            onValueChange={(v) => setStatus(v as CommitmentStatus)}
            className="gap-4"
          >
            <TabsList aria-label="Filter by status">
              <TabsTrigger value="open" className="px-2.5">
                Open
                <CountPill count={visibleOpen.length} />
              </TabsTrigger>
              <TabsTrigger value="done" className="px-2.5">
                Done
                <CountPill count={done.length} />
              </TabsTrigger>
              <TabsTrigger value="dropped" className="px-2.5">
                Dropped
                <CountPill count={dropped.length} />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open" className="flex flex-col gap-6">
              {visibleOpen.length === 0 ? (
                <EmptyState
                  icon={<CheckCheckIcon />}
                  title={
                    owner === "manager"
                      ? "You owe nothing right now"
                      : "No open commitments"
                  }
                  description={
                    owner || personId
                      ? "Nothing open matches these filters."
                      : "Commitments you add here or in a 1:1 stay listed until they are done or dropped."
                  }
                  action={
                    <Button variant="outline" onClick={() => setAdding(true)}>
                      <PlusIcon />
                      Add commitment
                    </Button>
                  }
                />
              ) : (
                urgencyGroups.map((group) => {
                  const rows = visibleOpen.filter(
                    (c) => urgencyOf(c) === group.id
                  )
                  if (rows.length === 0) return null
                  return (
                    <Section
                      key={group.id}
                      title={
                        <span className="flex items-center gap-2">
                          {group.title}
                          <CountPill
                            count={rows.length}
                            size="default"
                            tone={group.tone}
                          />
                        </span>
                      }
                      description={group.description}
                    >
                      <Card className="py-0">
                        <ul
                          aria-label={group.title}
                          className="divide-y divide-border/70"
                        >
                          {rows.map((c) => (
                            <CommitmentRow key={c.id} commitment={c} />
                          ))}
                        </ul>
                      </Card>
                    </Section>
                  )
                })
              )}
            </TabsContent>

            {(["done", "dropped"] as const).map((key) => (
              <TabsContent key={key} value={key}>
                <DataTable
                  columns={closedColumns}
                  data={key === "done" ? done : dropped}
                  getRowId={(c) => c.id}
                  getSearchText={(c) =>
                    `${c.text} ${getPerson(ws, c.personId)?.name ?? ""}`
                  }
                  searchPlaceholder="Search commitments"
                  initialSorting={[{ id: "completedAt", desc: true }]}
                  totalLabel="commitments"
                  caption={
                    key === "done"
                      ? "Commitments marked done"
                      : "Commitments that were dropped"
                  }
                  emptyIcon={<ListChecksIcon />}
                  emptyTitle={
                    key === "done" ? "Nothing done yet" : "Nothing dropped"
                  }
                  emptyMessage={
                    key === "done"
                      ? "Commitments you tick off appear here and can be reopened."
                      : "Commitments you decide not to do appear here and can be reopened."
                  }
                  pageSize={10}
                />
              </TabsContent>
            ))}
          </Tabs>

          <Section
            title="Follow-through by person"
            description="Kept commitments as a share of those that have come due, on each side of the relationship."
          >
            {ws.settings.worksCouncilMode ? (
              <Card>
                <CardContent className="text-sm text-muted-foreground">
                  Works council mode is on, so commitments are not compared
                  person by person. The team totals above still apply. You can
                  change this in Settings.
                </CardContent>
              </Card>
            ) : (
              <Card className="py-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Person</TableHead>
                      <TableHead className="text-right">Your rate</TableHead>
                      <TableHead className="text-right">Their rate</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                      <TableHead className="pr-4 text-right">Overdue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {people.map((p) => {
                      const mine = followThrough(
                        ws.commitments,
                        "manager",
                        p.id
                      )
                      const their = followThrough(
                        ws.commitments,
                        "report",
                        p.id
                      )
                      const late = mine.missed + their.missed
                      // Flag the rows where you keep fewer promises than they do.
                      const behind =
                        mine.rate !== null &&
                        their.rate !== null &&
                        mine.rate < their.rate
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="pl-4">
                            <PersonChip personId={p.id} size="xs" />
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right tabular-nums",
                              behind && "font-medium text-warning-text"
                            )}
                          >
                            {rateLabel(mine.rate)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {rateLabel(their.rate)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {mine.open + their.open}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "pr-4 text-right tabular-nums",
                              late > 0 && "font-medium text-danger-text"
                            )}
                          >
                            {late}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </Section>
        </>
      )}

      <CommitmentDialog
        open={dialogOpen}
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
