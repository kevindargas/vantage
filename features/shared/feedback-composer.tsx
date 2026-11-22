"use client"

import * as React from "react"
import { cn } from "cn"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import {
  competencyLabels,
  FEEDBACK_WINDOW_HOURS,
  recognitionLabels,
} from "@/lib/constants"
import { firstName } from "@/lib/format"
import { daysSince, today } from "@/lib/time"
import type {
  CompetencyArea,
  FeedbackDirection,
  FeedbackKind,
} from "@/lib/types"
import { flagWording } from "@/lib/vantage/review"
import { getPerson } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { PersonSelect } from "./person"

export interface FeedbackComposerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  personId?: string
  sourceMeetingId?: string
  /** Prefill from a transcript draft or a nudge. */
  initial?: {
    kind?: FeedbackKind
    direction?: FeedbackDirection
    situation?: string
    behavior?: string
    impact?: string
  }
}

type Mode = "recognition" | "developmental" | "upward"

const competencies = Object.keys(competencyLabels) as CompetencyArea[]
const competencyItems = [
  { value: "none", label: "Not tagged" },
  ...competencies.map((c) => ({ value: c, label: competencyLabels[c] })),
]

const guidance: Record<
  Mode,
  { situation: string; behavior: string; impact: string; intent: string }
> = {
  recognition: {
    situation: "Thursday's incident review for the ingestion outage",
    behavior:
      "Kept the discussion on the timeline and asked each team for one fix",
    impact: "The review ended with three owned fixes and no blame",
    intent: "",
  },
  developmental: {
    situation: "The pull request for the checkout form",
    behavior: "Asked for review three days after opening it",
    impact: "Feedback arrived after the sprint closed, so the fix carried over",
    intent: "What would make asking sooner easier?",
  },
  upward: {
    situation: "Priorities for the sprint changed on a Friday afternoon",
    behavior: "The change was announced without notice or the reason behind it",
    impact: "They lost half a day of planned work",
    intent: "",
  },
}

/**
 * Structured feedback: situation, behavior, impact, and for developmental
 * feedback a question about intent. Flags vague or character-based wording as
 * you type, and warns when corrective feedback is getting old.
 */
