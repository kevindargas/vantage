"use client"

import * as React from "react"
import { cn } from "cn"
import { CalendarPlusIcon, CompassIcon, FlagIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { MetricTile } from "@/components/shared/metric-tile"
import { Section } from "@/components/shared/page-header"
import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { ScheduleMeetingDialog } from "@/features/shared/schedule-dialog"
import {
  CAREER_GAP_DAYS,
  careerTrackLabels,
  competencyLabels,
  milestoneKindLabels,
  milestoneStatusLabels,
  ONBOARDING_CHECKPOINTS,
  ONBOARDING_DAYS,
} from "@/lib/constants"
import { dayDistance, firstName, formatDay, plural } from "@/lib/format"
import { addDays, today } from "@/lib/time"
import type {
  CareerTrack,
  CompetencyArea,
  Milestone,
  MilestoneKind,
  MilestoneStatus,
  Person,
} from "@/lib/types"
import { daysSinceCareer } from "@/lib/vantage/nudges"
import { currentAspiration, tenureDays } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import {
  OptionSelect,
  optionsFrom,
  SourceLink,
  validityRange,
} from "./parts/common"

const kindOrder: MilestoneKind[] = [
  "stretch",
  "competency",
  "skill",
  "onboarding",
]
const kindHeadings: Record<MilestoneKind, string> = {
  stretch: "Stretch assignments",
  competency: "Next-level behaviors",
  skill: "Skills",
  onboarding: "Onboarding checkpoints",
}
const statuses = Object.keys(milestoneStatusLabels) as MilestoneStatus[]
const statusTone: Record<MilestoneStatus, Tone> = {
  planned: "muted",
  "in-progress": "progress",
  demonstrated: "success",
}
const competencies = Object.keys(competencyLabels) as CompetencyArea[]
const trackOptions = optionsFrom(careerTrackLabels)
const kindOptions = optionsFrom(milestoneKindLabels)
const competencyOptions = [
  { value: "none" as const, label: "Not tagged" },
  ...optionsFrom(competencyLabels),
]

/** Trajectory and competency milestones for one person. */
export function CareerTab({ person }: { person: Person }) {
  const ws = workspace.use()
  const [aspirationOpen, setAspirationOpen] = React.useState(false)
  const [milestoneOpen, setMilestoneOpen] = React.useState(false)
  const [scheduling, setScheduling] = React.useState(false)
  const name = firstName(person.name)

  const current = currentAspiration(ws, person.id)
  const earlier = ws.aspirations
    .filter((a) => a.personId === person.id && a.id !== current?.id)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
  const milestones = ws.milestones.filter(
    (m) => m.personId === person.id && !m.validTo
  )
  const sinceCareer = daysSinceCareer(ws, person)
  const overdue = sinceCareer >= CAREER_GAP_DAYS
  const groups = kindOrder
    .map((kind) => ({
      kind,
      items: milestones.filter((m) => m.kind === kind),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="flex flex-col gap-6">
      {person.focus === "onboarding" && (
        <OnboardingTrack person={person} milestones={milestones} />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Current aspiration</CardTitle>
            <CardDescription>
              Where {name} wants to go, in their words.
            </CardDescription>
            <CardAction>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAspirationOpen(true)}
              >
                {current ? "Update aspiration" : "Record aspiration"}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {current ? (
              <>
                <p className="text-base leading-relaxed font-medium text-balance">
                  {current.statement}
                </p>
                <DetailList
                  columns={3}
                  dense
                  items={[
                    { label: "Track", value: careerTrackLabels[current.track] },
                    {
                      label: "Target role",
                      value: current.targetRole ?? "Not set",
                    },
                    {
                      label: "Horizon",
                      value: plural(current.horizonMonths, "month"),
                    },
                  ]}
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Recorded {formatDay(current.validFrom)} (
                    {dayDistance(current.validFrom)})
                  </span>
                  <SourceLink meetingId={current.sourceMeetingId} />
                </div>
              </>
            ) : (
              <EmptyState
                bare
                size="sm"
                icon={<CompassIcon />}
                title="No aspiration recorded"
                description={`Ask ${name} where they want to be in a year or two, then record it in their words.`}
              />
            )}
            {earlier.length > 0 && (
              <div className="border-t pt-4">
                <Eyebrow>Aspiration history</Eyebrow>
                <ol className="mt-3 flex flex-col gap-3 border-l pl-4">
                  {earlier.map((a) => (
                    <li key={a.id} className="relative">
                      <span
                        aria-hidden
                        className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-muted-foreground/50 ring-2 ring-card"
                      />
                      <p className="text-xs font-medium text-muted-foreground tabular-nums">
                        Held from {validityRange(a.validFrom, a.validTo)}
                      </p>
                      <p className="text-sm">{a.statement}</p>
                      <p className="text-xs text-muted-foreground">
                        {careerTrackLabels[a.track]}
                        {a.targetRole ? `, toward ${a.targetRole}` : ""}
                      </p>
                      <SourceLink meetingId={a.sourceMeetingId} />
                    </li>
                  ))}
                </ol>
                {current && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    The direction changed on {formatDay(current.validFrom)}.
                    Earlier aspirations stay on the record with the dates they
                    held.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Career conversation</CardTitle>
            <CardDescription>
              Suggested every {CAREER_GAP_DAYS} days, in place of a regular 1:1.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <MetricTile
              label="Days since the last one"
              value={sinceCareer}
              unit={`/ ${CAREER_GAP_DAYS}`}
              tone={overdue ? "warning" : undefined}
              hint={
                overdue
                  ? `Past the ${CAREER_GAP_DAYS} day line. Time to schedule one.`
                  : `${plural(CAREER_GAP_DAYS - sinceCareer, "day")} until one is suggested`
              }
            />
            <Button
              variant={overdue ? "default" : "outline"}
              className="mt-auto w-full"
              onClick={() => setScheduling(true)}
            >
              <CalendarPlusIcon data-icon="inline-start" />
              Schedule career conversation
            </Button>
          </CardContent>
        </Card>
      </div>

      <Section
        title="Competency areas"
        description="Milestones demonstrated in each area, with the dated evidence behind them."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {competencies.map((c) => {
            const inArea = milestones.filter((m) => m.competency === c)
            const shown = inArea.filter((m) => m.status === "demonstrated")
            const notes = inArea.reduce((n, m) => n + m.evidence.length, 0)
            return (
              <MetricTile
                key={c}
                label={competencyLabels[c]}
                value={shown.length}
                unit={`/ ${inArea.length} demonstrated`}
                hint={
                  notes
                    ? plural(notes, "evidence note")
                    : "No evidence notes yet"
                }
              />
            )
          })}
        </div>
      </Section>

      <Section
        title="Milestones"
        count={milestones.length}
        description="Stretch work, next-level behaviors and skills, each with dated evidence."
        actions={
          <Button size="sm" onClick={() => setMilestoneOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Add milestone
          </Button>
        }
      >
        {groups.length === 0 ? (
          <EmptyState
            icon={<FlagIcon />}
            title="No milestones yet"
            description={`Add a stretch assignment, a next-level behavior or a skill ${name} is working toward.`}
            action={
              <Button size="sm" onClick={() => setMilestoneOpen(true)}>
                Add milestone
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <Card key={group.kind} size="sm">
                <CardHeader>
                  <CardTitle className="text-sm">
                    {kindHeadings[group.kind]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col divide-y">
                    {group.items.map((m) => (
                      <MilestoneRow key={m.id} milestone={m} />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <AspirationDialog
        key={`a-${aspirationOpen}`}
        open={aspirationOpen}
        onOpenChange={setAspirationOpen}
        person={person}
        hasCurrent={!!current}
      />
      <MilestoneDialog
        key={`m-${milestoneOpen}`}
        open={milestoneOpen}
        onOpenChange={setMilestoneOpen}
        person={person}
      />
      <ScheduleMeetingDialog
        open={scheduling}
        onOpenChange={setScheduling}
        personId={person.id}
        type="career"
      />
    </div>
  )
}

/* ------------------------------------------------------------- onboarding */

function checkpointMilestone(
  person: Person,
  milestones: Milestone[],
  day: number
) {
  const onboarding = milestones.filter((m) => m.kind === "onboarding")
  const title = new RegExp(`^day\\s*${day}\\b`, "i")
  return (
    onboarding.find((m) => title.test(m.title)) ??
    onboarding.find((m) => m.targetDate === addDays(person.startDate, day))
  )
}

function OnboardingTrack({
  person,
  milestones,
}: {
  person: Person
  milestones: Milestone[]
}) {
  const tenure = tenureDays(person)
  const position = Math.min(100, (tenure / ONBOARDING_DAYS) * 100)
  const name = firstName(person.name)
  return (
    <Card>
      <CardHeader>
        <CardTitle>First {ONBOARDING_DAYS} days</CardTitle>
        <CardDescription>
          {tenure > ONBOARDING_DAYS
            ? `${name} is on day ${tenure}, past the onboarding window.`
            : `${name} is on day ${tenure} of ${ONBOARDING_DAYS}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          role="img"
          aria-label={`Day ${tenure} of ${ONBOARDING_DAYS}`}
          className="relative mx-2 h-8"
        >
          <div className="absolute inset-x-0 top-3 h-1.5 rounded-full bg-muted" />
          <div
            className="absolute top-3 left-0 h-1.5 rounded-full bg-brand"
            style={{ width: `${position}%` }}
          />
          {ONBOARDING_CHECKPOINTS.map((day) => (
            <span
              key={day}
              className={cn(
                "absolute top-2 size-3.5 -translate-x-1/2 rounded-full border-2 border-card",
                tenure >= day ? "bg-brand" : "bg-muted-foreground/40"
              )}
              style={{ left: `${(day / ONBOARDING_DAYS) * 100}%` }}
            />
          ))}
          <span
            className="absolute top-0 h-7.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
            style={{ left: `${position}%` }}
          />
        </div>
        <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ONBOARDING_CHECKPOINTS.map((day) => {
            const m = checkpointMilestone(person, milestones, day)
            const date = addDays(person.startDate, day)
            const next =
              tenure < day &&
              !ONBOARDING_CHECKPOINTS.some((d) => d < day && tenure < d)
            return (
              <li
                key={day}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg border px-3 py-2.5",
                  next ? "border-brand/40 bg-brand/5" : "bg-muted/30"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-sm font-semibold">Day {day}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDay(date)}
                  </span>
                </div>
                {m ? (
                  <>
                    <StateBadge
                      size="sm"
                      state={milestoneStatusLabels[m.status]}
                      tone={statusTone[m.status]}
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {m.title.replace(/^day\s*\d+\s*:\s*/i, "")}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      No milestone set for this checkpoint.
                    </p>
                    <Button
                      size="xs"
                      variant="outline"
                      className="w-fit"
                      onClick={() => {
                        actions.addMilestone({
                          personId: person.id,
                          kind: "onboarding",
                          title: `Day ${day}: checkpoint`,
                          targetDate: date,
                        })
                        toast.success(`Day ${day} checkpoint added`)
                      }}
                    >
                      Add day {day} checkpoint
                    </Button>
                  </>
                )}
                <span className="text-2xs text-muted-foreground">
                  {tenure >= day
                    ? "Passed"
                    : `In ${plural(day - tenure, "day")}`}
                </span>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------- milestones */

function MilestoneRow({ milestone: m }: { milestone: Milestone }) {
  const [adding, setAdding] = React.useState(false)
  const [note, setNote] = React.useState("")
  const late =
    m.status !== "demonstrated" && !!m.targetDate && m.targetDate < today()

  function addEvidence(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    actions.addMilestoneEvidence(m.id, note)
    toast.success("Evidence added to the milestone")
    setNote("")
    setAdding(false)
  }

  return (
    <li className="flex flex-col gap-2.5 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{m.title}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <StateBadge
              size="sm"
              state={milestoneStatusLabels[m.status]}
              tone={statusTone[m.status]}
            />
            {m.competency && <span>{competencyLabels[m.competency]}</span>}
            {m.targetDate && (
              <span className={late ? "text-warning-text" : undefined}>
                Target {formatDay(m.targetDate)}
                {late ? ", now past" : ""}
              </span>
            )}
            <SourceLink meetingId={m.sourceMeetingId} />
          </div>
        </div>
        <NativeSelect
          size="sm"
          aria-label={`Status of ${m.title}`}
          value={m.status}
          onChange={(e) => {
            const next = e.target.value as MilestoneStatus
            actions.setMilestoneStatus(m.id, next)
            toast.success(
              `Milestone marked ${milestoneStatusLabels[next].toLowerCase()}`
            )
          }}
          className="shrink-0"
        >
          {statuses.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {milestoneStatusLabels[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {m.evidence.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg bg-muted/40 px-3 py-2">
          {m.evidence.map((ev, i) => (
            <li key={`${ev.date}-${i}`} className="flex gap-2 text-xs">
              <span className="w-14 shrink-0 text-muted-foreground tabular-nums">
                {formatDay(ev.date)}
              </span>
              <span>{ev.note}</span>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form onSubmit={addEvidence} className="flex flex-wrap gap-2">
          <Input
            autoFocus
            aria-label={`Evidence for ${m.title}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What you saw, in one line"
            className="h-7 min-w-40 flex-1"
          />
          <Button type="submit" size="sm" disabled={!note.trim()}>
            Save evidence
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setAdding(false)}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          size="xs"
          variant="ghost"
          className="w-fit text-muted-foreground"
          onClick={() => setAdding(true)}
        >
          <PlusIcon />
          Add evidence
        </Button>
      )}
    </li>
  )
}

/* ----------------------------------------------------------------- dialogs */

function AspirationDialog({
  open,
  onOpenChange,
  person,
  hasCurrent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: Person
  hasCurrent: boolean
}) {
  const [statement, setStatement] = React.useState("")
  const [track, setTrack] = React.useState<CareerTrack>("ic")
  const [targetRole, setTargetRole] = React.useState("")
  const [horizon, setHorizon] = React.useState("18")
  const name = firstName(person.name)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!statement.trim()) return
    actions.setAspiration({
      personId: person.id,
      statement,
      track,
      targetRole,
      horizonMonths: Math.max(1, Number(horizon) || 18),
    })
    toast.success("Aspiration recorded", {
      description: hasCurrent
        ? "The previous one moved to history."
        : undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>
              {hasCurrent ? "Update aspiration" : "Record aspiration"}
            </DialogTitle>
            <DialogDescription>
              {hasCurrent
                ? `The previous aspiration is kept in history with the dates it held. It is closed today, not overwritten, so the change of direction stays on ${name}'s record.`
                : `Write it the way ${name} said it. A later change adds a new entry and keeps this one in history.`}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="asp-statement">Aspiration</FieldLabel>
              <Textarea
                id="asp-statement"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder="Lead technical work that spans several teams"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="asp-track">Track</FieldLabel>
                <OptionSelect
                  id="asp-track"
                  value={track}
                  onChange={setTrack}
                  options={trackOptions}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="asp-horizon">Horizon in months</FieldLabel>
                <Input
                  id="asp-horizon"
                  type="number"
                  min={1}
                  max={120}
                  value={horizon}
                  onChange={(e) => setHorizon(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="asp-role">Target role</FieldLabel>
              <Input
                id="asp-role"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Staff Engineer"
              />
              <FieldDescription>Optional.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!statement.trim()}>
              Save aspiration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MilestoneDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: Person
}) {
  const [title, setTitle] = React.useState("")
  const [kind, setKind] = React.useState<MilestoneKind>(
    person.focus === "onboarding" ? "onboarding" : "stretch"
  )
  const [competency, setCompetency] = React.useState<CompetencyArea | "none">(
    "none"
  )
  const [targetDate, setTargetDate] = React.useState("")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    actions.addMilestone({
      personId: person.id,
      kind,
      title,
      competency: competency === "none" ? undefined : competency,
      targetDate: targetDate || undefined,
    })
    toast.success("Milestone added", { description: title.trim() })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Add a milestone</DialogTitle>
            <DialogDescription>
              Something observable {firstName(person.name)} is working toward.
              It starts as planned.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="ms-title">Milestone</FieldLabel>
              <Input
                id="ms-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Leads the design review for a shared service"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="ms-kind">Kind</FieldLabel>
                <OptionSelect
                  id="ms-kind"
                  value={kind}
                  onChange={setKind}
                  options={kindOptions}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ms-competency">Competency area</FieldLabel>
                <OptionSelect
                  id="ms-competency"
                  value={competency}
                  onChange={setCompetency}
                  options={competencyOptions}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="ms-target">Target date</FieldLabel>
              <Input
                id="ms-target"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
              <FieldDescription>Optional.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Add milestone
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
