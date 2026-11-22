"use client"

import * as React from "react"
import {
  ActivityIcon,
  CalendarPlusIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
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
import { Textarea } from "@/components/ui/textarea"
import { ChartCard } from "@/components/charts/chart-card"
import { ChartEmpty } from "@/components/charts/chart-primitives"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { Section } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { PulseScale } from "@/features/shared/pulse-scale"
import { ScheduleMeetingDialog } from "@/features/shared/schedule-dialog"
import {
  burnoutDimensionLabels,
  HIGH_WORKLOAD_THRESHOLD,
  LOW_ENERGY_THRESHOLD,
  PULSE_WINDOW,
  pulseEnergyLabels,
  pulseWorkloadLabels,
  workloadControls,
  workloadMarkerLabels,
} from "@/lib/constants"
import { firstName, formatDay, formatDelta, plural } from "@/lib/format"
import { today } from "@/lib/time"
import type {
  BurnoutDimension,
  Person,
  WorkloadMarker,
  WorkloadMarkerKind,
} from "@/lib/types"
import { questionsFor } from "@/lib/vantage/question-bank"
import { pulsesFor, pulseSummary } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import {
  History,
  OptionSelect,
  optionsFrom,
  Row,
  SourceLink,
} from "./parts/common"
import { PulseChart } from "./parts/pulse-chart"

const dimensions = Object.keys(burnoutDimensionLabels) as BurnoutDimension[]
const kindOptions = optionsFrom(workloadMarkerLabels)
const dimensionOptions = [
  { value: "none" as const, label: "Not tagged" },
  ...dimensions.map((d) => ({
    value: d,
    label: burnoutDimensionLabels[d].label,
  })),
]

/** Sustainable workload: voluntary pulses and stated pressure only. */
export function WellbeingTab({ person }: { person: Person }) {
  const ws = workspace.use()
  const [pulseOpen, setPulseOpen] = React.useState(false)
  const [markerOpen, setMarkerOpen] = React.useState(false)
  const [scheduling, setScheduling] = React.useState(false)
  const name = firstName(person.name)
  const aggregateOnly = ws.settings.worksCouncilMode

  const pulses = pulsesFor(ws, person.id)
  const summary = pulseSummary(pulses)
  const markers = ws.workloadMarkers
    .filter((w) => w.personId === person.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const open = markers.filter((w) => !w.resolvedDate)
  const resolved = markers.filter((w) => w.resolvedDate)
  const lowEnergy =
    summary.energy !== null && summary.energy <= LOW_ENERGY_THRESHOLD
  const highLoad =
    summary.workload !== null && summary.workload >= HIGH_WORKLOAD_THRESHOLD
  const triage = questionsFor("burnout", ws.customQuestions).slice(0, 3)
  const recent = `last ${plural(Math.min(PULSE_WINDOW, summary.count), "pulse")}`

  const logButton = (
    <Button size="sm" onClick={() => setPulseOpen(true)}>
      <PlusIcon data-icon="inline-start" />
      Log pulse
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3 rounded-xl border border-info/25 bg-info/5 px-4 py-3">
        <ShieldCheckIcon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-info-text"
        />
        <div className="space-y-0.5 text-sm">
          <p className="font-medium">Only what {name} chose to share</p>
          <p className="leading-relaxed text-muted-foreground">
            Every figure here comes from a 1 to 5 pulse {name} chose to give or
            from pressure they described in words. Nothing is inferred from
            tone, stress, sentiment or behavior.
          </p>
        </div>
      </div>

      <StatGrid columns={4}>
        <StatCard
          label="Recent energy"
          value={summary.energy ?? "No pulses"}
          unit={summary.energy !== null ? "/ 5" : undefined}
          hint={
            summary.energy === null
              ? "1 is drained, 5 is energized"
              : lowEnergy
                ? `At or below the check-in line of ${LOW_ENERGY_THRESHOLD}`
                : `Average of the ${recent}`
          }
        />
        <StatCard
          label="Recent workload"
          value={summary.workload ?? "No pulses"}
          unit={summary.workload !== null ? "/ 5" : undefined}
          hint={
            summary.workload === null
              ? "1 is light, 5 is unsustainable"
              : highLoad
                ? `At or above the check-in line of ${HIGH_WORKLOAD_THRESHOLD}`
                : `Average of the ${recent}`
          }
        />
        <StatCard
          label="Energy trend"
          value={
            summary.energyTrend === null
              ? "Not enough yet"
              : formatDelta(summary.energyTrend, "")
          }
          hint={
            summary.energyTrend === null
              ? `Needs more than ${PULSE_WINDOW} pulses`
              : `Against the ${PULSE_WINDOW} pulses before`
          }
        />
        <StatCard
          label="Pulses logged"
          value={summary.count}
          hint={
            summary.latest
              ? `Latest on ${formatDay(summary.latest.date)}`
              : "All voluntary"
          }
        />
      </StatGrid>

      {(lowEnergy || highLoad) && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            {name}&apos;s recent pulses call for a conversation about load.
            Change the work first, and ask before you assume.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setScheduling(true)}
          >
            Schedule a workload check-in
          </Button>
        </div>
      )}

      {aggregateOnly ? (
        <Card>
          <CardHeader>
            <CardTitle>Individual trend views are switched off</CardTitle>
            <CardDescription>
              Works council mode is on, so the chart and the pulse by pulse
              history for one person are hidden. You can still log a pulse{" "}
              {name} chooses to give.
            </CardDescription>
          </CardHeader>
          <CardContent>{logButton}</CardContent>
        </Card>
      ) : (
        <ChartCard
          title="Energy and workload"
          description="Self-reported on a 1 to 5 scale. Higher energy is better; higher workload is heavier."
          action={logButton}
          className="h-auto"
        >
          {pulses.length === 0 ? (
            <ChartEmpty
              title="No pulses yet"
              description={`Ask ${name} for a 1 to 5 read on energy and workload, and log it only if they want to give one.`}
            />
          ) : (
            <>
              <PulseChart pulses={pulses} />
              <History
                title="Pulse history"
                count={pulses.length}
                className="mt-3"
              >
                <ul className="flex flex-col divide-y">
                  {[...pulses].reverse().map((p) => (
                    <li
                      key={p.id}
                      className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-2 text-xs sm:grid-cols-[4.5rem_9rem_9rem_minmax(0,1fr)]"
                    >
                      <span className="text-muted-foreground tabular-nums">
                        {formatDay(p.date)}
                      </span>
                      <span>
                        Energy {p.energy}: {pulseEnergyLabels[p.energy - 1]}
                      </span>
                      <span className="col-start-2 sm:col-start-auto">
                        Workload {p.workload}:{" "}
                        {pulseWorkloadLabels[p.workload - 1]}
                      </span>
                      {p.note && (
                        <span className="col-start-2 text-muted-foreground sm:col-start-auto">
                          {p.note}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </History>
            </>
          )}
        </ChartCard>
      )}

      <Section
        title="Stated workload pressures"
        count={open.length}
        description={`Pressure ${name} described in their own words. Open ones first.`}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMarkerOpen(true)}
          >
            <PlusIcon data-icon="inline-start" />
            Add pressure
          </Button>
        }
      >
        {markers.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<ActivityIcon />}
            title="No stated pressures"
            description={`When ${name} tells you about a crunch, after-hours work or scope that grew, note it here in their words.`}
          />
        ) : (
          <Card size="sm">
            <CardContent className="flex flex-col gap-3">
              {open.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing open. Every pressure {name} raised has been resolved.
                </p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {open.map((w) => (
                    <MarkerRow key={w.id} marker={w} />
                  ))}
                </ul>
              )}
              {resolved.length > 0 && (
                <History title="Resolved" count={resolved.length}>
                  <ul className="flex flex-col divide-y">
                    {resolved.map((w) => (
                      <MarkerRow key={w.id} marker={w} />
                    ))}
                  </ul>
                </History>
              )}
            </CardContent>
          </Card>
        )}
      </Section>

      <Card>
        <CardHeader>
          <CardTitle>When the signals call for a conversation</CardTitle>
          <CardDescription>
            These signals exist to help {name}. They must never be used
            punitively, in a review or in any decision about pay or role.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Eyebrow>Three dimensions to listen for</Eyebrow>
              <ul className="flex flex-col gap-2">
                {dimensions.map((d) => (
                  <li key={d} className="text-sm">
                    <span className="font-medium">
                      {burnoutDimensionLabels[d].label}
                    </span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      {burnoutDimensionLabels[d].description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <Eyebrow>Three questions to ask</Eyebrow>
              <ol className="flex flex-col gap-2">
                {triage.map((q) => (
                  <li key={q.id} className="text-sm leading-relaxed">
                    {q.text}
                    {q.tag && (
                      <span className="block text-xs text-muted-foreground">
                        {q.tag}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
            <div className="space-y-2">
              <Eyebrow>Change the work first</Eyebrow>
              <ol className="flex list-inside list-decimal flex-col gap-1 text-sm marker:text-muted-foreground">
                {workloadControls.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ol>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Work down the list before you offer advice about coping.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full sm:w-fit"
            onClick={() => setScheduling(true)}
          >
            <CalendarPlusIcon data-icon="inline-start" />
            Schedule a workload check-in
          </Button>
        </CardContent>
      </Card>

      <PulseDialog
        key={`p-${pulseOpen}`}
        open={pulseOpen}
        onOpenChange={setPulseOpen}
        person={person}
        hasToday={summary.latest?.date === today()}
      />
      <MarkerDialog
        key={`w-${markerOpen}`}
        open={markerOpen}
        onOpenChange={setMarkerOpen}
        person={person}
      />
      <ScheduleMeetingDialog
        open={scheduling}
        onOpenChange={setScheduling}
        personId={person.id}
        type="burnout"
      />
    </div>
  )
}

function MarkerRow({ marker: w }: { marker: WorkloadMarker }) {
  return (
    <Row>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">
            {workloadMarkerLabels[w.kind]}
          </span>
          {w.dimension && (
            <StateBadge
              size="sm"
              state={burnoutDimensionLabels[w.dimension].label}
            />
          )}
        </div>
        <p className="text-sm leading-relaxed">{w.note}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            Stated {formatDay(w.date)}
            {w.resolvedDate ? `, resolved ${formatDay(w.resolvedDate)}` : ""}
          </span>
          <SourceLink meetingId={w.sourceMeetingId} />
        </div>
      </div>
      {!w.resolvedDate && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 self-start"
          onClick={() => {
            actions.resolveWorkloadMarker(w.id)
            toast.success("Workload pressure marked resolved")
          }}
        >
          Mark resolved
        </Button>
      )}
    </Row>
  )
}

function PulseDialog({
  open,
  onOpenChange,
  person,
  hasToday,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: Person
  hasToday: boolean
}) {
  const [energy, setEnergy] = React.useState<number | null>(null)
  const [load, setLoad] = React.useState<number | null>(null)
  const [note, setNote] = React.useState("")
  const name = firstName(person.name)
  const ready = energy !== null && load !== null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (energy === null || load === null) return
    actions.logPulse({ personId: person.id, energy, workload: load, note })
    toast.success(hasToday ? "Today's pulse replaced" : "Pulse logged", {
      description: `Energy ${energy}, workload ${load}`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Log a pulse</DialogTitle>
            <DialogDescription>
              A pulse is voluntary. Log the numbers {name} gave you, never your
              own read of how they seem. A second pulse on the same day replaces
              the first.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <PulseScale
              name="pulse-energy"
              legend="Energy"
              labels={pulseEnergyLabels}
              value={energy}
              onChange={setEnergy}
            />
            <PulseScale
              name="pulse-workload"
              legend="Workload"
              labels={pulseWorkloadLabels}
              value={load}
              onChange={setLoad}
            />
            <Field>
              <FieldLabel htmlFor="pulse-note">Note</FieldLabel>
              <Textarea
                id="pulse-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything they said about why"
              />
              <FieldDescription>Optional.</FieldDescription>
            </Field>
            {hasToday && (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                A pulse is already logged for today. Saving replaces it.
              </p>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!ready}>
              Save pulse
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MarkerDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: Person
}) {
  const [kind, setKind] = React.useState<WorkloadMarkerKind>("crunch")
  const [note, setNote] = React.useState("")
  const [dimension, setDimension] = React.useState<BurnoutDimension | "none">(
    "none"
  )
  const name = firstName(person.name)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    actions.addWorkloadMarker({
      personId: person.id,
      kind,
      note: note.trim(),
      dimension: dimension === "none" ? undefined : dimension,
    })
    toast.success("Workload pressure added", {
      description: workloadMarkerLabels[kind],
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Add a stated pressure</DialogTitle>
            <DialogDescription>
              Record what {name} told you, in their words. Do not add what you
              suspect or what you read into how they seemed.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="marker-kind">Kind</FieldLabel>
              <OptionSelect
                id="marker-kind"
                value={kind}
                onChange={setKind}
                options={kindOptions}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="marker-note">What they said</FieldLabel>
              <Textarea
                id="marker-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Third release in six weeks"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="marker-dimension">
                Dimension they described
              </FieldLabel>
              <OptionSelect
                id="marker-dimension"
                value={dimension}
                onChange={setDimension}
                options={dimensionOptions}
              />
              <FieldDescription>
                {dimension === "none"
                  ? "Optional. Tag one only when their own words point to it."
                  : burnoutDimensionLabels[dimension].description}
              </FieldDescription>
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
            <Button type="submit" disabled={!note.trim()}>
              Add pressure
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