export function FeedbackComposer({
  open,
  onOpenChange,
  personId,
  sourceMeetingId,
  initial,
}: FeedbackComposerProps) {
  const ws = workspace.use()
  const startMode: Mode =
    initial?.direction === "upward"
      ? "upward"
      : (initial?.kind ?? "recognition")
  const [person, setPerson] = React.useState(personId ?? "")
  const [mode, setMode] = React.useState<Mode>(startMode)
  const [situation, setSituation] = React.useState(initial?.situation ?? "")
  const [behavior, setBehavior] = React.useState(initial?.behavior ?? "")
  const [impact, setImpact] = React.useState(initial?.impact ?? "")
  const [intent, setIntent] = React.useState("")
  const [observed, setObserved] = React.useState(() => today())
  const [delivered, setDelivered] = React.useState(true)
  const [competency, setCompetency] = React.useState<CompetencyArea | "none">(
    "none"
  )
  const selected = personId ?? person
  const who = getPerson(ws, selected)
  const name = firstName(who?.name ?? "") || "them"
  const hint = guidance[mode]
  const flags = flagWording(`${situation}\n${behavior}\n${impact}`)
  const age = daysSince(observed)
  const stale = mode === "developmental" && age * 24 > FEEDBACK_WINDOW_HOURS

  function reset() {
    setPerson(personId ?? "")
    setMode(startMode)
    setSituation(initial?.situation ?? "")
    setBehavior(initial?.behavior ?? "")
    setImpact(initial?.impact ?? "")
    setIntent("")
    setObserved(today())
    setDelivered(true)
    setCompetency("none")
  }

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) reset()
  }

  const ready =
    !!selected && situation.trim() && behavior.trim() && impact.trim()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    actions.addFeedback({
      personId: selected,
      kind: mode === "recognition" ? "recognition" : "developmental",
      direction: mode === "upward" ? "upward" : "given",
      situation: situation.trim(),
      behavior: behavior.trim(),
      impact: impact.trim(),
      intent: intent.trim() || undefined,
      observedDate: observed,
      deliveredDate: mode === "upward" || delivered ? today() : undefined,
      competency: competency === "none" ? undefined : competency,
      sourceMeetingId,
    })
    toast.success(
      mode === "upward"
        ? "Upward feedback logged"
        : delivered
          ? "Feedback logged as delivered"
          : "Feedback saved as a draft",
      {
        description:
          mode !== "upward" && !delivered
            ? `It will stay on your list until you have said it to ${name}.`
            : behavior.trim(),
      }
    )
    close(false)
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
        <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Write feedback</SheetTitle>
            <SheetDescription>
              Name the situation, what the person did and the effect it had.
              Behavior and dates, never character.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup className="gap-5">
              {!personId && (
                <Field>
                  <FieldLabel htmlFor="fb-person">About</FieldLabel>
                  <PersonSelect
                    id="fb-person"
                    value={person}
                    onChange={setPerson}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel>Kind</FieldLabel>
                <ToggleGroup
                  value={[mode]}
                  onValueChange={(v) => {
                    const next = v[0] as Mode | undefined
                    if (next) setMode(next)
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <ToggleGroupItem value="recognition" className="flex-1">
                    Recognition
                  </ToggleGroupItem>
                  <ToggleGroupItem value="developmental" className="flex-1">
                    Developmental
                  </ToggleGroupItem>
                  <ToggleGroupItem value="upward" className="flex-1">
                    From {name} to you
                  </ToggleGroupItem>
                </ToggleGroup>
                {who && mode === "recognition" && (
                  <FieldDescription>
                    {firstName(who.name)} prefers recognition:{" "}
                    {recognitionLabels[who.recognitionPref].toLowerCase()}.
                  </FieldDescription>
                )}
                {who?.feedbackStyle && mode === "developmental" && (
                  <FieldDescription>
                    How {firstName(who.name)} likes feedback:{" "}
                    {who.feedbackStyle}
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="fb-situation">Situation</FieldLabel>
                <Input
                  id="fb-situation"
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  placeholder={hint.situation}
                  required
                />
                <FieldDescription>
                  When and where. One specific occasion.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="fb-behavior">Behavior</FieldLabel>
                <Textarea
                  id="fb-behavior"
                  value={behavior}
                  onChange={(e) => setBehavior(e.target.value)}
                  placeholder={hint.behavior}
                  className="min-h-16"
                  required
                />
                <FieldDescription>
                  What a camera would have recorded. No interpretation.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="fb-impact">Impact</FieldLabel>
                <Textarea
                  id="fb-impact"
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  placeholder={hint.impact}
                  className="min-h-16"
                  required
                />
                <FieldDescription>
                  The effect on the work, the team or the customer.
                </FieldDescription>
              </Field>
              {mode === "developmental" && (
                <Field>
                  <FieldLabel htmlFor="fb-intent">Intent question</FieldLabel>
                  <Input
                    id="fb-intent"
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    placeholder={hint.intent}
                  />
                  <FieldDescription>
                    Ask what they were aiming for before you assume it.
                  </FieldDescription>
                </Field>
              )}
              {flags.length > 0 && (
                <div className="rounded-lg border border-warning/35 bg-warning/10 px-3 py-2.5">
                  <p className="text-xs font-medium text-warning-text">
                    Wording to tighten
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {flags.slice(0, 4).map((f) => (
                      <li key={`${f.phrase}-${f.index}`}>
                        <span className="font-medium text-foreground">
                          &quot;{f.phrase}&quot;
                        </span>
                        : {f.why}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="fb-observed">Observed on</FieldLabel>
                  <Input
                    id="fb-observed"
                    type="date"
                    value={observed}
                    max={today()}
                    onChange={(e) => setObserved(e.target.value)}
                    required
                  />
                </Field>
                {mode !== "upward" && (
                  <Field>
                    <FieldLabel htmlFor="fb-competency">
                      Evidence for
                    </FieldLabel>
                    <Select
                      value={competency}
                      onValueChange={(v) =>
                        v && setCompetency(v as CompetencyArea | "none")
                      }
                      items={competencyItems}
                    >
                      <SelectTrigger id="fb-competency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {competencyItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
              {stale && (
                <p className="rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning-text">
                  This happened {age} days ago. Corrective feedback lands best
                  within {FEEDBACK_WINDOW_HOURS} hours, in private. Deliver it
                  now rather than waiting for the next 1:1.
                </p>
              )}
              {mode !== "upward" && (
                <Field orientation="horizontal">
                  <Switch
                    id="fb-delivered"
                    checked={delivered}
                    onCheckedChange={setDelivered}
                  />
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel htmlFor="fb-delivered">
                      I have said this to {name}
                    </FieldLabel>
                    <FieldDescription>
                      Leave off to keep it as a draft with a reminder.
                    </FieldDescription>
                  </div>
                </Field>
              )}
            </FieldGroup>
          </SheetBody>
          <SheetFooterActions
            primary={
              <Button type="submit" disabled={!ready}>
                {mode !== "upward" && !delivered
                  ? "Save draft"
                  : "Log feedback"}
              </Button>
            }
          />
        </form>
      </SheetContent>
    </Sheet>
  )
}
