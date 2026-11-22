"use client"

import * as React from "react"
import { cn } from "cn"
import { toast } from "sonner"

import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StateBadge } from "@/components/shared/status-badge"
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
import { cadenceProfiles } from "@/lib/constants"
import { today } from "@/lib/time"
import type { CadenceProfile, Person } from "@/lib/types"
import { actions } from "@/lib/vantage/store"
import {
  cadenceError,
  CadenceFields,
  focusOptions,
  recognitionOptions,
  SimpleSelect,
  workModeOptions,
  type Option,
} from "../parts"

const profileOptions: Option<CadenceProfile>[] = (
  Object.keys(cadenceProfiles) as CadenceProfile[]
).map((value) => ({ value, label: cadenceProfiles[value].label }))

/** Edit a person's details and cadence. */
export function EditPersonSheet({
  person,
  open,
  onOpenChange,
}: {
  person: Person
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
        {/* Mounted with the sheet, so the draft starts from the saved person. */}
        <EditForm person={person} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function EditForm({ person, onDone }: { person: Person; onDone: () => void }) {
  const [draft, setDraft] = React.useState({
    name: person.name,
    role: person.role,
    level: person.level ?? "",
    team: person.team ?? "",
    email: person.email ?? "",
    location: person.location ?? "",
    startDate: person.startDate,
    workMode: person.workMode,
    profile: person.profile,
    focus: person.focus,
    cadence: person.cadence,
    recognitionPref: person.recognitionPref,
    feedbackStyle: person.feedbackStyle ?? "",
    rapportNotes: person.rapportNotes ?? "",
    lastReviewDate: person.lastReviewDate ?? "",
  })
  const [showErrors, setShowErrors] = React.useState(false)
  const set = (next: Partial<typeof draft>) =>
    setDraft((d) => ({ ...d, ...next }))

  const errors = {
    name: draft.name.trim() ? null : "Enter their name.",
    role: draft.role.trim() ? null : "Enter their role.",
    startDate: draft.startDate ? null : "Choose a start date.",
    cadence: cadenceError(draft.cadence),
  }
  const invalid = Object.values(errors).some(Boolean)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (invalid) {
      setShowErrors(true)
      return
    }
    actions.updatePerson(person.id, {
      name: draft.name.trim(),
      role: draft.role.trim(),
      level: draft.level.trim() || undefined,
      team: draft.team.trim() || undefined,
      email: draft.email.trim() || undefined,
      location: draft.location.trim() || undefined,
      startDate: draft.startDate,
      workMode: draft.workMode,
      profile: draft.profile,
      focus: draft.focus,
      cadence: draft.cadence,
      recognitionPref: draft.recognitionPref,
      feedbackStyle: draft.feedbackStyle.trim() || undefined,
      rapportNotes: draft.rapportNotes.trim() || undefined,
      lastReviewDate: draft.lastReviewDate || undefined,
    })
    toast.success("Details saved", { description: draft.name.trim() })
    onDone()
  }

  const show = (key: keyof typeof errors) => (showErrors ? errors[key] : null)

  return (
    <form onSubmit={submit} noValidate className="contents">
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle>Edit details</SheetTitle>
        <SheetDescription>
          Changes to the cadence apply to 1:1s scheduled from now on. Meetings
          already on the list keep their time.
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <FieldGroup className="gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!show("name") || undefined}>
              <FieldLabel htmlFor="edit-name">Name</FieldLabel>
              <Input
                id="edit-name"
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
                aria-invalid={!!show("name") || undefined}
                required
              />
              {show("name") && <FieldError>{show("name")}</FieldError>}
            </Field>
            <Field data-invalid={!!show("role") || undefined}>
              <FieldLabel htmlFor="edit-role">Role</FieldLabel>
              <Input
                id="edit-role"
                value={draft.role}
                onChange={(e) => set({ role: e.target.value })}
                aria-invalid={!!show("role") || undefined}
                required
              />
              {show("role") && <FieldError>{show("role")}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-level">Level</FieldLabel>
              <Input
                id="edit-level"
                value={draft.level}
                onChange={(e) => set({ level: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-team">Team</FieldLabel>
              <Input
                id="edit-team"
                value={draft.team}
                onChange={(e) => set({ team: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-email">E-mail</FieldLabel>
              <Input
                id="edit-email"
                type="email"
                value={draft.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-location">Location</FieldLabel>
              <Input
                id="edit-location"
                value={draft.location}
                onChange={(e) => set({ location: e.target.value })}
              />
            </Field>
            <Field data-invalid={!!show("startDate") || undefined}>
              <FieldLabel htmlFor="edit-start">Start date</FieldLabel>
              <Input
                id="edit-start"
                type="date"
                value={draft.startDate}
                onChange={(e) => set({ startDate: e.target.value })}
                aria-invalid={!!show("startDate") || undefined}
                required
              />
              {show("startDate") && (
                <FieldError>{show("startDate")}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-workmode">Work mode</FieldLabel>
              <SimpleSelect
                id="edit-workmode"
                value={draft.workMode}
                onChange={(workMode) => set({ workMode })}
                options={workModeOptions}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-4 border-t pt-5">
            <h3 className="text-sm font-medium">How you meet</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="edit-profile">Profile</FieldLabel>
                <SimpleSelect
                  id="edit-profile"
                  value={draft.profile}
                  onChange={(profile) => set({ profile })}
                  options={profileOptions}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-focus">Focus right now</FieldLabel>
                <SimpleSelect
                  id="edit-focus"
                  value={draft.focus}
                  onChange={(focus) => set({ focus })}
                  options={focusOptions}
                />
              </Field>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Recommended for this profile:{" "}
              {cadenceProfiles[draft.profile].rationale}
            </p>
            <CadenceFields
              idPrefix="edit-cadence"
              value={draft.cadence}
              onChange={(next) =>
                set({ cadence: { ...draft.cadence, ...next } })
              }
              showErrors={showErrors}
            />
          </div>

          <div className="flex flex-col gap-4 border-t pt-5">
            <h3 className="text-sm font-medium">How they like to work</h3>
            <Field>
              <FieldLabel htmlFor="edit-recognition">Recognition</FieldLabel>
              <SimpleSelect
                id="edit-recognition"
                value={draft.recognitionPref}
                onChange={(recognitionPref) => set({ recognitionPref })}
                options={recognitionOptions}
                className="sm:max-w-56"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-feedback">
                How they like to receive feedback
              </FieldLabel>
              <Textarea
                id="edit-feedback"
                value={draft.feedbackStyle}
                onChange={(e) => set({ feedbackStyle: e.target.value })}
                className="min-h-16"
              />
            </Field>
            <Field>
              <div className="flex items-center gap-2">
                <FieldLabel htmlFor="edit-rapport">Rapport notes</FieldLabel>
                <StateBadge state="Private" size="sm" />
              </div>
              <Textarea
                id="edit-rapport"
                value={draft.rapportNotes}
                onChange={(e) => set({ rapportNotes: e.target.value })}
                className="min-h-16"
              />
              <FieldDescription>
                Only you see these. They never appear in a shared summary or a
                review draft.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-review">Last formal review</FieldLabel>
              <Input
                id="edit-review"
                type="date"
                value={draft.lastReviewDate}
                max={today()}
                onChange={(e) => set({ lastReviewDate: e.target.value })}
                className="sm:max-w-56"
              />
              <FieldDescription>
                Keeps the stay interview well apart from the review.
              </FieldDescription>
            </Field>
          </div>
        </FieldGroup>
      </SheetBody>
      <SheetFooterActions primary={<Button type="submit">Save</Button>} />
    </form>
  )
}
