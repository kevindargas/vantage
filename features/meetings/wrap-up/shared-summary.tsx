"use client"

import * as React from "react"
import {
  CheckIcon,
  CopyIcon,
  ListChecksIcon,
  MailIcon,
  PencilIcon,
} from "lucide-react"
import { toast } from "sonner"

import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { meetingTypeLabels } from "@/lib/constants"
import { formatDateTime, formatDayLong, plural } from "@/lib/format"
import { dayOf, now } from "@/lib/time"
import type { Meeting, Person } from "@/lib/types"
import { sharedSummaryText } from "@/lib/vantage/brief"
import { actions, workspace } from "@/lib/vantage/store"
import { buildSummary } from "@/lib/vantage/transcript"
import { confirmedItems } from "./analysis"

/**
 * Step 3: one summary, identical for both people. It can be drafted from the
 * records confirmed in this conversation and edited freely before the manager
 * confirms it. Sharing means copying the text or opening a mail draft.
 */
export function SharedSummary({
  meeting,
  person,
  name,
}: {
  meeting: Meeting
  person: Person
  name: string
}) {
  const ws = workspace.use()
  const uid = React.useId()
  const text = meeting.summary?.text ?? ""
  const topics = meeting.summary?.topics ?? []
  const confirmedAt = meeting.summary?.confirmedAt
  const items = confirmedItems(ws, meeting)
  const shareText = sharedSummaryText(ws, meeting)

  function draft() {
    const previous = meeting.summary
    const built = buildSummary(items, {
      manager: ws.manager.name || "Manager",
      report: person.name,
    })
    actions.updateMeeting(meeting.id, {
      summary: { topics: built.topics, text: built.text },
    })
    toast.success(
      `Summary drafted from ${plural(items.length, "confirmed item")}`,
      {
        description: "Edit it freely before you confirm.",
        action: previous?.text.trim()
          ? {
              label: "Undo",
              onClick: () =>
                actions.updateMeeting(meeting.id, { summary: previous }),
            }
          : undefined,
      }
    )
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText)
      toast.success("Shared summary copied", {
        description: `Paste it into a message to ${name}. Nothing was sent.`,
      })
    } catch {
      toast.error("The summary could not be copied", {
        description: "Select the text and copy it by hand.",
      })
    }
  }

  const subject = `${meetingTypeLabels[meeting.type]} summary, ${formatDayLong(dayOf(meeting.scheduledAt))}`
  const mailto = person.email
    ? `mailto:${person.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        You and {name} get the same text. Private notes and coaching are never
        part of it.
      </p>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={`${uid}-summary`} className="text-sm font-medium">
            Summary
          </label>
          {confirmedAt ? (
            <StateBadge
              state={`Confirmed ${formatDateTime(confirmedAt)}`}
              tone="success"
              icon={<CheckIcon />}
            />
          ) : (
            <StateBadge state="Not confirmed yet" tone="muted" />
          )}
        </div>
        <Textarea
          id={`${uid}-summary`}
          value={text}
          readOnly={!!confirmedAt}
          onChange={(e) =>
            actions.updateMeeting(meeting.id, {
              summary: { topics, text: e.target.value },
            })
          }
          placeholder={`What you and ${name} talked about and agreed, in plain words.`}
          className="min-h-28"
          aria-describedby={`${uid}-summary-help`}
        />
        <p id={`${uid}-summary-help`} className="text-xs text-muted-foreground">
          {confirmedAt
            ? "The summary is locked while it is confirmed. Reopen to change the text."
            : items.length
              ? `${plural(items.length, "confirmed item")} from this conversation can be turned into a draft.`
              : "Accept a suggestion or add a commitment to draft from confirmed items, or write the summary yourself."}
        </p>
      </div>

      {topics.length > 0 && (
        <ul aria-label="Topics" className="flex flex-wrap gap-1.5">
          {topics.map((topic) => (
            <li key={topic}>
              <Badge variant="secondary">{topic}</Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {confirmedAt ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              actions.updateMeeting(meeting.id, { summary: { topics, text } })
            }
          >
            <PencilIcon />
            Reopen to edit
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!items.length}
              onClick={draft}
            >
              <ListChecksIcon />
              Draft from confirmed items
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!text.trim()}
              onClick={() =>
                actions.updateMeeting(meeting.id, {
                  summary: { topics, text, confirmedAt: now().toISOString() },
                })
              }
            >
              <CheckIcon />
              Confirm summary
            </Button>
          </>
        )}
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          <CopyIcon />
          Copy shared summary
        </Button>
        {mailto && (
          <Button variant="outline" size="sm" render={<a href={mailto} />}>
            <MailIcon />
            Open in e-mail
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        The copied text also carries the agenda, the shared notes and the
        commitments.{" "}
        {mailto
          ? `Vantage does not send anything: "Open in e-mail" starts a message to ${name} in your own mail app.`
          : "Vantage does not send anything: paste the text wherever you and they talk."}
      </p>
    </div>
  )
}
