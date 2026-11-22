"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BriefcaseIcon,
  CalendarPlusIcon,
  ChevronLeftIcon,
  ClockIcon,
  ListPlusIcon,
  MapPinIcon,
  MessageSquarePlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { useQueryParam } from "@/hooks/use-query-param"
import { MetaItem } from "@/components/record/record-header"
import { RecordNotFound } from "@/components/record/record-not-found"
import { CountPill } from "@/components/shared/count-pill"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { StateBadge } from "@/components/shared/status-badge"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CommitmentDialog } from "@/features/shared/commitment-dialog"
import { FeedbackComposer } from "@/features/shared/feedback-composer"
import { ScheduleMeetingDialog } from "@/features/shared/schedule-dialog"
import { focusLabels, workModeLabels } from "@/lib/constants"
import { firstName, formatDay, formatTenure } from "@/lib/format"
import type { Person, Workspace } from "@/lib/types"
import { cadenceHealth, cadenceStateLabels } from "@/lib/vantage/cadence"
import {
  getPerson,
  openCommitments,
  upcomingMeetings,
} from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { cadenceSentence } from "../parts"
import { EditPersonSheet } from "./edit-person-sheet"
import { BlockersTab } from "./tabs/blockers-tab"
import { CareerTab } from "./tabs/career-tab"
import { CommitmentsTab } from "./tabs/commitments-tab"
import { FeedbackTab } from "./tabs/feedback-tab"
import { GoalsTab } from "./tabs/goals-tab"
import { MeetingsTab } from "./tabs/meetings-tab"
import { OverviewTab } from "./tabs/overview-tab"
import { RetentionTab } from "./tabs/retention-tab"
import { TimelineTab } from "./tabs/timeline-tab"
import { WellbeingTab } from "./tabs/wellbeing-tab"

interface ProfileTab {
  value: string
  label: string
  count?: number
  Component: React.ComponentType<{ person: Person }>
}

function profileTabs(ws: Workspace, id: string): ProfileTab[] {
  const mine = <T extends { personId: string }>(list: T[]) =>
    list.filter((x) => x.personId === id)
  return [
    { value: "overview", label: "Overview", Component: OverviewTab },
    {
      value: "meetings",
      label: "1:1s",
      count: upcomingMeetings(ws, id).length,
      Component: MeetingsTab,
    },
    {
      value: "commitments",
      label: "Commitments",
      count: openCommitments(ws, id).length,
      Component: CommitmentsTab,
    },
    {
      value: "goals",
      label: "Goals",
      count: mine(ws.goals).filter(
        (g) => g.status !== "done" && g.status !== "dropped"
      ).length,
      Component: GoalsTab,
    },
    {
      value: "blockers",
      label: "Blockers",
      count: mine(ws.blockers).filter((b) => b.status !== "resolved").length,
      Component: BlockersTab,
    },
    {
      value: "feedback",
      label: "Feedback",
      count: mine(ws.feedback).length,
      Component: FeedbackTab,
    },
    {
      value: "career",
      label: "Career",
      count: mine(ws.milestones).filter((m) => !m.validTo).length,
      Component: CareerTab,
    },
    {
      value: "wellbeing",
      label: "Wellbeing",
      count: mine(ws.workloadMarkers).filter((m) => !m.resolvedDate).length,
      Component: WellbeingTab,
    },
    {
      value: "retention",
      label: "Retention",
      count: mine(ws.stayDrivers).filter((d) => !d.validTo).length,
      Component: RetentionTab,
    },
    { value: "timeline", label: "Timeline", Component: TimelineTab },
  ]
}

type OpenDialog = "schedule" | "commitment" | "feedback" | "edit" | "remove"

