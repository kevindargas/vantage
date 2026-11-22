"use client"

import * as React from "react"
import Link from "next/link"
import {
  BanIcon,
  CheckIcon,
  FileClockIcon,
  HardDriveIcon,
  PlusIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUrlState } from "@/features/ask/use-url-state"
import { PersonChip } from "@/features/shared/person"
import {
  DEFAULT_SENSITIVE_KEYWORDS,
  meetingTypeLabels,
  TRANSCRIPT_TTL_RANGE,
  trustGuarantees,
} from "@/lib/constants"
import {
  firstName,
  formatDateTime,
  formatDay,
  formatNumber,
  plural,
} from "@/lib/format"
import { dayOf, daysUntil, today } from "@/lib/time"
import type { Workspace } from "@/lib/types"
import { getMeeting, getPerson } from "@/lib/vantage/selectors"
import { actions, STORAGE_KEY, workspace } from "@/lib/vantage/store"
import { isSensitive } from "@/lib/vantage/transcript"

const tabs = [
  { value: "overview", label: "Overview" },
  { value: "consent", label: "Consent log" },
  { value: "retention", label: "Retention" },
  { value: "sensitive", label: "Sensitive topics" },
] as const

type TabValue = (typeof tabs)[number]["value"]

const neverDoes = [
  "Records audio",
  "Joins calls",
  "Reads tone or mood",
  "Rates or ranks people",
  "Sends data to a server",
  "Shows your notes to HR",
]

