"use client"

import Link from "next/link"
import {
  ArrowRightIcon,
  GaugeIcon,
  MessageSquareIcon,
  OctagonAlertIcon,
  TargetIcon,
  TrendingUpIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CountPill } from "@/components/shared/count-pill"
import { Eyebrow } from "@/components/shared/eyebrow"
import { StateBadge, StatusDot } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { PersonChip } from "@/features/shared/person"
import { meetingTypeLabels } from "@/lib/constants"
import { firstName, formatDay, formatMinutes, formatTime } from "@/lib/format"
import type { Brief, BriefChange } from "@/lib/vantage/brief"
import { nudgeKindLabels, type NudgeSeverity } from "@/lib/vantage/nudges"
import { actions } from "@/lib/vantage/store"

import { severityLabels } from "./severity"

const pillarMarkers: Record<
  BriefChange["pillar"],
  { label: string; icon: LucideIcon }
> = {
  goal: { label: "Goal", icon: TargetIcon },
  blocker: { label: "Blocker", icon: OctagonAlertIcon },
  career: { label: "Career", icon: TrendingUpIcon },
  feedback: { label: "Feedback", icon: MessageSquareIcon },
  workload: { label: "Workload", icon: GaugeIcon },
}

function Block({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Eyebrow as="h3">{title}</Eyebrow>
        {count !== undefined && count > 0 && <CountPill count={count} />}
      </div>
      {children}
    </div>
  )
}

function checkOff(id: string, text: string) {
  actions.setCommitmentStatus(id, "done")
  toast.success("Commitment marked done", {
    description: text,
    action: {
      label: "Undo",
      onClick: () => actions.setCommitmentStatus(id, "open"),
    },
  })
}

/** Everything worth knowing before one 1:1, readable in a few seconds. */
export function BriefCard({ brief }: { brief: Brief }) {
  const { meeting, person, carried, changes, questions, nudges } = brief
  const name = firstName(person.name)
  const href = `/meetings/${meeting.id}`

  return (
    <Card data-testid="brief-card" className="h-full">
      <CardHeader>
        <CardTitle>
          <PersonChip personId={person.id} size="md" showRole />
        </CardTitle>
        <CardAction>
          <Button size="sm" nativeButton={false} render={<Link href={href} />}>
            Open 1:1
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardAction>
        <div className="col-span-full flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {formatTime(meeting.scheduledAt)}
          </span>
          <span aria-hidden>·</span>
          <span>{formatMinutes(meeting.durationMin)}</span>
          <StateBadge
            state={meetingTypeLabels[meeting.type]}
            tone={meeting.type === "weekly" ? "neutral" : "info"}
            size="sm"
            dot={false}
          />
          {meeting.status === "in-progress" && (
            <StateBadge state="In progress" size="sm" pulse />
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <Block title="Carried over" count={carried.length}>
          {carried.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing open between you and {name}.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {carried.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <Checkbox
                    className="mt-0.5"
                    checked={false}
                    aria-label={`Mark done: ${c.text}`}
                    onCheckedChange={() => checkOff(c.id, c.text)}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm leading-snug">{c.text}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <StateBadge
                        state={c.owner === "manager" ? "You owe" : "They owe"}
                        size="sm"
                        dot={false}
                      />
                      {c.overdue && <StateBadge state="Overdue" size="sm" />}
                      {c.dueDate && !c.overdue && (
                        <span>Due {formatDay(c.dueDate)}</span>
                      )}
                      {c.carries > 0 && (
                        <span>
                          {c.carries === 1
                            ? "Carried through one 1:1"
                            : `Carried through ${c.carries} 1:1s`}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Since last time" count={changes.length}>
          {changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {brief.lastHeldDay
                ? `Nothing changed on the record since ${formatDay(brief.lastHeldDay)}.`
                : `This is your first 1:1 with ${name} on the record.`}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {changes.map((change, i) => {
                const marker = pillarMarkers[change.pillar]
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground"
                      title={marker.label}
                    >
                      <marker.icon className="size-3.5" aria-hidden />
                      <span className="sr-only">{marker.label}:</span>
                    </span>
                    <span className="min-w-0 leading-snug">{change.text}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Block>

        <Block title="Worth asking">
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              The suggested questions are already on the agenda.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {questions.map((q) => (
                <li key={q.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm leading-snug">{q.text}</p>
                  {q.purpose && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {q.purpose}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Block>

        {!brief.hasReportAgenda && (
          <p className="rounded-lg border border-dashed px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              Their agenda is empty.
            </span>{" "}
            <Link
              href={href}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Open the 1:1 to ask {name} for their top item
            </Link>
            .
          </p>
        )}

        {nudges.length > 0 && (
          <Block title="On your radar" count={nudges.length}>
            <ul className="flex flex-col gap-1.5">
              {nudges.map((n) => (
                <li key={n.id} className="flex items-start gap-2 text-sm">
                  <StatusDot
                    tone={severityTone[n.severity]}
                    label={severityLabels[n.severity]}
                    className="mt-1.5"
                  />
                  <span className="min-w-0 leading-snug">
                    <span className="text-muted-foreground">
                      {nudgeKindLabels[n.kind]}:{" "}
                    </span>
                    <Link
                      href={n.href}
                      className="underline-offset-4 hover:underline"
                    >
                      {n.title}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </Block>
        )}
      </CardContent>
    </Card>
  )
}

const severityTone: Record<NudgeSeverity, "danger" | "warning" | "info"> = {
  danger: "danger",
  warning: "warning",
  info: "info",
}