/** A direct report's record: header, actions and the ten tabs. */
export function ProfileView({ id }: { id: string }) {
  const ws = workspace.use()
  const router = useRouter()
  const [tabParam, setTabParam] = useQueryParam("tab")
  const [dialog, setDialog] = React.useState<OpenDialog | null>(null)
  const person = getPerson(ws, id)

  if (!person) {
    return (
      <RecordNotFound
        number={id}
        backHref="/people"
        backLabel="People"
        description="This person is not in your workspace. They may have been removed, or the link came from another browser."
      />
    )
  }

  const tabs = profileTabs(ws, person.id)
  const active = tabs.some((t) => t.value === tabParam)
    ? (tabParam as string)
    : "overview"
  const archived = person.status === "archived"
  const health = cadenceHealth(person, ws.meetings)
  const name = firstName(person.name)
  const closeOn = (key: OpenDialog) => (open: boolean) =>
    setDialog(open ? key : null)

  function setArchived(next: boolean) {
    if (!person) return
    actions.archivePerson(person.id, next)
    toast.success(
      next ? `${person.name} archived` : `${person.name} restored`,
      {
        description: next
          ? "The record is kept. Scheduled 1:1s were taken off the list."
          : "They are back on your active roster.",
      }
    )
  }

  function remove() {
    if (!person) return
    const removed = person.name
    setDialog(null)
    actions.removePerson(person.id)
    toast.success(`${removed} removed`, {
      description: "Their whole record was deleted from this workspace.",
    })
    router.push("/people")
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 border-b border-border/70 pb-5">
        <Link
          href="/people"
          className="inline-flex items-center gap-1 self-start rounded-md text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeftIcon className="size-3.5" /> People
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <PersonAvatar name={person.name} size="xl" />
            <div className="min-w-0 space-y-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                <h1 className="font-heading text-xl font-semibold tracking-tight md:text-2xl">
                  {person.name}
                </h1>
                {archived && <StateBadge state="Archived" />}
                <StateBadge state={focusLabels[person.focus]} />
                {!archived && (
                  <StateBadge state={cadenceStateLabels[health.state]} />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {[person.role, person.level].filter(Boolean).join(" · ")}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {person.team && (
                  <MetaItem label="Team" icon={<UsersIcon />}>
                    {person.team}
                  </MetaItem>
                )}
                {person.location && (
                  <MetaItem label="Location" icon={<MapPinIcon />}>
                    {person.location}
                  </MetaItem>
                )}
                <MetaItem label="Tenure" icon={<ClockIcon />}>
                  <span title={`Started ${formatDay(person.startDate)}`}>
                    {formatTenure(person.startDate)}
                  </span>
                </MetaItem>
                <MetaItem label="Works" icon={<BriefcaseIcon />}>
                  {workModeLabels[person.workMode]}
                </MetaItem>
              </div>
              <p className="text-xs text-muted-foreground">
                1:1s: {cadenceSentence(person.cadence)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button onClick={() => setDialog("schedule")} disabled={archived}>
              <CalendarPlusIcon /> Schedule 1:1
            </Button>
            <Button
              variant="outline"
              onClick={() => setDialog("commitment")}
              disabled={archived}
            >
              <ListPlusIcon /> Add commitment
            </Button>
            <Button
              variant="outline"
              onClick={() => setDialog("feedback")}
              disabled={archived}
            >
              <MessageSquarePlusIcon /> Write feedback
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="More actions"
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem onClick={() => setDialog("edit")}>
                  <PencilIcon /> Edit details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setArchived(!archived)}>
                  {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                  {archived ? "Restore" : "Archive"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDialog("remove")}
                >
                  <Trash2Icon /> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {archived && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Archived</p>
              <p className="text-xs text-muted-foreground">
                {name} is hidden from Today, nudges and team views. The record
                is kept as it was.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setArchived(false)}
            >
              <ArchiveRestoreIcon /> Restore
            </Button>
          </div>
        )}
      </div>

      <Tabs
        value={active}
        onValueChange={(value) =>
          setTabParam(value === "overview" ? null : String(value))
        }
        className="gap-4"
      >
        <div className="-mx-4 overflow-x-auto px-4 lg:-mx-6 lg:px-6">
          <TabsList
            variant="line"
            aria-label={`Record for ${person.name}`}
            className="h-9 w-full min-w-max justify-start gap-0 border-b p-0"
          >
            {tabs.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="group/tab h-full flex-none rounded-none px-3 pb-2 text-sm after:bottom-0! after:h-0.5 data-active:font-medium"
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <CountPill
                    count={t.count}
                    className="transition-colors group-data-active/tab:bg-foreground group-data-active/tab:text-background"
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {t.value === active && <t.Component person={person} />}
          </TabsContent>
        ))}
      </Tabs>

      <ScheduleMeetingDialog
        open={dialog === "schedule"}
        onOpenChange={closeOn("schedule")}
        personId={person.id}
      />
      <CommitmentDialog
        open={dialog === "commitment"}
        onOpenChange={closeOn("commitment")}
        personId={person.id}
      />
      <FeedbackComposer
        open={dialog === "feedback"}
        onOpenChange={closeOn("feedback")}
        personId={person.id}
      />
      <EditPersonSheet
        person={person}
        open={dialog === "edit"}
        onOpenChange={closeOn("edit")}
      />

      <AlertDialog open={dialog === "remove"} onOpenChange={closeOn("remove")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {person.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes every record for {name}: 1:1s and notes, commitments,
              goals, blockers, feedback, career milestones, pulses, stay
              drivers, coaching cards and review drafts. It cannot be undone. To
              keep the record and hide {name} from active views, archive
              instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep {name}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Remove and delete the record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
