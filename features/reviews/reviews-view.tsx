"use client"

import * as React from "react"
import Link from "next/link"
import {
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  RefreshCwIcon,
  SaveIcon,
  ScaleIcon,
  SearchXIcon,
  SparklesIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { MetricTile } from "@/components/shared/metric-tile"
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useUrlState } from "@/features/ask/use-url-state"
import { copyText, downloadText } from "@/features/settings/files"
import { PersonSelect } from "@/features/shared/person"
import {
  blockerCategoryLabels,
  competencyLabels,
  goalStatusLabels,
  milestoneStatusLabels,
} from "@/lib/constants"
import { firstName, formatDay, plural, timeAgo } from "@/lib/format"
import { parseDay, quarterOf, quarterRange, toDay, today } from "@/lib/time"
import type { CompetencyArea, FeedbackEntry } from "@/lib/types"
import {
  buildReviewEvidence,
  flagWording,
  reviewMarkdown,
  type ReviewEvidence,
} from "@/lib/vantage/review"
import { activePeople, type FollowThrough } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"

type Preset = "quarter" | "last-quarter" | "6m" | "12m" | "custom"

const presetItems: { value: Preset; label: string }[] = [
  { value: "quarter", label: "This quarter" },
  { value: "last-quarter", label: "Last quarter" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "custom", label: "Custom dates" },
]

function monthsBefore(day: string, months: number) {
  const d = parseDay(day)
  d.setMonth(d.getMonth() - months)
  return toDay(d)
}

function presetRange(preset: Exclude<Preset, "custom">) {
  const day = today()
  const quarter = quarterRange(quarterOf(day))
  if (preset === "quarter") return { from: quarter.from, to: day }
  if (preset === "last-quarter")
    return quarterRange(quarterOf(monthsBefore(quarter.from, 1)))
  return { from: monthsBefore(day, preset === "6m" ? 6 : 12), to: day }
}

function hasEvidence(e: ReviewEvidence) {
  const commitments = (f: FollowThrough) => f.done + f.missed + f.open
  return (
    e.meetingsHeld +
      e.goals.length +
      e.recognition.length +
      e.developmental.length +
      e.milestones.length +
      e.blockersResolved.length +
      e.blockersOpen.length +
      commitments(e.theirFollowThrough) +
      commitments(e.yourFollowThrough) >
    0
  )
}

