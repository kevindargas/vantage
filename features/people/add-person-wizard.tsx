"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Eyebrow } from "@/components/shared/eyebrow"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StateBadge, toneClasses } from "@/components/shared/status-badge"
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  cadenceProfiles,
  careerTrackLabels,
  focusLabels,
  meetingTypeLabels,
  ONBOARDING_CHECKPOINTS,
  readinessLabels,
  recognitionLabels,
  STAY_INTERVAL_DAYS,
  workModeLabels,
} from "@/lib/constants"
import { firstName, formatDay, formatWhen, plural } from "@/lib/format"
import { atTime, today } from "@/lib/time"
import type {
  CadenceConfig,
  CadenceProfile,
  CareerTrack,
  PersonFocus,
  Readiness,
  RecognitionPref,
  WorkMode,
} from "@/lib/types"
import {
  nextOccurrence,
  recommendCadence,
  suggestProfile,
} from "@/lib/vantage/cadence"
import { actions, type NewPersonInput } from "@/lib/vantage/store"
import {
  cadenceError,
  CadenceFields,
  cadenceSentence,
  focusOptions,
  readinessOptions,
  recognitionOptions,
  SimpleSelect,
  workModeOptions,
  type Option,
} from "./parts"

/* ------------------------------------------------------------------- model */

const STEPS = [
  { id: "who", title: "Who", heading: "Who is joining your team?" },
  { id: "meet", title: "How you will meet", heading: "How you will meet" },
  { id: "work", title: "How they work", heading: "How they like to work" },
  {
    id: "headed",
    title: "Where they are headed",
    heading: "Where they are headed",
  },
  { id: "review", title: "Review", heading: "Review and add" },
] as const

const LAST = STEPS.length - 1
const MAX_ITEMS = 3
const PROFILE_ORDER = Object.keys(cadenceProfiles) as CadenceProfile[]
const DEFAULT_WEEKDAY = 2

const trackOptions: Option<CareerTrack>[] = (
  Object.keys(careerTrackLabels) as CareerTrack[]
).map((value) => ({ value, label: careerTrackLabels[value] }))

interface GoalDraft {
  title: string
  readiness: Readiness
}

interface WizardForm {
  name: string
  role: string
  level: string
  team: string
  email: string
  location: string
  startDate: string
  workMode: WorkMode
  managesPeople: boolean
  senior: boolean
  /** Set when the manager picks a profile other than the suggestion. */
  profile: CadenceProfile | null
  /** Fields the manager changed away from the recommendation. */
  cadence: Partial<CadenceConfig>
  focus: PersonFocus | null
  recognitionPref: RecognitionPref
  feedbackStyle: string
  rapportNotes: string
  lastReviewDate: string
  aspiration: string
  track: CareerTrack
  targetRole: string
  energizers: string[]
  frictions: string[]
  goals: GoalDraft[]
}

function blankForm(): WizardForm {
  return {
    name: "",
    role: "",
    level: "",
    team: "",
    email: "",
    location: "",
    startDate: today(),
    workMode: "hybrid",
    managesPeople: false,
    senior: false,
    profile: null,
    cadence: {},
    focus: null,
    recognitionPref: "either",
    feedbackStyle: "",
    rapportNotes: "",
    lastReviewDate: "",
    aspiration: "",
    track: "exploring",
    targetRole: "",
    energizers: [""],
    frictions: [""],
    goals: [],
  }
}

/** Everything the form implies, derived on every render. */
function resolve(form: WizardForm) {
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(form.startDate)
  const suggested = suggestProfile(
    validStart ? form.startDate : today(),
    form.managesPeople,
    form.senior
  )
  const profile = form.profile ?? suggested
  const cadence: CadenceConfig = {
    ...recommendCadence(
      profile,
      form.workMode,
      form.cadence.weekday ?? DEFAULT_WEEKDAY
    ),
    ...form.cadence,
  }
  const focus: PersonFocus =
    form.focus ?? (profile === "new-hire" ? "onboarding" : "standard")
  const energizers = form.energizers.map((t) => t.trim()).filter(Boolean)
  const frictions = form.frictions.map((t) => t.trim()).filter(Boolean)
  const goals = form.goals.filter((g) => g.title.trim())
  const hasAspiration = form.aspiration.trim().length > 0
  const firstAt = cadenceError(cadence)
    ? null
    : atTime(nextOccurrence(cadence), cadence.time)
  return {
    suggested,
    profile,
    cadence,
    focus,
    energizers,
    frictions,
    goals,
    hasAspiration,
    firstAt,
    firstType: focus === "onboarding" ? "onboarding" : "weekly",
  } as const
}