export function TrustView() {
  const ws = workspace.use()
  const [param, setTab] = useUrlState("tab")
  const tab: TabValue = tabs.some((t) => t.value === param)
    ? (param as TabValue)
    : "overview"
  const held = ws.meetings.filter((m) => m.transcript).length

  return (
    <Tabs
      value={tab}
      onValueChange={(value) =>
        setTab(value === "overview" ? null : String(value))
      }
      className="gap-6"
    >
      <TabsList>
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="px-2.5">
            {t.label}
            {t.value === "consent" && (
              <CountPill count={ws.consentLog.length} label="decisions" />
            )}
            {t.value === "retention" && (
              <CountPill count={held} label="transcripts held" />
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="overview">
        <OverviewTab ws={ws} />
      </TabsContent>
      <TabsContent value="consent">
        <ConsentTab ws={ws} />
      </TabsContent>
      <TabsContent value="retention">
        <RetentionTab ws={ws} />
      </TabsContent>
      <TabsContent value="sensitive">
        <SensitiveTab ws={ws} />
      </TabsContent>
    </Tabs>
  )
}

/* ---------------------------------------------------------------- overview */

function storedSize(characters: number) {
  return characters < 1024
    ? plural(characters, "character")
    : `${formatNumber(Math.round(characters / 1024))} KB`
}

function OverviewTab({ ws }: { ws: Workspace }) {
  // Recomputed on every workspace change, because `ws` changed to get here.
  const size = actions.exportWorkspace().length

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {trustGuarantees.map((guarantee) => (
          <li
            key={guarantee.title}
            data-testid="trust-guarantee"
            className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <ShieldCheckIcon
              aria-hidden
              className="size-4.5 text-success-text"
            />
            <h2 className="text-sm leading-snug font-semibold">
              {guarantee.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {guarantee.body}
            </p>
          </li>
        ))}
      </ul>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What Vantage never does</CardTitle>
            <CardDescription>
              These are not settings. There is no switch that turns them on.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {neverDoes.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <BanIcon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDriveIcon
                aria-hidden
                className="size-4 text-muted-foreground"
              />
              Where your data lives
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">
            <p>
              The whole workspace is one document in this browser&apos;s local
              storage, under the key{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs break-all">
                {STORAGE_KEY}
              </code>
              . It holds {plural(ws.people.length, "person", "people")} and{" "}
              {plural(ws.meetings.length, "1:1")}, and comes to about{" "}
              <span className="font-medium tabular-nums">
                {storedSize(size)}
              </span>{" "}
              as an export file.
            </p>
            <p className="text-muted-foreground">
              Clearing this site&apos;s data in the browser deletes it, and
              another browser or device starts empty. Export a copy regularly.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              render={<Link href="/settings" />}
            >
              Export from Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- consent */

function ConsentTab({ ws }: { ws: Workspace }) {
  const log = [...ws.consentLog].sort((a, b) => b.at.localeCompare(a.at))
  const granted = log.filter((e) => e.outcome === "granted").length

  return (
    <div className="flex flex-col gap-6">
      <StatGrid columns={3}>
        <StatCard label="Decisions recorded" value={log.length} />
        <StatCard label="Granted" value={granted} />
        <StatCard label="Declined" value={log.length - granted} />
      </StatGrid>

      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        A transcript can be added to a 1:1 only when both of you agree. Either
        of you can decline, with no consequence and no reason needed. A decline
        is logged the same way as an agreement, so the log shows that the
        question was asked.
      </p>

      {log.length === 0 ? (
        <EmptyState
          icon={<FileClockIcon />}
          title="No consent decisions yet"
          description="The first time you open the capture question in a 1:1, the answer from each of you is logged here."
          action={
            <Button variant="outline" render={<Link href="/meetings" />}>
              Go to 1:1s
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recorded</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>1:1</TableHead>
                <TableHead>You</TableHead>
                <TableHead>They</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.map((event) => {
                const meeting = getMeeting(ws, event.meetingId)
                return (
                  <TableRow key={event.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDateTime(event.at)}
                    </TableCell>
                    <TableCell>
                      <PersonChip personId={event.personId} size="xs" />
                    </TableCell>
                    <TableCell>
                      {meeting ? (
                        <Link
                          href={`/meetings/${meeting.id}`}
                          className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {meetingTypeLabels[meeting.type]},{" "}
                          {formatDay(dayOf(meeting.scheduledAt))}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          1:1 removed
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Answer agreed={event.manager} />
                    </TableCell>
                    <TableCell>
                      <Answer agreed={event.report} />
                    </TableCell>
                    <TableCell>
                      {event.outcome === "granted" ? (
                        <StateBadge state="Granted" tone="success" />
                      ) : (
                        // A decline carries no consequence, so it is not red.
                        <StateBadge state="Declined" tone="neutral" />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function Answer({ agreed }: { agreed: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {agreed ? (
        <CheckIcon aria-hidden className="size-3.5 text-success-text" />
      ) : (
        <XIcon aria-hidden className="size-3.5 text-muted-foreground" />
      )}
      {agreed ? "Agreed" : "Declined"}
    </span>
  )
}

/* --------------------------------------------------------------- retention */

type RetentionConfirm =
  | { kind: "hold-on" }
  | { kind: "hold-off" }
  | { kind: "one"; meetingId: string }
  | { kind: "all" }

function RetentionTab({ ws }: { ws: Workspace }) {
  const { transcriptTtlDays: ttl, legalHold } = ws.settings
  const [confirm, setConfirm] = React.useState<RetentionConfirm | null>(null)
  const held = ws.meetings
    .filter((m) => m.transcript)
    .sort((a, b) =>
      a.transcript!.expiresOn.localeCompare(b.transcript!.expiresOn)
    )
  const pastDate = held.filter((m) => m.transcript!.expiresOn <= today())
  const one =
    confirm?.kind === "one" ? getMeeting(ws, confirm.meetingId) : undefined
  const oneName = one
    ? (getPerson(ws, one.personId)?.name ?? "a removed person")
    : ""

  function setTtl(value: number) {
    if (!Number.isFinite(value)) return
    actions.updateSettings({ transcriptTtlDays: value })
  }

  function run() {
    if (!confirm) return
    if (confirm.kind === "hold-on") {
      actions.updateSettings({ legalHold: true })
      toast.success("Legal hold is on", {
        description: "Transcript deletion is paused until you release it.",
      })
    } else if (confirm.kind === "hold-off") {
      const count = pastDate.length
      actions.updateSettings({ legalHold: false })
      toast.success("Legal hold released", {
        description: count
          ? `${plural(count, "transcript")} past the deletion day ${count === 1 ? "was" : "were"} deleted.`
          : "No transcript was past its deletion day.",
      })
    } else if (confirm.kind === "one") {
      actions.purgeTranscript(confirm.meetingId)
      toast.success("Transcript deleted", {
        description: "The confirmed notes and conversation figures remain.",
      })
    } else {
      const count = actions.purgeAllTranscripts()
      toast.success(`${plural(count, "transcript")} deleted`, {
        description: "The confirmed notes and conversation figures remain.",
      })
    }
    setConfirm(null)
  }

  const dialog: Record<
    RetentionConfirm["kind"],
    { title: string; body: string; action: string; destructive: boolean }
  > = {
    "hold-on": {
      title: "Turn on legal hold?",
      body: "While a hold is on, no transcript is deleted on its deletion day. Turn it on only when you have been told to preserve records. You can still delete a transcript by hand.",
      action: "Turn on legal hold",
      destructive: false,
    },
    "hold-off": {
      title: "Release the legal hold?",
      body: pastDate.length
        ? `Deletion resumes at once. ${plural(pastDate.length, "transcript")} past the deletion day will be deleted now. This cannot be undone.`
        : "Deletion resumes. No transcript is past its deletion day, so nothing is deleted right now.",
      action: "Release hold",
      destructive: pastDate.length > 0,
    },
    one: {
      title: "Delete this transcript now?",
      body: `The transcript text from the 1:1 with ${oneName}${one ? ` on ${formatDay(dayOf(one.scheduledAt))}` : ""} is deleted for good. The notes you confirmed and the conversation shape figures stay.`,
      action: "Delete transcript",
      destructive: true,
    },
    all: {
      title: "Delete all transcripts?",
      body: `The text of ${plural(held.length, "transcript")} is deleted for good, whatever its deletion day${legalHold ? " and despite the legal hold" : ""}. The notes you confirmed and the conversation shape figures stay.`,
      action: "Delete all transcripts",
      destructive: true,
    },
  }
  const copy = confirm ? dialog[confirm.kind] : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Transcript retention</CardTitle>
            <CardDescription>
              How long the text of a transcript is kept after you add it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Slider
                aria-label="Days a transcript is kept"
                value={[ttl]}
                min={TRANSCRIPT_TTL_RANGE.min}
                max={TRANSCRIPT_TTL_RANGE.max}
                step={1}
                onValueChange={(value) =>
                  setTtl(Array.isArray(value) ? value[0] : value)
                }
              />
              <div className="flex shrink-0 items-center gap-2">
                <Label htmlFor="ttl-days" className="sr-only">
                  Retention in days
                </Label>
                <Input
                  id="ttl-days"
                  type="number"
                  inputMode="numeric"
                  min={TRANSCRIPT_TTL_RANGE.min}
                  max={TRANSCRIPT_TTL_RANGE.max}
                  value={ttl}
                  onChange={(e) => setTtl(e.target.valueAsNumber)}
                  className="w-16 tabular-nums"
                />
                <span className="text-sm text-muted-foreground">
                  {ttl === 1 ? "day" : "days"}
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Between {TRANSCRIPT_TTL_RANGE.min} and {TRANSCRIPT_TTL_RANGE.max}{" "}
              days. A new workspace starts at {TRANSCRIPT_TTL_RANGE.default}.
              The setting applies to transcripts you add from now on: one that
              is already held keeps the deletion day it was given.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Deletion removes the transcript text only. What survives: the
              notes you confirmed and the conversation shape figures, such as
              talk share and question counts.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Legal hold
              <StateBadge
                state={legalHold ? "On" : "Off"}
                tone={legalHold ? "warning" : "muted"}
                size="sm"
              />
            </CardTitle>
            <CardDescription>
              Pauses scheduled deletion while records must be preserved.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="legal-hold" className="leading-snug">
                Keep transcripts past their deletion day
              </Label>
              <Switch
                id="legal-hold"
                checked={legalHold}
                onCheckedChange={(next) =>
                  setConfirm({ kind: next ? "hold-on" : "hold-off" })
                }
              />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Releasing a hold deletes anything past its deletion day at once.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Transcripts held now
            <CountPill count={held.length} />
          </CardTitle>
          <CardDescription>
            {legalHold
              ? "Legal hold is on, so nothing is deleted on schedule until you release it."
              : "A transcript is removed the first time Vantage loads on or after its deletion day."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {held.length === 0 ? (
            <EmptyState
              bare
              size="sm"
              icon={<FileClockIcon />}
              title="No transcripts held"
              description="Nothing is waiting for deletion. A transcript shows up here from the moment you add it to a 1:1."
            />
          ) : (
            <>
              <ul className="flex flex-col divide-y rounded-lg border">
                {held.map((meeting) => {
                  const expiresOn = meeting.transcript!.expiresOn
                  const left = daysUntil(expiresOn)
                  const person = getPerson(ws, meeting.personId)
                  return (
                    <li
                      key={meeting.id}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5"
                    >
                      <div className="grid min-w-0 gap-1">
                        <PersonChip personId={meeting.personId} />
                        <p className="text-xs text-muted-foreground">
                          <Link
                            href={`/meetings/${meeting.id}`}
                            className="rounded-sm underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {meetingTypeLabels[meeting.type]},{" "}
                            {formatDay(dayOf(meeting.scheduledAt))}
                          </Link>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right text-sm">
                          <p className="tabular-nums">
                            {legalHold
                              ? "Held"
                              : left <= 0
                                ? "Due for deletion"
                                : `${plural(left, "day")} left`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Deletion day {formatDay(expiresOn)}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Delete the transcript for ${person ? firstName(person.name) : "this 1:1"} now`}
                          onClick={() =>
                            setConfirm({ kind: "one", meetingId: meeting.id })
                          }
                        >
                          Delete now
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <Button
                variant="destructive"
                className="self-start"
                onClick={() => setConfirm({ kind: "all" })}
              >
                Delete all transcripts
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={copy?.destructive ? "destructive" : "default"}
              onClick={run}
            >
              {copy?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* --------------------------------------------------------------- sensitive */

function SensitiveTab({ ws }: { ws: Workspace }) {
  const { sensitiveKeywords: keywords, worksCouncilMode } = ws.settings
  const [draft, setDraft] = React.useState("")
  const [line, setLine] = React.useState("")
  const [restoreOpen, setRestoreOpen] = React.useState(false)

  const word = draft.trim()
  const duplicate = keywords.some((k) => k.toLowerCase() === word.toLowerCase())
  const isDefault =
    keywords.length === DEFAULT_SENSITIVE_KEYWORDS.length &&
    DEFAULT_SENSITIVE_KEYWORDS.every((k) => keywords.includes(k))
  const check = isSensitive("weekly", line, keywords)

  function add() {
    if (!word || duplicate) return
    actions.updateSettings({ sensitiveKeywords: [...keywords, word] })
    setDraft("")
  }

  function remove(keyword: string) {
    actions.updateSettings({
      sensitiveKeywords: keywords.filter((k) => k !== keyword),
    })
  }

  function restore() {
    actions.updateSettings({
      sensitiveKeywords: [...DEFAULT_SENSITIVE_KEYWORDS],
    })
    setRestoreOpen(false)
    toast.success("Default keywords restored")
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Sensitive keywords
            <CountPill count={keywords.length} />
          </CardTitle>
          <CardDescription>
            When a 1:1&apos;s agenda or notes mention one of these words,
            capture is not offered and you take notes by hand.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {keywords.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No keywords. Only performance check-ins are kept manual right now.
            </p>
          ) : (
            <ul
              aria-label="Sensitive keywords"
              className="flex flex-wrap gap-2"
            >
              {keywords.map((keyword) => (
                <li
                  key={keyword}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pr-1 pl-2.5 text-sm"
                >
                  {keyword}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full"
                    aria-label={`Remove ${keyword}`}
                    onClick={() => remove(keyword)}
                  >
                    <XIcon />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="keyword-new">Add a keyword</Label>
              <Input
                id="keyword-new"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Grievance"
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={!word || duplicate}
            >
              <PlusIcon data-icon="inline-start" />
              Add
            </Button>
          </form>
          {duplicate && (
            <p className="text-xs text-muted-foreground">
              That keyword is already on the list.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Whole words only, upper or lower case.
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={isDefault}
              onClick={() => setRestoreOpen(true)}
            >
              Restore defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Try an agenda line</CardTitle>
            <CardDescription>
              See whether capture would be offered for a weekly 1:1 with this on
              the agenda.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sensitive-test">Agenda line</Label>
              <Input
                id="sensitive-test"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="Talk through the compensation review"
                autoComplete="off"
              />
            </div>
            <div
              role="status"
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              {line.trim() === "" ? (
                <span className="text-muted-foreground">
                  Type a line to test it against the list.
                </span>
              ) : check.sensitive ? (
                <>
                  <StateBadge state="Capture not offered" tone="warning" />
                  <span className="text-muted-foreground">
                    {check.reason} Notes are taken by hand.
                  </span>
                </>
              ) : (
                <>
                  <StateBadge state="Capture would be offered" tone="success" />
                  <span className="text-muted-foreground">
                    No keyword matches. Both of you would still have to agree.
                  </span>
                </>
              )}
            </div>
            <p className="border-t pt-3 text-sm leading-relaxed text-muted-foreground">
              One rule does not depend on the list: a{" "}
              {meetingTypeLabels.performance.toLowerCase()} never offers
              capture, whatever is on the agenda.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Works council mode
              <StateBadge
                state={worksCouncilMode ? "On" : "Off"}
                tone={worksCouncilMode ? "info" : "muted"}
                size="sm"
              />
            </CardTitle>
            <CardDescription>
              For workplaces where figures about one named employee need an
              agreement first.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="works-council" className="leading-snug">
                Show team totals only
              </Label>
              <Switch
                id="works-council"
                checked={worksCouncilMode}
                onCheckedChange={(next) =>
                  actions.updateSettings({ worksCouncilMode: next })
                }
              />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              When on, Insights, Coaching, Commitments and Feedback stop
              comparing one person with another and show figures for the team as
              a whole. Each person&apos;s own record stays as it is, and nothing
              is deleted.
            </p>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore the default keywords?</AlertDialogTitle>
            <AlertDialogDescription>
              Your list is replaced with the {DEFAULT_SENSITIVE_KEYWORDS.length}{" "}
              defaults: {DEFAULT_SENSITIVE_KEYWORDS.join(", ")}. Keywords you
              added are removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={restore}>
              Restore defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