export function ReviewsView() {
  const ws = workspace.use()
  const people = activePeople(ws)
  const [personParam, setPersonId] = useUrlState("person")
  const [preset, setPreset] = React.useState<Preset>("quarter")
  const [custom, setCustom] = React.useState(() => presetRange("quarter"))

  const personId = people.some((p) => p.id === personParam)
    ? (personParam as string)
    : ""
  const range = preset === "custom" ? custom : presetRange(preset)
  const valid = Boolean(range.from && range.to && range.from <= range.to)
  const evidence =
    personId && valid
      ? buildReviewEvidence(ws, personId, range.from, range.to)
      : undefined

  function choosePreset(next: Preset) {
    // Custom starts from the dates on screen, so nothing jumps.
    if (next === "custom") setCustom(range)
    setPreset(next)
  }

  return (
    <>
      <div className="flex items-start gap-3 rounded-xl border bg-muted/30 px-4 py-3">
        <ScaleIcon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <p className="max-w-3xl text-sm leading-relaxed">
          Vantage gathers dated evidence and drafts wording. It never suggests a
          rating, a ranking or an outcome: that judgment is yours.
        </p>
      </div>

      {people.length === 0 ? (
        <EmptyState
          icon={<UserPlusIcon />}
          title="No one to review yet"
          description="Add a direct report and keep their record for a while. A review draft is built from what you logged."
          action={
            <Button render={<Link href="/people?new=1" />}>Add a person</Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,16rem)_minmax(0,12rem)_auto]">
            <div className="grid gap-1.5">
              <Label htmlFor="review-person">Person</Label>
              <PersonSelect
                id="review-person"
                value={personId}
                onChange={setPersonId}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="review-period">Period</Label>
              <Select
                value={preset}
                onValueChange={(v) => v && choosePreset(v as Preset)}
                items={presetItems}
              >
                <SelectTrigger id="review-period" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" ? (
              <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
                <div className="grid gap-1.5">
                  <Label htmlFor="review-from">From</Label>
                  <Input
                    id="review-from"
                    type="date"
                    value={custom.from}
                    max={custom.to || undefined}
                    onChange={(e) =>
                      setCustom((c) => ({ ...c, from: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="review-to">To</Label>
                  <Input
                    id="review-to"
                    type="date"
                    value={custom.to}
                    min={custom.from || undefined}
                    onChange={(e) =>
                      setCustom((c) => ({ ...c, to: e.target.value }))
                    }
                  />
                </div>
              </div>
            ) : (
              <p className="self-end pb-1.5 text-sm text-muted-foreground sm:col-span-2 lg:col-span-1">
                {formatDay(range.from, { year: "numeric" })} to{" "}
                {formatDay(range.to, { year: "numeric" })}
              </p>
            )}
          </div>

          {!personId ? (
            <EmptyState
              icon={<FileTextIcon />}
              title="No person selected"
              description="Pick a direct report to see what is on their record for the period and start a draft."
            />
          ) : !valid || !evidence ? (
            <EmptyState
              icon={<SearchXIcon />}
              title="Check the dates"
              description="The period needs a start day and an end day, with the start first."
            />
          ) : (
            <ReviewWorkbench
              key={personId}
              evidence={evidence}
              onOpenRange={(from, to) => {
                setCustom({ from, to })
                setPreset("custom")
              }}
            />
          )}
        </>
      )}
    </>
  )
}

/* -------------------------------------------------------------- workbench */

type Pending = { kind: "regenerate" } | { kind: "open"; id: string }

function ReviewWorkbench({
  evidence,
  onOpenRange,
}: {
  evidence: ReviewEvidence
  /** Called when a saved draft is opened, so the period matches the draft. */
  onOpenRange: (from: string, to: string) => void
}) {
  const ws = workspace.use()
  const person = evidence.person
  const name = firstName(person.name)
  const [body, setBody] = React.useState("")
  /** The text as last generated, saved or opened. Anything else is an edit. */
  const [baseline, setBaseline] = React.useState("")
  const [draftId, setDraftId] = React.useState<string | undefined>()
  const [pending, setPending] = React.useState<Pending | null>(null)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)

  const drafts = ws.reviews
    .filter((r) => r.personId === person.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const openDraft = drafts.find((d) => d.id === draftId)
  const edited = body.trim() !== "" && body !== baseline
  const toDelete = drafts.find((d) => d.id === deleteId)

  const flags = React.useMemo(() => {
    const groups = new Map<
      string,
      { phrase: string; why: string; count: number }
    >()
    for (const flag of flagWording(body)) {
      const key = flag.phrase.toLowerCase()
      const group = groups.get(key)
      if (group) group.count++
      else groups.set(key, { phrase: flag.phrase, why: flag.why, count: 1 })
    }
    return [...groups.values()]
  }, [body])

  function generate() {
    const text = reviewMarkdown(evidence)
    setBody(text)
    setBaseline(text)
  }

  function open(id: string) {
    const draft = drafts.find((d) => d.id === id)
    if (!draft) return
    setBody(draft.body)
    setBaseline(draft.body)
    setDraftId(draft.id)
    onOpenRange(draft.from, draft.to)
  }

  function confirmPending() {
    if (pending?.kind === "regenerate") generate()
    if (pending?.kind === "open") open(pending.id)
    setPending(null)
  }

  function save() {
    const id = actions.saveReview(
      { personId: person.id, from: evidence.from, to: evidence.to, body },
      openDraft?.id
    )
    setDraftId(id)
    setBaseline(body)
    toast.success(openDraft ? "Draft updated" : "Draft saved", {
      description: `${person.name}, ${formatDay(evidence.from)} to ${formatDay(evidence.to)}. Kept in this workspace.`,
    })
  }

  async function copy() {
    if (await copyText(body)) toast.success("Draft copied to the clipboard")
    else toast.error("Could not copy. Select the text and copy it by hand.")
  }

  function download() {
    const slug = person.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    const filename = `review-${slug}-${evidence.from}-to-${evidence.to}.md`
    downloadText(filename, body, "text/markdown")
    toast.success(`Downloaded ${filename}`)
  }

  function remove() {
    if (!toDelete) return
    actions.remove("reviews", toDelete.id)
    if (toDelete.id === draftId) setDraftId(undefined)
    setDeleteId(null)
    toast.success("Draft deleted")
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <EvidencePanel evidence={evidence} />

      <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Draft</CardTitle>
            <CardDescription>
              {openDraft
                ? `Saved draft, last updated ${timeAgo(openDraft.updatedAt)}.`
                : "A starting point built from the evidence. Edit it freely."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {body.trim() === "" ? (
                <Button onClick={generate}>
                  <SparklesIcon data-icon="inline-start" />
                  Generate draft
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() =>
                    edited ? setPending({ kind: "regenerate" }) : generate()
                  }
                >
                  <RefreshCwIcon data-icon="inline-start" />
                  Regenerate
                </Button>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="review-body">Draft text</Label>
              <Textarea
                id="review-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck
                placeholder={`Generate a draft from ${name}'s record, or start writing.`}
                className="max-h-[70vh] min-h-80 overflow-y-auto font-mono text-sm leading-relaxed md:text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={body.trim() === ""}>
                <SaveIcon data-icon="inline-start" />
                Save draft
              </Button>
              <Button
                variant="outline"
                onClick={copy}
                disabled={body.trim() === ""}
              >
                <CopyIcon data-icon="inline-start" />
                Copy
              </Button>
              <Button
                variant="outline"
                onClick={download}
                disabled={body.trim() === ""}
              >
                <DownloadIcon data-icon="inline-start" />
                Download .md
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Wording check
              <CountPill
                count={flags.length}
                tone={flags.length ? "warning" : "muted"}
                label={plural(flags.length, "phrase").replace(/^\d+ /, "")}
              />
            </CardTitle>
            <CardDescription>
              Phrases that are vague, absolute, about character or that read as
              a rating. Checked as you type.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {body.trim() === "" ? (
              <p className="text-sm text-muted-foreground">
                Nothing to check yet.
              </p>
            ) : flags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No flagged phrases. Every claim should still rest on a dated
                example.
              </p>
            ) : (
              <ul aria-label="Flagged phrases" className="flex flex-col gap-3">
                {flags.map((flag) => (
                  <li key={flag.phrase.toLowerCase()} className="grid gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-warning/15 px-1.5 py-0.5 font-mono text-xs text-warning-text">
                        {flag.phrase}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {plural(flag.count, "time")}
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {flag.why}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Saved drafts for {name}
              <CountPill count={drafts.length} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {drafts.length === 0 ? (
              <EmptyState
                bare
                size="sm"
                icon={<FileTextIcon />}
                title="No saved drafts"
                description={`Save a draft to come back to it. Drafts for ${name} are listed here.`}
              />
            ) : (
              <ul className="flex flex-col divide-y">
                {drafts.map((draft) => (
                  <li
                    key={draft.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {formatDay(draft.from, { year: "numeric" })} to{" "}
                        {formatDay(draft.to, { year: "numeric" })}
                        {draft.id === draftId && (
                          <StateBadge
                            state="Open in editor"
                            tone="info"
                            size="sm"
                          />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated {timeAgo(draft.updatedAt)}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={draft.id === draftId && !edited}
                        onClick={() =>
                          edited
                            ? setPending({ kind: "open", id: draft.id })
                            : open(draft.id)
                        }
                      >
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete the draft for ${formatDay(draft.from)} to ${formatDay(draft.to)}`}
                        onClick={() => setDeleteId(draft.id)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your edits?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "open"
                ? "The editor holds changes you have not saved. Opening the saved draft replaces them."
                : "The editor holds changes you have not saved. A new draft from the evidence replaces them."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my edits</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPending}>
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `The saved draft for ${person.name}, ${formatDay(toDelete.from)} to ${formatDay(toDelete.to)}, is removed from the workspace. The evidence it was built from stays.`
                : "The saved draft is removed from the workspace."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* --------------------------------------------------------------- evidence */

function rateText(f: FollowThrough) {
  return f.rate === null ? "Nothing came due" : `${f.rate}%`
}

function rateHint(f: FollowThrough) {
  return `${f.done} kept, ${f.missed} past due, ${f.open} open`
}

function EvidencePanel({ evidence: e }: { evidence: ReviewEvidence }) {
  const person = e.person
  const name = firstName(person.name)
  const profile = `/people/${person.id}`
  const areas = Object.keys(e.coverage) as CompetencyArea[]
  const thin = areas.filter((k) => e.coverage[k] === 0)
  const blockers = [...e.blockersResolved, ...e.blockersOpen]

  if (!hasEvidence(e))
    return (
      <EmptyState
        icon={<SearchXIcon />}
        title="Nothing on record for this period"
        description={`No 1:1s, goals, feedback, milestones, blockers or commitments are dated inside it for ${name}. Try a longer period, or add to the record first.`}
        action={
          <Button variant="outline" render={<Link href={profile} />}>
            Open {name}&apos;s record
          </Button>
        }
      />
    )

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Evidence on record</CardTitle>
        <CardDescription>
          {formatDay(e.from, { year: "numeric" })} to{" "}
          {formatDay(e.to, { year: "numeric" })}. Each item links to its source.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricTile
            label="1:1s held"
            value={e.meetingsHeld}
            hint={<Link href={`${profile}?tab=meetings`}>See the 1:1s</Link>}
          />
          <MetricTile
            label={`${name} kept`}
            value={rateText(e.theirFollowThrough)}
            hint={rateHint(e.theirFollowThrough)}
          />
          <MetricTile
            label="You kept"
            value={rateText(e.yourFollowThrough)}
            hint={rateHint(e.yourFollowThrough)}
          />
        </div>

        <EvidenceGroup
          title="Goals"
          count={e.goals.length}
          empty="No goals on record for this period."
        >
          {e.goals.map((g) => {
            const done = g.keyResults.filter((k) => k.done).length
            return (
              <EvidenceRow
                key={g.id}
                href={`${profile}?tab=goals`}
                title={g.title}
                meta={`Set ${formatDay(g.validFrom)}${g.keyResults.length ? `, ${done} of ${g.keyResults.length} key results complete` : ""}`}
                badge={<StateBadge state={goalStatusLabels[g.statusAtEnd]} />}
              />
            )
          })}
        </EvidenceGroup>

        <EvidenceGroup
          title="Recognition"
          count={e.recognition.length}
          empty="No recognition was delivered in this period."
        >
          {e.recognition.map((f) => (
            <FeedbackRow key={f.id} entry={f} />
          ))}
        </EvidenceGroup>

        <EvidenceGroup
          title="Developmental feedback"
          count={e.developmental.length}
          empty="No developmental feedback was delivered in this period."
        >
          {e.developmental.map((f) => (
            <FeedbackRow key={f.id} entry={f} />
          ))}
        </EvidenceGroup>

        <EvidenceGroup
          title="Milestones"
          count={e.milestones.length}
          empty="No milestones moved in this period."
        >
          {e.milestones.map((m) => (
            <EvidenceRow
              key={m.id}
              href={`${profile}?tab=career`}
              title={m.title}
              meta={[
                m.competency && competencyLabels[m.competency],
                plural(m.evidence.length, "dated observation"),
              ]
                .filter(Boolean)
                .join(", ")}
              badge={<StateBadge state={milestoneStatusLabels[m.status]} />}
            />
          ))}
        </EvidenceGroup>

        <EvidenceGroup
          title="Blockers"
          count={blockers.length}
          empty="No blockers on record for this period."
        >
          {blockers.map((b) => (
            <EvidenceRow
              key={b.id}
              href={`${profile}?tab=blockers`}
              title={b.title}
              meta={`${blockerCategoryLabels[b.category]}, raised ${plural(b.occurrences.length, "time")} since ${formatDay(b.validFrom)}`}
              badge={
                <StateBadge
                  state={
                    b.status === "resolved"
                      ? "Resolved"
                      : b.status === "escalated"
                        ? "Escalated"
                        : "Open"
                  }
                />
              }
            />
          ))}
        </EvidenceGroup>

        <EvidenceGroup title="Follow-through, both ways">
          <EvidenceRow
            href={`/commitments?person=${person.id}&owner=report`}
            title={`${name}'s commitments`}
            meta={`${rateHint(e.theirFollowThrough)}, from commitments made in the period`}
            badge={
              <span className="text-sm font-medium tabular-nums">
                {rateText(e.theirFollowThrough)}
              </span>
            }
          />
          <EvidenceRow
            href={`/commitments?person=${person.id}&owner=manager`}
            title={`Your commitments to ${name}`}
            meta={`${rateHint(e.yourFollowThrough)}, from commitments made in the period`}
            badge={
              <span className="text-sm font-medium tabular-nums">
                {rateText(e.yourFollowThrough)}
              </span>
            }
          />
        </EvidenceGroup>

        <section className="flex flex-col gap-2">
          <Eyebrow as="h3">Competency coverage</Eyebrow>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {areas.map((area) => (
              <MetricTile
                key={area}
                label={competencyLabels[area]}
                value={e.coverage[area]}
                tone={e.coverage[area] === 0 ? "warning" : undefined}
                hint={
                  e.coverage[area] === 0
                    ? "Thin"
                    : plural(e.coverage[area], "dated item").replace(
                        /^\d+ /,
                        ""
                      )
                }
              />
            ))}
          </div>
          {thin.length > 0 ? (
            <p className="text-sm text-warning-text">
              No dated evidence yet for{" "}
              {thin.map((k) => competencyLabels[k].toLowerCase()).join(", ")}.
              Add observations before drawing a conclusion.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Every area has at least one dated item. Counts come from delivered
              feedback and demonstrated milestones that name an area.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  )
}

function EvidenceGroup({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count?: number
  empty?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Eyebrow as="h3">{title}</Eyebrow>
        {count !== undefined && <CountPill count={count} />}
      </div>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">{children}</ul>
      )}
    </section>
  )
}

function EvidenceRow({
  href,
  title,
  meta,
  badge,
}: {
  href: string
  title: string
  meta?: string
  badge?: React.ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-start justify-between gap-3 px-3 py-2.5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span className="grid min-w-0 gap-0.5">
          <span className="text-sm leading-snug font-medium">{title}</span>
          {meta && (
            <span className="text-xs leading-relaxed text-muted-foreground">
              {meta}
            </span>
          )}
        </span>
        {badge && <span className="shrink-0">{badge}</span>}
      </Link>
    </li>
  )
}

function FeedbackRow({ entry }: { entry: FeedbackEntry }) {
  return (
    <EvidenceRow
      href={`/feedback?entry=${entry.id}`}
      title={entry.behavior}
      meta={[
        `Observed ${formatDay(entry.observedDate)}`,
        entry.deliveredDate && `delivered ${formatDay(entry.deliveredDate)}`,
        entry.competency && competencyLabels[entry.competency],
      ]
        .filter(Boolean)
        .join(", ")}
    />
  )
}