function stepErrors(step: number, form: WizardForm) {
  const errors: Record<string, string> = {}
  if (step === 0) {
    if (!form.name.trim()) errors.name = "Enter their name."
    if (!form.role.trim()) errors.role = "Enter their role."
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startDate))
      errors.startDate = "Choose a start date."
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim()))
      errors.email = "That does not look like an e-mail address."
  }
  if (step === 1) {
    const error = cadenceError(resolve(form).cadence)
    if (error) errors.cadence = error
  }
  return errors
}

/* ------------------------------------------------------------------ wizard */

export interface AddPersonWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Setup for a new direct report: five short steps that end in a profile, a
 * cadence and a first 1:1.
 */
export function AddPersonWizard({ open, onOpenChange }: AddPersonWizardProps) {
  const router = useRouter()
  const [form, setForm] = React.useState<WizardForm>(blankForm)
  const [step, setStep] = React.useState(0)
  const [dirty, setDirty] = React.useState(false)
  const [showErrors, setShowErrors] = React.useState(false)
  const [confirmClose, setConfirmClose] = React.useState(false)
  const bodyRef = React.useRef<HTMLDivElement>(null)

  const derived = resolve(form)
  const errors = showErrors ? stepErrors(step, form) : {}
  const name = firstName(form.name) || "They"

  function patch(next: Partial<WizardForm>) {
    setForm((f) => ({ ...f, ...next }))
    setDirty(true)
  }

  function reset() {
    setForm(blankForm())
    setStep(0)
    setDirty(false)
    setShowErrors(false)
    setConfirmClose(false)
  }

  function requestClose(next: boolean) {
    if (next) return onOpenChange(true)
    if (dirty) return setConfirmClose(true)
    reset()
    onOpenChange(false)
  }

  function discard() {
    reset()
    onOpenChange(false)
  }

  function go(to: number) {
    setStep(to)
    setShowErrors(false)
    bodyRef.current?.scrollTo?.({ top: 0 })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (Object.keys(stepErrors(step, form)).length) {
      setShowErrors(true)
      return
    }
    if (step < LAST) return go(step + 1)
    // Earlier steps can be reached again from the review, so check them all.
    const broken = [0, 1].find((s) => Object.keys(stepErrors(s, form)).length)
    if (broken !== undefined) {
      setStep(broken)
      setShowErrors(true)
      return
    }
    const input: NewPersonInput = {
      name: form.name,
      email: form.email,
      role: form.role,
      level: form.level,
      team: form.team,
      location: form.location,
      startDate: form.startDate,
      workMode: form.workMode,
      profile: derived.profile,
      focus: derived.focus,
      cadence: derived.cadence,
      recognitionPref: form.recognitionPref,
      feedbackStyle: form.feedbackStyle,
      rapportNotes: form.rapportNotes,
      lastReviewDate: form.lastReviewDate || undefined,
      aspiration: derived.hasAspiration
        ? {
            statement: form.aspiration,
            track: form.track,
            targetRole: form.targetRole,
          }
        : undefined,
      energizers: derived.energizers,
      frictions: derived.frictions,
      goals: derived.goals,
    }
    const id = actions.addPerson(input)
    toast.success(`${form.name.trim()} added to your team`, {
      description: derived.firstAt
        ? `First 1:1 set for ${formatWhen(derived.firstAt)}.`
        : undefined,
    })
    reset()
    onOpenChange(false)
    router.push(`/people/${id}`)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent
          className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
        >
          <form onSubmit={submit} noValidate className="contents">
            <SheetHeader className="border-b px-6 py-5">
              <SheetTitle>Add a person</SheetTitle>
              <SheetDescription>
                Answer a few questions and they are set up: a profile, a 1:1
                cadence and a first conversation.
              </SheetDescription>
              <StepIndicator step={step} onSelect={go} />
            </SheetHeader>

            <SheetBody ref={bodyRef}>
              <div className="mb-5 space-y-1">
                <Eyebrow>
                  Step {step + 1} of {STEPS.length}
                </Eyebrow>
                <h3 className="font-heading text-lg font-semibold tracking-tight">
                  {STEPS[step].heading}
                </h3>
              </div>
              {step === 0 && (
                <WhoStep form={form} patch={patch} errors={errors} />
              )}
              {step === 1 && (
                <MeetStep
                  form={form}
                  patch={patch}
                  derived={derived}
                  name={name}
                  showErrors={showErrors}
                />
              )}
              {step === 2 && <WorkStep form={form} patch={patch} name={name} />}
              {step === 3 && (
                <HeadedStep form={form} patch={patch} name={name} />
              )}
              {step === 4 && (
                <ReviewStep form={form} derived={derived} onEdit={go} />
              )}
            </SheetBody>

            <SheetFooterActions
              hideCancel
              tertiary={
                step > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => go(step - 1)}
                  >
                    <ArrowLeftIcon /> Back
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => requestClose(false)}
                  >
                    Cancel
                  </Button>
                )
              }
              primary={
                step < LAST ? (
                  <Button type="submit">
                    Next <ArrowRightIcon />
                  </Button>
                ) : (
                  <Button type="submit">
                    <UserPlusIcon /> Add to my team
                  </Button>
                )
              }
            />
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this setup?</AlertDialogTitle>
            <AlertDialogDescription>
              {form.name.trim()
                ? `Nothing has been saved for ${form.name.trim()} yet. Closing now loses the answers you have entered.`
                : "Nothing has been saved yet. Closing now loses the answers you have entered."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ---------------------------------------------------------- step indicator */

function StepIndicator({
  step,
  onSelect,
}: {
  step: number
  onSelect: (step: number) => void
}) {
  return (
    <nav aria-label="Setup steps" className="mt-4">
      <ol className="flex items-center gap-1.5">
        {STEPS.map((s, i) => {
          const done = i < step
          const current = i === step
          return (
            <li
              key={s.id}
              className={cn(
                "flex min-w-0 items-center gap-1.5",
                i < LAST && "flex-1"
              )}
            >
              <button
                type="button"
                disabled={!done}
                onClick={() => onSelect(i)}
                aria-current={current ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.title}${done ? ", completed" : ""}`}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-full py-0.5 pr-2 pl-0.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  done && "cursor-pointer hover:bg-muted",
                  current ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-2xs tabular-nums",
                    current && "border-brand bg-brand text-brand-foreground",
                    done && "border-brand/30 bg-brand/10 text-brand",
                    !current && !done && "bg-card"
                  )}
                >
                  {done ? <CheckIcon className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn("truncate", !current && "hidden md:inline")}
                >
                  {s.title}
                </span>
              </button>
              {i < LAST && (
                <span
                  aria-hidden
                  className={cn(
                    "h-px min-w-2 flex-1",
                    done ? "bg-brand/40" : "bg-border"
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ------------------------------------------------------------------- steps */

interface StepProps {
  form: WizardForm
  patch: (next: Partial<WizardForm>) => void
}

function WhoStep({
  form,
  patch,
  errors,
}: StepProps & { errors: Record<string, string> }) {
  return (
    <FieldGroup className="gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.name || undefined}>
          <FieldLabel htmlFor="wizard-name">Name</FieldLabel>
          <Input
            id="wizard-name"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Maya Chen"
            autoComplete="off"
            aria-invalid={!!errors.name || undefined}
            required
            autoFocus
          />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <Field data-invalid={!!errors.role || undefined}>
          <FieldLabel htmlFor="wizard-role">Role</FieldLabel>
          <Input
            id="wizard-role"
            value={form.role}
            onChange={(e) => patch({ role: e.target.value })}
            placeholder="Senior Software Engineer"
            aria-invalid={!!errors.role || undefined}
            required
          />
          {errors.role && <FieldError>{errors.role}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="wizard-level">Level (optional)</FieldLabel>
          <Input
            id="wizard-level"
            value={form.level}
            onChange={(e) => patch({ level: e.target.value })}
            placeholder="L5"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="wizard-team">Team (optional)</FieldLabel>
          <Input
            id="wizard-team"
            value={form.team}
            onChange={(e) => patch({ team: e.target.value })}
            placeholder="Platform"
          />
        </Field>
        <Field data-invalid={!!errors.email || undefined}>
          <FieldLabel htmlFor="wizard-email">E-mail (optional)</FieldLabel>
          <Input
            id="wizard-email"
            type="email"
            value={form.email}
            onChange={(e) => patch({ email: e.target.value })}
            placeholder="maya@example.com"
            autoComplete="off"
            aria-invalid={!!errors.email || undefined}
          />
          {errors.email && <FieldError>{errors.email}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="wizard-location">Location (optional)</FieldLabel>
          <Input
            id="wizard-location"
            value={form.location}
            onChange={(e) => patch({ location: e.target.value })}
            placeholder="Lisbon"
          />
        </Field>
        <Field data-invalid={!!errors.startDate || undefined}>
          <FieldLabel htmlFor="wizard-start">Start date</FieldLabel>
          <Input
            id="wizard-start"
            type="date"
            value={form.startDate}
            onChange={(e) => patch({ startDate: e.target.value })}
            aria-invalid={!!errors.startDate || undefined}
            required
          />
          {errors.startDate ? (
            <FieldError>{errors.startDate}</FieldError>
          ) : (
            <FieldDescription>
              Their first day in the role or on your team.
            </FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="wizard-workmode">Work mode</FieldLabel>
          <SimpleSelect
            id="wizard-workmode"
            value={form.workMode}
            onChange={(workMode) => patch({ workMode })}
            options={workModeOptions}
          />
        </Field>
      </div>
    </FieldGroup>
  )
}

function YesNo({
  legend,
  value,
  onChange,
}: {
  legend: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <span className="text-sm">{legend}</span>
      <ToggleGroup
        aria-label={legend}
        value={[value ? "yes" : "no"]}
        onValueChange={(v) => {
          if (v[0]) onChange(v[0] === "yes")
        }}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="yes" className="px-3">
          Yes
        </ToggleGroupItem>
        <ToggleGroupItem value="no" className="px-3">
          No
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}

function MeetStep({
  form,
  patch,
  derived,
  name,
  showErrors,
}: StepProps & {
  derived: ReturnType<typeof resolve>
  name: string
  showErrors: boolean
}) {
  const spec = cadenceProfiles[derived.profile]
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
        <YesNo
          legend="Do they manage people or lead a team?"
          value={form.managesPeople}
          onChange={(managesPeople) => patch({ managesPeople, profile: null })}
        />
        <YesNo
          legend="Are they a senior or principal contributor?"
          value={form.senior}
          onChange={(senior) => patch({ senior, profile: null })}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Profile</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROFILE_ORDER.map((key) => {
            const p = cadenceProfiles[key]
            const selected = derived.profile === key
            return (
              <label
                key={key}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                  selected
                    ? "border-brand/50 bg-brand/5"
                    : "bg-card hover:bg-muted/60"
                )}
              >
                <input
                  type="radio"
                  name="wizard-profile"
                  value={key}
                  checked={selected}
                  onChange={() =>
                    patch({
                      profile: key,
                      // Start again from the new profile's recommendation.
                      cadence: {
                        weekday: form.cadence.weekday,
                        time: form.cadence.time,
                      },
                    })
                  }
                  className="sr-only"
                />
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{p.label}</span>
                  {derived.suggested === key && (
                    <StateBadge
                      state="Suggested"
                      tone="brand"
                      size="sm"
                      dot={false}
                    />
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.description}
                </span>
                <span className="mt-1 text-xs leading-relaxed">{p.focus}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-sm font-medium">Cadence</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Recommended for this profile: {spec.rationale}
          </p>
        </div>
        <CadenceFields
          idPrefix="wizard-cadence"
          value={derived.cadence}
          onChange={(next) => patch({ cadence: { ...form.cadence, ...next } })}
          showErrors={showErrors}
        />
        {derived.firstAt && (
          <p className="text-xs text-muted-foreground">
            First 1:1 with {name === "They" ? "them" : name}:{" "}
            <span className="font-medium text-foreground">
              {formatWhen(derived.firstAt)}
            </span>
          </p>
        )}
      </div>

      <Field>
        <FieldLabel htmlFor="wizard-focus">Focus right now</FieldLabel>
        <SimpleSelect
          id="wizard-focus"
          value={derived.focus}
          onChange={(focus) => patch({ focus })}
          options={focusOptions}
        />
        <FieldDescription>
          Onboarding adds checkpoints on day {ONBOARDING_CHECKPOINTS.join(", ")}
          . Performance support keeps conversations on manual notes.
        </FieldDescription>
      </Field>
    </div>
  )
}

function WorkStep({ form, patch, name }: StepProps & { name: string }) {
  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel htmlFor="wizard-recognition">
          How do they like to be recognized?
        </FieldLabel>
        <SimpleSelect
          id="wizard-recognition"
          value={form.recognitionPref}
          onChange={(recognitionPref) => patch({ recognitionPref })}
          options={recognitionOptions}
        />
        <FieldDescription>
          Shown whenever you write recognition for them.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="wizard-feedback">
          How do they like to receive feedback? (optional)
        </FieldLabel>
        <Textarea
          id="wizard-feedback"
          value={form.feedbackStyle}
          onChange={(e) => patch({ feedbackStyle: e.target.value })}
          placeholder="Direct and in writing first, then time to think before talking it through"
          className="min-h-16"
        />
        <FieldDescription>In their words, if you have asked.</FieldDescription>
      </Field>
      <Field>
        <div className="flex items-center gap-2">
          <FieldLabel htmlFor="wizard-rapport">
            Rapport notes (optional)
          </FieldLabel>
          <StateBadge state="Private" size="sm" />
        </div>
        <Textarea
          id="wizard-rapport"
          value={form.rapportNotes}
          onChange={(e) => patch({ rapportNotes: e.target.value })}
          placeholder="Two kids, coaches youth football on Saturdays, learning Portuguese"
          className="min-h-16"
        />
        <FieldDescription>
          Only you see these. They are never part of a shared summary or a
          review draft.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="wizard-review">
          Date of their last formal review (optional)
        </FieldLabel>
        <Input
          id="wizard-review"
          type="date"
          value={form.lastReviewDate}
          max={today()}
          onChange={(e) => patch({ lastReviewDate: e.target.value })}
          className="sm:max-w-56"
        />
        <FieldDescription>
          Used to place the stay interview about six months away from the
          review, so {name === "They" ? "they do" : `${name} does`} not hear
          both in the same breath. Stay interviews repeat every{" "}
          {STAY_INTERVAL_DAYS} days.
        </FieldDescription>
      </Field>
    </FieldGroup>
  )
}

function TextList({
  legend,
  hint,
  items,
  onChange,
  placeholder,
  addLabel,
  idPrefix,
}: {
  legend: string
  hint: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  addLabel: string
  idPrefix: string
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {items.map((text, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            id={`${idPrefix}-${i}`}
            aria-label={`${legend} ${i + 1}`}
            value={text}
            onChange={(e) =>
              onChange(items.map((t, j) => (j === i ? e.target.value : t)))
            }
            placeholder={placeholder}
          />
          {items.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${legend.toLowerCase()} ${i + 1}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <XIcon />
            </Button>
          )}
        </div>
      ))}
      {items.length < MAX_ITEMS && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 self-start"
          onClick={() => onChange([...items, ""])}
        >
          <PlusIcon /> {addLabel}
        </Button>
      )}
    </fieldset>
  )
}

function HeadedStep({ form, patch, name }: StepProps & { name: string }) {
  const who = name === "They" ? "they" : name
  return (
    <div className="flex flex-col gap-6">
      <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Everything on this step is optional. Skip what you do not know yet and
        fill it in after your first conversations.
      </p>

      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="wizard-aspiration">
            Where do they want to be in a year or two?
          </FieldLabel>
          <Textarea
            id="wizard-aspiration"
            value={form.aspiration}
            onChange={(e) => patch({ aspiration: e.target.value })}
            placeholder="Lead the design of a system end to end and mentor two engineers"
            className="min-h-16"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="wizard-track">Track</FieldLabel>
            <SimpleSelect
              id="wizard-track"
              value={form.track}
              onChange={(track) => patch({ track })}
              options={trackOptions}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="wizard-target">Target role</FieldLabel>
            <Input
              id="wizard-target"
              value={form.targetRole}
              onChange={(e) => patch({ targetRole: e.target.value })}
              placeholder="Staff Engineer"
            />
          </Field>
        </div>
        {!form.aspiration.trim() && form.targetRole.trim() && (
          <FieldDescription>
            The track and target role are saved together with the statement
            above. Add a sentence to keep them.
          </FieldDescription>
        )}
      </FieldGroup>

      <TextList
        idPrefix="wizard-energizer"
        legend="What they look forward to"
        hint={`Up to ${MAX_ITEMS}. The work that gives ${who === "they" ? "them" : who} energy.`}
        items={form.energizers}
        onChange={(energizers) => patch({ energizers })}
        placeholder="Pairing on hard debugging problems"
        addLabel="Add another"
      />

      <TextList
        idPrefix="wizard-friction"
        legend="Frictions"
        hint={`Up to ${MAX_ITEMS}. What slows ${who === "they" ? "them" : who} down or wears on ${who === "they" ? "them" : who}.`}
        items={form.frictions}
        onChange={(frictions) => patch({ frictions })}
        placeholder="Waiting days on cross-team reviews"
        addLabel="Add another"
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Starting goals</legend>
        <p className="text-xs text-muted-foreground">
          Up to {MAX_ITEMS}. Readiness is per goal, not per person: it sets how
          much direction and support you give on that goal.
        </p>
        {form.goals.map((goal, i) => {
          const set = (next: Partial<GoalDraft>) =>
            patch({
              goals: form.goals.map((g, j) =>
                j === i ? { ...g, ...next } : g
              ),
            })
          return (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border bg-card p-3"
            >
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Goal ${i + 1}`}
                  value={goal.title}
                  onChange={(e) => set({ title: e.target.value })}
                  placeholder="Ship the first change to production"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove goal ${i + 1}`}
                  onClick={() =>
                    patch({ goals: form.goals.filter((_, j) => j !== i) })
                  }
                >
                  <XIcon />
                </Button>
              </div>
              <div className="grid items-start gap-2 sm:grid-cols-[14rem_1fr]">
                <SimpleSelect
                  aria-label={`Readiness for goal ${i + 1}`}
                  value={goal.readiness}
                  onChange={(readiness) => set({ readiness })}
                  options={readinessOptions}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {readinessLabels[goal.readiness].style}:
                  </span>{" "}
                  {readinessLabels[goal.readiness].guidance}
                </p>
              </div>
            </div>
          )
        })}
        {form.goals.length < MAX_ITEMS && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              patch({ goals: [...form.goals, { title: "", readiness: "D2" }] })
            }
          >
            <PlusIcon /> Add a goal
          </Button>
        )}
      </fieldset>
    </div>
  )
}

/* ------------------------------------------------------------------ review */

function ReviewBlock({
  title,
  step,
  onEdit,
  children,
}: {
  title: string
  step: number
  onEdit: (step: number) => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <h4 className="text-sm font-medium">{title}</h4>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onEdit(step)}
          aria-label={`Edit ${title}`}
        >
          Edit
        </Button>
      </div>
      <dl className="grid gap-x-6 gap-y-2.5 px-4 py-3 sm:grid-cols-2">
        {children}
      </dl>
    </section>
  )
}

function Answer({
  label,
  children,
  wide = false,
  badge,
}: {
  label: string
  children: React.ReactNode
  wide?: boolean
  badge?: React.ReactNode
}) {
  const empty =
    children === undefined ||
    children === null ||
    children === "" ||
    children === false
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {badge}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-sm break-words whitespace-pre-line",
          empty && "text-muted-foreground"
        )}
      >
        {empty ? "Not provided" : children}
      </dd>
    </div>
  )
}

function ReviewStep({
  form,
  derived,
  onEdit,
}: {
  form: WizardForm
  derived: ReturnType<typeof resolve>
  onEdit: (step: number) => void
}) {
  const name = form.name.trim() || "This person"
  const drivers = derived.energizers.length + derived.frictions.length
  const created = [
    `A profile for ${name}`,
    derived.firstAt
      ? `A first ${meetingTypeLabels[derived.firstType]} on ${formatWhen(derived.firstAt)}, ${derived.cadence.durationMin} min`
      : null,
    derived.goals.length
      ? `${plural(derived.goals.length, "goal")} for this quarter`
      : null,
    derived.hasAspiration ? "A career aspiration" : null,
    drivers
      ? `${plural(drivers, "stay driver")}: ${derived.energizers.length} looked forward to, ${plural(derived.frictions.length, "friction")}`
      : null,
  ].filter((line): line is string => line !== null)

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn("rounded-lg border px-4 py-3", toneClasses.brand.badge)}
      >
        <p className="text-sm font-medium">What will be created</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-foreground">
          {created.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-brand" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Everything stays in this browser. Nothing is sent to {name}.
        </p>
      </div>

      <ReviewBlock title="Who" step={0} onEdit={onEdit}>
        <Answer label="Name">{form.name.trim()}</Answer>
        <Answer label="Role">{form.role.trim()}</Answer>
        <Answer label="Level">{form.level.trim()}</Answer>
        <Answer label="Team">{form.team.trim()}</Answer>
        <Answer label="E-mail">{form.email.trim()}</Answer>
        <Answer label="Location">{form.location.trim()}</Answer>
        <Answer label="Start date">
          {form.startDate && formatDay(form.startDate)}
        </Answer>
        <Answer label="Work mode">{workModeLabels[form.workMode]}</Answer>
      </ReviewBlock>

      <ReviewBlock title="How you will meet" step={1} onEdit={onEdit}>
        <Answer label="Manages people or leads a team">
          {form.managesPeople ? "Yes" : "No"}
        </Answer>
        <Answer label="Senior or principal contributor">
          {form.senior ? "Yes" : "No"}
        </Answer>
        <Answer label="Profile">
          {cadenceProfiles[derived.profile].label}
        </Answer>
        <Answer label="Focus">{focusLabels[derived.focus]}</Answer>
        <Answer label="Cadence" wide>
          {cadenceSentence(derived.cadence)}
        </Answer>
      </ReviewBlock>

      <ReviewBlock title="How they like to work" step={2} onEdit={onEdit}>
        <Answer label="Recognition">
          {recognitionLabels[form.recognitionPref]}
        </Answer>
        <Answer label="Last formal review">
          {form.lastReviewDate && formatDay(form.lastReviewDate)}
        </Answer>
        <Answer label="Feedback" wide>
          {form.feedbackStyle.trim()}
        </Answer>
        <Answer
          label="Rapport notes"
          wide
          badge={<StateBadge state="Private" size="sm" />}
        >
          {form.rapportNotes.trim()}
        </Answer>
      </ReviewBlock>

      <ReviewBlock title="Where they are headed" step={3} onEdit={onEdit}>
        <Answer label="Aspiration" wide>
          {form.aspiration.trim()}
        </Answer>
        <Answer label="Track">
          {derived.hasAspiration && careerTrackLabels[form.track]}
        </Answer>
        <Answer label="Target role">
          {derived.hasAspiration && form.targetRole.trim()}
        </Answer>
        <Answer label="Looks forward to" wide>
          {derived.energizers.join("\n")}
        </Answer>
        <Answer label="Frictions" wide>
          {derived.frictions.join("\n")}
        </Answer>
        <Answer label="Starting goals" wide>
          {derived.goals
            .map(
              (g) =>
                `${g.title.trim()} (${g.readiness}, ${readinessLabels[g.readiness].style.toLowerCase()})`
            )
            .join("\n")}
        </Answer>
      </ReviewBlock>
    </div>
  )
}
