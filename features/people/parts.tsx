"use client"

import * as React from "react"
import { cn } from "cn"
import { ChevronRightIcon } from "lucide-react"

import { CountPill } from "@/components/shared/count-pill"
import { toneClasses, type Tone } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  focusLabels,
  frequencyLabels,
  HIGH_WORKLOAD_THRESHOLD,
  LOW_ENERGY_THRESHOLD,
  pulseEnergyLabels,
  pulseWorkloadLabels,
  readinessLabels,
  recognitionLabels,
  weekdayLabels,
  workModeLabels,
} from "@/lib/constants"
import { formatTime } from "@/lib/format"
import { atTime, today } from "@/lib/time"
import type {
  CadenceConfig,
  Frequency,
  PersonFocus,
  Readiness,
  RecognitionPref,
  WorkMode,
} from "@/lib/types"

/* ----------------------------------------------------------------- options */

export interface Option<T extends string = string> {
  value: T
  label: string
}

function optionsOf<T extends string>(labels: Record<T, string>): Option<T>[] {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }))
}

export const workModeOptions = optionsOf<WorkMode>(workModeLabels)
export const focusOptions = optionsOf<PersonFocus>(focusLabels)
export const frequencyOptions = optionsOf<Frequency>(frequencyLabels)
export const recognitionOptions = optionsOf<RecognitionPref>(recognitionLabels)
export const readinessLevels = Object.keys(readinessLabels) as Readiness[]
export const readinessOptions: Option<Readiness>[] = readinessLevels.map(
  (level) => ({
    value: level,
    label: `${level}: ${readinessLabels[level].level}`,
  })
)

/** 1:1s after this local time get a gentle note about mornings. */
export const AFTERNOON_FROM = "13:00"

/** "10:00" to "10:00 AM" through the shared formatter. */
export function timeLabel(time: string) {
  return formatTime(atTime(today(), time))
}

/** "Weekly, 30 min, Tuesday at 10:00 AM". */
export function cadenceSentence(cadence: CadenceConfig) {
  return `${frequencyLabels[cadence.frequency]}, ${cadence.durationMin} min, ${weekdayLabels[cadence.weekday]} at ${timeLabel(cadence.time)}`
}

/* ------------------------------------------------------------------ select */

/** The house `Select` with its items wired once. */
export function SimpleSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  className,
  size,
  "aria-label": ariaLabel,
}: {
  id?: string
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  className?: string
  size?: "sm" | "default"
  "aria-label"?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      items={options}
    >
      <SelectTrigger
        id={id}
        size={size}
        aria-label={ariaLabel}
        className={cn("w-full", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* ------------------------------------------------------------------- pulse */

/** A self-reported 1 to 5 pulse value as five small segments. */
export function PulseMeter({
  kind,
  value,
  className,
}: {
  kind: "energy" | "workload"
  value: number
  className?: string
}) {
  const label = kind === "energy" ? "Energy" : "Workload"
  const words = kind === "energy" ? pulseEnergyLabels : pulseWorkloadLabels
  const flagged =
    kind === "energy"
      ? value <= LOW_ENERGY_THRESHOLD
      : value >= HIGH_WORKLOAD_THRESHOLD
  const tone: Tone = flagged ? "warning" : "brand"
  const rounded = Math.round(value)
  const word = words[Math.min(5, Math.max(1, rounded)) - 1]
  return (
    <span
      role="img"
      aria-label={`${label} ${value} of 5, ${word}`}
      title={`${label}: ${word}`}
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      <span className="text-2xs text-muted-foreground">{label}</span>
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1.5 w-2.5 rounded-full",
              n <= rounded ? toneClasses[tone].dot : "bg-muted"
            )}
          />
        ))}
      </span>
      <span
        className={cn(
          "text-xs font-medium tabular-nums",
          flagged && toneClasses.warning.text
        )}
      >
        {value}
      </span>
    </span>
  )
}

/* ----------------------------------------------------------------- cadence */

const WORK_DAYS = [1, 2, 3, 4, 5]

export function cadenceError(cadence: CadenceConfig): string | null {
  if (
    !Number.isFinite(cadence.durationMin) ||
    cadence.durationMin < 15 ||
    cadence.durationMin > 120
  )
    return "Length must be between 15 and 120 minutes."
  if (!/^\d{2}:\d{2}$/.test(cadence.time)) return "Choose a start time."
  return null
}

/** Frequency, length, weekday and time. Shared by setup and the edit sheet. */
export function CadenceFields({
  idPrefix,
  value,
  onChange,
  showErrors = false,
}: {
  idPrefix: string
  value: CadenceConfig
  onChange: (patch: Partial<CadenceConfig>) => void
  showErrors?: boolean
}) {
  const days = WORK_DAYS.includes(value.weekday)
    ? WORK_DAYS
    : [...WORK_DAYS, value.weekday]
  const dayOptions = days.map((d) => ({
    value: String(d),
    label: weekdayLabels[d],
  }))
  const error = showErrors ? cadenceError(value) : null
  const afternoon = value.time >= AFTERNOON_FROM
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-frequency`}>How often</FieldLabel>
          <SimpleSelect
            id={`${idPrefix}-frequency`}
            value={value.frequency}
            onChange={(frequency) => onChange({ frequency })}
            options={frequencyOptions}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-minutes`}>Minutes</FieldLabel>
          <Input
            id={`${idPrefix}-minutes`}
            type="number"
            inputMode="numeric"
            min={15}
            max={120}
            step={5}
            value={Number.isFinite(value.durationMin) ? value.durationMin : ""}
            onChange={(e) => onChange({ durationMin: e.target.valueAsNumber })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-weekday`}>Day</FieldLabel>
          <SimpleSelect
            id={`${idPrefix}-weekday`}
            value={String(value.weekday)}
            onChange={(d) => onChange({ weekday: Number(d) })}
            options={dayOptions}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-time`}>Start time</FieldLabel>
          <Input
            id={`${idPrefix}-time`}
            type="time"
            value={value.time}
            onChange={(e) => onChange({ time: e.target.value })}
          />
        </Field>
      </div>
      {error && <FieldError>{error}</FieldError>}
      {afternoon && !error && (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-xs leading-relaxed",
            toneClasses.warning.badge
          )}
        >
          Morning 1:1s show higher engagement than afternoon ones. Move it
          before {timeLabel(AFTERNOON_FROM)} if time zones allow.
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- disclosure */

/** A collapsed list with a count, for closed and resolved records. */
export function Disclosure({
  label,
  count,
  children,
  defaultOpen = false,
  className,
}: {
  label: string
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn("group/disclosure flex flex-col gap-2", className)}
    >
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 self-start text-muted-foreground"
          />
        }
      >
        <ChevronRightIcon className="transition-transform in-data-panel-open:rotate-90" />
        {label}
        <CountPill count={count} />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}

/* ------------------------------------------------------------ note dialog */

/** A short dialog that asks for one line or note before an action runs. */
export function NoteDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  hint,
  submitLabel,
  required = false,
  multiline = true,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  label: string
  placeholder?: string
  hint?: string
  submitLabel: string
  required?: boolean
  multiline?: boolean
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = React.useState("")
  const id = React.useId()

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) setValue("")
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (required && !value.trim()) return
    onSubmit(value.trim())
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {multiline ? (
              <Textarea
                id={id}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className="min-h-16"
                required={required}
              />
            ) : (
              <Input
                id={id}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                required={required}
              />
            )}
            {hint && <FieldDescription>{hint}</FieldDescription>}
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={required && !value.trim()}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
