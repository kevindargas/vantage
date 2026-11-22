"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import { CheckIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { DetailList, type DetailItem } from "@/components/shared/detail-list"
import { Eyebrow } from "@/components/shared/eyebrow"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StateBadge } from "@/components/shared/status-badge"
import { PersonChip } from "@/features/shared/person"
import {
  competencyLabels,
  FEEDBACK_WINDOW_HOURS,
  feedbackKindLabels,
} from "@/lib/constants"
import { dayDistance, firstName, formatDay } from "@/lib/format"
import { daysSince } from "@/lib/time"
import type { FeedbackEntry } from "@/lib/types"
import { flagWording } from "@/lib/vantage/review"
import { getMeeting, getPerson } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"

export function isDraft(entry: FeedbackEntry) {
  return entry.direction === "given" && !entry.deliveredDate
}

/** "Draft", "Delivered" or "Received" for the ledger and the sheet. */
export function deliveryState(entry: FeedbackEntry) {
  if (entry.direction === "upward") return "Received"
  return entry.deliveredDate ? "Delivered" : "Draft"
}

/** True once a draft has sat longer than the delivery window. */
export function pastWindow(entry: FeedbackEntry) {
  return daysSince(entry.observedDate) * 24 > FEEDBACK_WINDOW_HOURS
}

export function markDelivered(entry: FeedbackEntry, name: string) {
  actions.markFeedbackDelivered(entry.id)
  toast.success("Feedback marked as delivered", {
    description: name ? `For ${name}: ${entry.behavior}` : entry.behavior,
  })
}

/** One ledger entry in full: the four SBII parts, dates and wording flags. */
export function FeedbackEntrySheet({
  entry,
  onClose,
}: {
  entry: FeedbackEntry | undefined
  onClose: () => void
}) {
  const ws = workspace.use()
  const [deleting, setDeleting] = React.useState(false)
  const person = entry ? getPerson(ws, entry.personId) : undefined
  const name = firstName(person?.name ?? "")
  const source = entry?.sourceMeetingId
    ? getMeeting(ws, entry.sourceMeetingId)
    : undefined
  const flags = entry
    ? flagWording(`${entry.situation}\n${entry.behavior}\n${entry.impact}`)
    : []

  const parts: { label: string; text?: string; empty: string }[] = entry
    ? [
        { label: "Situation", text: entry.situation, empty: "Not written" },
        { label: "Behavior", text: entry.behavior, empty: "Not written" },
        { label: "Impact", text: entry.impact, empty: "Not written" },
        {
          label: "Intent",
          text: entry.intent,
          empty: "No intent question recorded",
        },
      ]
    : []

  const details: DetailItem[] = entry
    ? [
        {
          label: "Observed",
          value: `${formatDay(entry.observedDate)}, ${dayDistance(entry.observedDate)}`,
        },
        {
          label: entry.direction === "upward" ? "Received" : "Delivered",
          value: entry.deliveredDate
            ? `${formatDay(entry.deliveredDate)}, ${dayDistance(entry.deliveredDate)}`
            : pastWindow(entry)
              ? `Not yet, and past the ${FEEDBACK_WINDOW_HOURS} hour window`
              : `Not yet, still inside the ${FEEDBACK_WINDOW_HOURS} hour window`,
        },
        { label: "Recorded", value: formatDay(entry.recordedAt) },
        {
          label: "Competency",
          value: entry.competency
            ? competencyLabels[entry.competency]
            : undefined,
        },
        {
          label: "Source",
          value: source ? (
            <Link href={`/meetings/${source.id}`}>
              1:1 on {formatDay(source.scheduledAt)}
            </Link>
          ) : (
            "Added outside a 1:1"
          ),
        },
      ]
    : []

  return (
    <>
      <Sheet open={!!entry} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
        >
          {entry && (
            <>
              <SheetHeader className="border-b px-6 py-5">
                <SheetTitle>
                  {entry.direction === "upward"
                    ? "Upward feedback"
                    : `${feedbackKindLabels[entry.kind]} feedback`}
                </SheetTitle>
                <SheetDescription>
                  {entry.direction === "upward"
                    ? `What ${name || "they"} told you about how you manage.`
                    : `What you observed and said to ${name || "them"}.`}
                </SheetDescription>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <PersonChip personId={entry.personId} size="xs" />
                  <StateBadge
                    size="sm"
                    state={feedbackKindLabels[entry.kind]}
                  />
                  {entry.direction === "upward" && (
                    <StateBadge size="sm" state="Upward" />
                  )}
                  <StateBadge size="sm" state={deliveryState(entry)} />
                </div>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                  {parts.map((part) => (
                    <section key={part.label} aria-label={part.label}>
                      <Eyebrow as="h3">{part.label}</Eyebrow>
                      <p
                        className={cn(
                          "mt-1 text-sm leading-relaxed text-pretty",
                          !part.text && "text-muted-foreground"
                        )}
                      >
                        {part.text || part.empty}
                      </p>
                    </section>
                  ))}
                </div>

                <DetailList items={details} variant="rows" dense />

                <section aria-label="Wording check">
                  <Eyebrow>Wording check</Eyebrow>
                  {flags.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      No vague, absolute or character-based wording found.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-2">
                      {flags.map((flag) => (
                        <li
                          key={`${flag.index}-${flag.phrase}`}
                          className="rounded-lg border border-warning/35 bg-warning/10 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-warning-text">
                            &ldquo;{flag.phrase}&rdquo;
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {flag.why}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </SheetBody>
              <SheetFooterActions
                tertiary={
                  <Button
                    variant="ghost"
                    className="text-danger-text hover:text-danger-text"
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2Icon />
                    Delete
                  </Button>
                }
                primary={
                  isDraft(entry) ? (
                    <Button onClick={() => markDelivered(entry, name)}>
                      <CheckIcon />
                      Mark as delivered
                    </Button>
                  ) : undefined
                }
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleting && !!entry} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this feedback entry?</AlertDialogTitle>
            <AlertDialogDescription>
              It is removed from the ledger and from{" "}
              {name ? `${name}'s` : "the person's"} record for good. Review
              evidence that drew on it will no longer include it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!entry) return
                actions.remove("feedback", entry.id)
                setDeleting(false)
                onClose()
                toast.success("Feedback entry deleted", {
                  description: entry.behavior,
                })
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
