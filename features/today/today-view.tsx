"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarPlusIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleIcon,
  ClipboardListIcon,
  CompassIcon,
  SunriseIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { PageHeader, Section } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
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
import { Card, CardContent } from "@/components/ui/card"
import { PersonChip } from "@/features/shared/person"
import { ScheduleMeetingDialog } from "@/features/shared/schedule-dialog"
import { groundRules, meetingTypeLabels } from "@/lib/constants"
import {
  firstName,
  formatDay,
  formatDayLong,
  formatPercent,
  formatTime,
  plural,
} from "@/lib/format"
import {
  addDays,
  dayOf,
  daysBetween,
  now,
  parseDay,
  startOfWeek,
  today,
} from "@/lib/time"
import type { Meeting, Workspace } from "@/lib/types"
import { briefDay, buildBrief, type Brief } from "@/lib/vantage/brief"
import { cadenceHealth } from "@/lib/vantage/cadence"
import { buildNudges, nudgeKindLabels, type Nudge } from "@/lib/vantage/nudges"
import {
  activePeople,
  followThrough,
  getPerson,
  isOverdue,
} from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { cn } from "cn"

import { BriefCard } from "./brief-card"
import { severityLabels, severityOrder } from "./severity"

function greeting() {
  const hour = now().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export function TodayView() {
  const ws = workspace.use()
  const [scheduling, setScheduling] = React.useState(false)
  const name = firstName(ws.manager.name)
  const title = name ? `${greeting()}, ${name}` : greeting()
  const day = today()

  if (ws.people.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          nav="/today"
          title={title}
          eyebrow={formatDayLong(day)}
          size="lg"
          description="Your workspace is empty. Add the people who report to you and the brief for each 1:1 will appear here."
        />
        <FirstRun />
      </div>
    )
  }

  const people = activePeople(ws)
  const brief = briefDay(ws)
  const briefs = brief.meetings
    .map((m) => buildBrief(ws, m))
    .filter((b): b is Brief => !!b)
  const nudges = buildNudges(ws)
  const mine = ws.commitments.filter(
    (c) => c.owner === "manager" && c.status === "open"
  )
  const mineOverdue = mine.filter(isOverdue)
  const follow = followThrough(ws.commitments, "manager")
  const overduePeople = people.filter(
    (p) => cadenceHealth(p, ws.meetings).state === "overdue"
  ).length
  const todayCount = brief.isToday ? briefs.length : 0

  const summary = [
    todayCount
      ? `${plural(todayCount, "conversation")} today`
      : "No conversations today",
    `${plural(mine.length, "thing")} you owe`,
    `${plural(overduePeople, "person", "people")} overdue for a 1:1`,
  ].join(", ")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        nav="/today"
        title={title}
        eyebrow={formatDayLong(day)}
        size="lg"
        description={`${summary}.`}
        actions={
          <Button variant="outline" onClick={() => setScheduling(true)}>
            <CalendarPlusIcon data-icon="inline-start" />
            Schedule a 1:1
          </Button>
        }
      />

      {ws.settings.sampleData && <SampleBanner />}

      <StatGrid columns={5}>
        <StatCard
          label={
            brief.isToday ? "1:1s today" : `1:1s on ${formatDay(brief.day)}`
          }
          value={briefs.length}
          hint={
            briefs.length
              ? `First at ${formatTime(briefs[0].meeting.scheduledAt)}`
              : "Nothing on the calendar"
          }
          href="/meetings?view=upcoming"
        />
        <StatCard
          label="Open, you owe"
          value={mine.length}
          hint={`Across ${plural(new Set(mine.map((c) => c.personId)).size, "person", "people")}`}
          href="/commitments?owner=manager"
        />
        <StatCard
          label="Overdue, yours"
          value={mineOverdue.length}
          hint={
            mineOverdue.length ? "Past the date you gave" : "Nothing past due"
          }
          href="/commitments?owner=manager"
        />
        <StatCard
          label="Nudges"
          value={nudges.length}
          hint={
            nudges.length
              ? `${nudges.filter((n) => n.severity === "danger").length} urgent`
              : "All clear"
          }
        />
        <StatCard
          label="Your follow-through"
          value={follow.rate === null ? "n/a" : formatPercent(follow.rate)}
          hint={
            follow.rate === null
              ? "Nothing has come due yet"
              : `${follow.done} kept, ${follow.missed} past due`
          }
        />
      </StatGrid>

      <Section
        id="brief"
        title={
          brief.isToday
            ? "Today's brief"
            : `Next up: ${formatDayLong(brief.day)}`
        }
        description={
          briefs.length === 0
            ? undefined
            : brief.isToday
              ? "What you promised, what changed and what to ask, for each conversation."
              : "There is nothing on the calendar today. This is the brief for your next day of 1:1s."
        }
        count={briefs.length || undefined}
      >
        {briefs.length === 0 ? (
          <EmptyState
            icon={<SunriseIcon />}
            title="No 1:1s on the calendar"
            description="Schedule a conversation and its brief shows up here on the day."
            action={
              <Button onClick={() => setScheduling(true)}>
                Schedule a 1:1
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {briefs.map((b) => (
              <BriefCard key={b.meeting.id} brief={b} />
            ))}
          </div>
        )}
      </Section>

      <Section
        id="attention"
        title="Needs your attention"
        description="Raised by the record, most urgent first. Dismiss one when it is handled."
        count={nudges.length || undefined}
      >
        {nudges.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<CheckCircle2Icon />}
            title="All clear"
            description="Nothing on the record needs you right now."
          />
        ) : (
          <div className="flex flex-col gap-5">
            {severityOrder.map((severity) => {
              const group = nudges.filter((n) => n.severity === severity)
              if (group.length === 0) return null
              return (
                <div
                  key={severity}
                  className="flex flex-col gap-2"
                  data-testid={`nudges-${severity}`}
                >
                  <div className="flex items-center gap-2">
                    <StateBadge state={severityLabels[severity]} />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {group.length}
                    </span>
                  </div>
                  <Card className="py-0">
                    <ul className="divide-y">
                      {group.map((n) => (
                        <NudgeRow key={n.id} nudge={n} ws={ws} />
                      ))}
                    </ul>
                  </Card>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <WeekStrip ws={ws} />

      <GroundRule />

      <ScheduleMeetingDialog open={scheduling} onOpenChange={setScheduling} />
    </div>
  )
}

/* ------------------------------------------------------------------ nudges */

function NudgeRow({ nudge, ws }: { nudge: Nudge; ws: Workspace }) {
  const person = nudge.personId ? getPerson(ws, nudge.personId) : undefined
  return (
    <li
      data-testid="nudge"
      className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-start md:justify-between md:gap-6"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Eyebrow as="span">{nudgeKindLabels[nudge.kind]}</Eyebrow>
          {person && (
            <PersonChip
              personId={person.id}
              size="xs"
              className="text-muted-foreground"
            />
          )}
        </div>
        <p className="text-sm leading-snug font-medium">{nudge.title}</p>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {nudge.detail}
        </p>
        {nudge.basis && (
          <p className="text-2xs text-muted-foreground">
            Based on: {nudge.basis}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={nudge.href} />}
        >
          {nudge.actionLabel}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Dismiss: ${nudge.title}`}
          onClick={() => actions.dismissNudge(nudge.id)}
        >
          Dismiss
        </Button>
      </div>
    </li>
  )
}

/* --------------------------------------------------------------- this week */

const weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

function meetingMark(m: Meeting) {
  if (m.status === "completed")
    return {
      label: "Held",
      icon: <CheckIcon className="size-3.5 text-success-text" />,
    }
  if (m.status === "cancelled")
    return {
      label: "Cancelled",
      icon: <XIcon className="size-3.5 text-danger-text" />,
    }
  return {
    label: m.status === "in-progress" ? "In progress" : "Scheduled",
    icon: <CircleIcon className="size-3 text-info-text" />,
  }
}

function WeekStrip({ ws }: { ws: Workspace }) {
  const day = today()
  const monday = startOfWeek(day)
  const days = weekdayNames.map((label, i) => {
    const date = addDays(monday, i)
    return {
      label,
      date,
      meetings: ws.meetings
        .filter((m) => dayOf(m.scheduledAt) === date)
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    }
  })
  const all = days.flatMap((d) => d.meetings)
  const held = all.filter((m) => m.status === "completed").length
  const cancelled = all.filter((m) => m.status === "cancelled").length
  const ahead = all.length - held - cancelled

  return (
    <Section
      id="week"
      title="This week"
      description={
        all.length
          ? `${held} held, ${ahead} still to come, ${cancelled} cancelled.`
          : "No 1:1s Monday to Friday."
      }
      actions={
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<Link href="/meetings?view=week" />}
        >
          Open the week
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      }
    >
      <Card className="py-0">
        <ol className="grid divide-y md:grid-cols-5 md:divide-x md:divide-y-0">
          {days.map((d) => {
            const isToday = d.date === day
            return (
              <li
                key={d.date}
                data-testid="week-day"
                className={cn(
                  "flex min-w-0 flex-col gap-2 px-3 py-3",
                  isToday && "bg-muted/40"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      !isToday && "text-muted-foreground"
                    )}
                  >
                    {d.label}{" "}
                    <span className="font-normal text-muted-foreground tabular-nums">
                      {formatDay(d.date)}
                    </span>
                  </span>
                  {isToday && (
                    <StateBadge state="Today" size="sm" dot={false} />
                  )}
                </div>
                {d.meetings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No 1:1s</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {d.meetings.map((m) => {
                      const mark = meetingMark(m)
                      const person = getPerson(ws, m.personId)
                      return (
                        <li key={m.id}>
                          <Link
                            href={`/meetings/session?id=${m.id}`}
                            title={`${mark.label}: ${meetingTypeLabels[m.type]}`}
                            className="flex items-center gap-1.5 rounded-md text-xs outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="inline-flex size-4 shrink-0 items-center justify-center">
                              {mark.icon}
                            </span>
                            <span className="sr-only">{mark.label}:</span>
                            <span
                              className={cn(
                                "min-w-0 truncate",
                                m.status === "cancelled" &&
                                  "text-muted-foreground line-through"
                              )}
                            >
                              <span className="text-muted-foreground tabular-nums">
                                {formatTime(m.scheduledAt)}
                              </span>{" "}
                              {person ? firstName(person.name) : "Removed"}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </Card>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted-foreground">
        <li className="flex items-center gap-1">
          <CheckIcon className="size-3 text-success-text" aria-hidden /> Held
        </li>
        <li className="flex items-center gap-1">
          <CircleIcon className="size-2.5 text-info-text" aria-hidden />{" "}
          Scheduled
        </li>
        <li className="flex items-center gap-1">
          <XIcon className="size-3 text-danger-text" aria-hidden /> Cancelled
        </li>
      </ul>
    </Section>
  )
}

/* ------------------------------------------------------------- ground rule */

function GroundRule() {
  const day = today()
  const dayOfYear = daysBetween(`${parseDay(day).getFullYear()}-01-01`, day)
  const rule = groundRules[dayOfYear % groundRules.length]
  return (
    <Card size="sm" className="bg-muted/30" data-testid="ground-rule">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Eyebrow>Ground rule for today</Eyebrow>
          <p className="text-sm font-medium">{rule.title}</p>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {rule.body}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 self-start sm:self-center"
          nativeButton={false}
          render={<Link href="/playbook" />}
        >
          <BookOpenIcon data-icon="inline-start" />
          Open the playbook
        </Button>
      </CardContent>
    </Card>
  )
}

/* ----------------------------------------------------- sample and first run */

function SampleBanner() {
  const router = useRouter()
  const [confirming, setConfirming] = React.useState(false)
  return (
    <div
      role="note"
      className="flex flex-col gap-2 rounded-lg border bg-muted/40 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-muted-foreground">
        This is a sample team so you can look around.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="self-start sm:self-auto"
        onClick={() => setConfirming(true)}
      >
        Start with my own team
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the sample team?</AlertDialogTitle>
            <AlertDialogDescription>
              Every sample person, 1:1, commitment and note is removed from this
              browser. Your name and settings stay. You can load the sample team
              again later from Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep looking around</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                actions.clearAll()
                setConfirming(false)
                router.push("/people?new=1")
              }}
            >
              Clear and start
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const firstRunPoints = [
  {
    icon: <UsersIcon />,
    title: "One record per person",
    body: "Commitments, goals, blockers, feedback, career, workload and retention, kept in one place for each direct report.",
  },
  {
    icon: <ClipboardListIcon />,
    title: "A brief before every 1:1",
    body: "What each of you promised, what changed since last time and two or three questions worth asking.",
  },
  {
    icon: <CompassIcon />,
    title: "Nudges when something drifts",
    body: "A skipped 1:1, a promise past its date or a blocker that keeps coming back is raised before it costs trust.",
  },
]

function FirstRun() {
  return (
    <Card data-testid="first-run">
      <CardContent className="flex flex-col gap-6 py-4">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Welcome to Vantage
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A workspace for running 1:1s and keeping a running record for each
            person who reports to you. Everything stays in this browser.
          </p>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {firstRunPoints.map((point) => (
            <li
              key={point.title}
              className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-4"
            >
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-card text-muted-foreground ring-1 ring-border/70 [&_svg]:size-4">
                {point.icon}
              </span>
              <p className="text-sm font-medium">{point.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {point.body}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Button nativeButton={false} render={<Link href="/people?new=1" />}>
            Add your first person
          </Button>
          <Button variant="outline" onClick={() => actions.loadSample()}>
            Load the sample team
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
