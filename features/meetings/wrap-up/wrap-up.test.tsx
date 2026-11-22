import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { TALK_SHARE_MAX, TALK_SHARE_MIN } from "@/lib/constants"
import { formatDayLong } from "@/lib/format"
import type { Meeting, Person } from "@/lib/types"
import { completedMeetings, upcomingMeetings } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { withSampleWorkspace } from "@/test/workspace"
import { confirmedItems } from "./analysis"
import { vttToLines } from "./capture"
import { CoachingCardPanel } from "./coaching-card-panel"
import { WrapUpPanel } from "./wrap-up-panel"

const ws = () => workspace.get()
const meetingNow = (id: string) => ws().meetings.find((m) => m.id === id)!
const maya = (): Person => ws().people.find((p) => p.id === "p-maya")!

/** Start Maya's next scheduled 1:1 and return it. */
function startMayaMeeting(): Meeting {
  const next = upcomingMeetings(ws(), "p-maya")[0]
  actions.updateMeeting(next.id, { agenda: [], sharedNotes: "" })
  actions.startMeeting(next.id)
  return meetingNow(next.id)
}

function grantConsent() {
  fireEvent.click(screen.getByRole("checkbox", { name: /I agree to analyze/ }))
  fireEvent.click(screen.getByRole("checkbox", { name: /Maya has agreed/ }))
  fireEvent.click(screen.getByRole("button", { name: "Record decision" }))
}

function analyzeExample() {
  grantConsent()
  fireEvent.click(screen.getByRole("button", { name: /Load an example/ }))
  fireEvent.click(screen.getByRole("button", { name: "Analyze" }))
}

describe("WrapUpPanel", () => {
  withSampleWorkspace()

  it("keeps a performance conversation manual", () => {
    const meeting = ws().meetings.find((m) => m.type === "performance")!
    const person = ws().people.find((p) => p.id === meeting.personId)!
    render(<WrapUpPanel meeting={meeting} person={person} />)
    expect(screen.getByText("Manual notes")).toBeInTheDocument()
    expect(
      screen.getByText(/Write down the agreed support right after/)
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("Transcript")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Record decision" })
    ).not.toBeInTheDocument()
  })

  it("opens the transcript field only after both agree, and logs it", () => {
    const meeting = startMayaMeeting()
    const before = ws().consentLog.length
    render(<WrapUpPanel meeting={meeting} person={maya()} />)
    expect(screen.queryByLabelText("Transcript")).not.toBeInTheDocument()

    grantConsent()
    expect(screen.getByLabelText("Transcript")).toBeInTheDocument()
    expect(ws().consentLog).toHaveLength(before + 1)
    const event = ws().consentLog.at(-1)!
    expect(event.meetingId).toBe(meeting.id)
    expect(event.outcome).toBe("granted")
  })

  it("keeps capture off when either person declines, and lets it change", () => {
    const meeting = startMayaMeeting()
    render(<WrapUpPanel meeting={meeting} person={maya()} />)
    fireEvent.click(
      screen.getByRole("checkbox", { name: /I agree to analyze/ })
    )
    fireEvent.click(screen.getByRole("button", { name: "Record decision" }))

    expect(
      screen.getByText("Capture is off for this conversation")
    ).toBeInTheDocument()
    expect(screen.getByText(/Maya did not agree/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Transcript")).not.toBeInTheDocument()
    expect(ws().consentLog.at(-1)!.outcome).toBe("declined")
    expect(actions.attachTranscript(meeting.id, "Maya: hello there")).toBe(
      false
    )

    const logged = ws().consentLog.length
    fireEvent.click(screen.getByRole("button", { name: "Change decision" }))
    fireEvent.click(screen.getByRole("checkbox", { name: /Maya has agreed/ }))
    fireEvent.click(screen.getByRole("button", { name: "Record decision" }))
    expect(ws().consentLog).toHaveLength(logged + 1)
    expect(screen.getByLabelText("Transcript")).toBeInTheDocument()
  })

  it("analyzes the example and shows the shape and the draft groups", () => {
    const meeting = startMayaMeeting()
    render(<WrapUpPanel meeting={meeting} person={maya()} />)
    analyzeExample()

    const stats = meetingNow(meeting.id).stats!
    expect(stats).toBeDefined()
    const meter = screen.getByRole("meter")
    expect(meter).toHaveAttribute("aria-valuenow", String(stats.reportShare))
    expect(meter.getAttribute("aria-valuetext")).toContain(
      `Target ${TALK_SHARE_MIN} to ${TALK_SHARE_MAX}%`
    )
    expect(screen.getByText("Your longest turn")).toBeInTheDocument()
    expect(screen.getByText("Open questions")).toBeInTheDocument()

    for (const group of [
      "Commitments",
      "Blockers",
      "Recognition",
      "Career signals",
      "Stated workload pressure",
      "Feedback for you",
    ])
      expect(screen.getByRole("region", { name: group })).toBeInTheDocument()
    expect(screen.getByText(/Nothing is inferred/)).toBeInTheDocument()
    expect(screen.getByText(/^0 of \d+ reviewed$/)).toBeInTheDocument()
    expect(
      screen.getByText(/suggestions? from the transcript (is|are) still/)
    ).toBeInTheDocument()
  })

  it("writes a commitment only when its draft is accepted", () => {
    const meeting = startMayaMeeting()
    render(<WrapUpPanel meeting={meeting} person={maya()} />)
    analyzeExample()
    const from = () =>
      ws().commitments.filter((c) => c.sourceMeetingId === meeting.id)
    expect(from()).toHaveLength(0)

    const group = screen.getByRole("region", { name: "Commitments" })
    const accept = within(group).getAllByRole("button", {
      name: /^Accept commitment/,
    })
    fireEvent.click(accept[0])
    expect(from()).toHaveLength(1)
    expect(from()[0].personId).toBe("p-maya")
    expect(screen.getByText(/^1 of \d+ reviewed$/)).toBeInTheDocument()
    expect(confirmedItems(ws(), meetingNow(meeting.id))).toHaveLength(1)
  })

  it("edits a commitment draft before accepting it", () => {
    const meeting = startMayaMeeting()
    render(<WrapUpPanel meeting={meeting} person={maya()} />)
    analyzeExample()
    const group = screen.getByRole("region", { name: "Commitments" })
    fireEvent.click(
      within(group).getAllByRole("button", { name: /^Edit commitment/ })[0]
    )
    fireEvent.change(within(group).getByLabelText("What"), {
      target: { value: "Name an owner for the pipeline approval" },
    })
    fireEvent.change(within(group).getByLabelText("Due"), {
      target: { value: "2026-11-27" },
    })
    fireEvent.click(
      within(group).getByRole("button", {
        name: /^Accept commitment: .*Name an owner/,
      })
    )
    const made = ws().commitments.find((c) => c.sourceMeetingId === meeting.id)!
    expect(made.text).toBe("Name an owner for the pipeline approval")
    expect(made.dueDate).toBe("2026-11-27")
  })

  it("logs a repeat on the existing blocker instead of a new one", () => {
    const meeting = startMayaMeeting()
    const blockerId = actions.addBlocker({
      personId: "p-maya",
      title: "Platform team approval for the pipeline change",
      category: "cross-team",
    })
    const count = ws().blockers.length
    render(<WrapUpPanel meeting={meeting} person={maya()} />)
    analyzeExample()

    const group = screen.getByRole("region", { name: "Blockers" })
    expect(
      within(group).getByText(
        "Came up again: Platform team approval for the pipeline change"
      )
    ).toBeInTheDocument()
    fireEvent.click(
      within(group).getByRole("button", { name: /^Accept blocker: Came up/ })
    )
    expect(ws().blockers).toHaveLength(count)
    const blocker = ws().blockers.find((b) => b.id === blockerId)!
    expect(blocker.occurrences).toHaveLength(2)
    expect(blocker.occurrences[1].sourceMeetingId).toBe(meeting.id)
  })

  it("writes nothing when a draft is discarded", () => {
    const meeting = startMayaMeeting()
    render(<WrapUpPanel meeting={meeting} person={maya()} />)
    analyzeExample()
    const snapshot = JSON.stringify({
      ...ws(),
      meetings: [],
    })
    for (const button of screen.getAllByRole("button", { name: /^Discard / }))
      fireEvent.click(button)
    expect(JSON.stringify({ ...ws(), meetings: [] })).toBe(snapshot)
    expect(screen.getByText(/^(\d+) of \1 reviewed$/)).toBeInTheDocument()
    expect(
      screen.queryByText(/from the transcript (is|are) still/)
    ).not.toBeInTheDocument()
  })

  it("does not offer a draft again after a reload", () => {
    const meeting = startMayaMeeting()
    const first = render(<WrapUpPanel meeting={meeting} person={maya()} />)
    analyzeExample()
    fireEvent.click(
      screen.getByRole("button", { name: "Accept all commitments" })
    )
    const made = ws().commitments.filter(
      (c) => c.sourceMeetingId === meeting.id
    ).length
    expect(made).toBeGreaterThan(1)
    first.unmount()

    render(<WrapUpPanel meeting={meeting} person={maya()} />)
    expect(
      screen.queryByRole("button", { name: /^Accept commitment/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`^${made} of \\d+ reviewed$`))
    ).toBeInTheDocument()
  })

  it("drafts, confirms and reopens the shared summary", () => {
    const meeting = startMayaMeeting()
    render(<WrapUpPanel meeting={meeting} person={maya()} />)
    const draft = screen.getByRole("button", {
      name: "Draft from confirmed items",
    })
    expect(draft).toBeDisabled()
    analyzeExample()
    fireEvent.click(
      screen.getByRole("button", { name: "Accept all commitments" })
    )
    fireEvent.click(draft)
    const summary = meetingNow(meeting.id).summary!
    expect(summary.text).toContain("Commitments")
    expect(summary.topics).toContain("Commitments")
    expect(summary.confirmedAt).toBeUndefined()

    fireEvent.click(screen.getByRole("button", { name: "Confirm summary" }))
    expect(meetingNow(meeting.id).summary!.confirmedAt).toBeDefined()
    expect(screen.getByText(/^Confirmed Nov/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Reopen to edit" }))
    expect(meetingNow(meeting.id).summary!.confirmedAt).toBeUndefined()
    expect(screen.getByText(/Private notes and coaching are never/))
  })

  it("completes the 1:1 and schedules the next one when none exists", () => {
    const meeting = startMayaMeeting()
    expect(
      upcomingMeetings(ws(), "p-maya").filter((m) => m.status === "scheduled")
    ).toHaveLength(0)
    render(<WrapUpPanel meeting={meeting} person={maya()} />)
    expect(
      screen.getByText("The shared summary is not confirmed yet.")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Complete 1:1" }))

    expect(meetingNow(meeting.id).status).toBe("completed")
    const next = upcomingMeetings(ws(), "p-maya")
    expect(next).toHaveLength(1)
    expect(next[0].status).toBe("scheduled")
    expect(screen.getByText(/^Completed /)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Complete 1:1" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Copy shared summary" })
    ).toBeInTheDocument()
  })

  it("shows the deletion day and keeps the shape after deleting", () => {
    const meeting = completedMeetings(ws(), "p-maya")[0]
    expect(meeting.transcript).toBeDefined()
    render(<WrapUpPanel meeting={meeting} person={maya()} />)
    expect(
      screen.getByText(
        new RegExp(
          `Transcript text will be deleted on ${formatDayLong(meeting.transcript!.expiresOn)} \\(in \\d+ days?\\)`
        )
      )
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Delete transcript now" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Delete transcript" }))
    const after = meetingNow(meeting.id)
    expect(after.transcript).toBeUndefined()
    expect(after.stats).toEqual(meeting.stats)
    expect(screen.getByText(/The transcript text is gone/)).toBeInTheDocument()
    expect(screen.getByRole("meter")).toBeInTheDocument()
  })

  it("says so when legal hold keeps the transcript", () => {
    workspace.set((w) => ({
      ...w,
      settings: { ...w.settings, legalHold: true },
    }))
    const meeting = completedMeetings(ws(), "p-maya")[0]
    render(<WrapUpPanel meeting={meeting} person={maya()} />)
    expect(screen.getByText(/Kept: legal hold is on/)).toBeInTheDocument()
  })

  it("turns a WebVTT file into speaker lines", () => {
    const vtt = [
      "WEBVTT",
      "",
      "1",
      "00:00:01.000 --> 00:00:04.000",
      "<v Kevin Dargas>What is top of mind?</v>",
      "",
      "2",
      "00:00:05.000 --> 00:00:09.000",
      "Maya: The migration.",
    ].join("\n")
    expect(vttToLines(vtt)).toBe(
      "Kevin Dargas: What is top of mind?\nMaya: The migration."
    )
  })
})

describe("CoachingCardPanel", () => {
  withSampleWorkspace()

  it("renders the private card from the conversation shape", () => {
    const meeting = completedMeetings(ws(), "p-maya")[0]
    render(<CoachingCardPanel meeting={meeting} person={maya()} />)
    expect(screen.getByText("Private")).toBeInTheDocument()
    expect(screen.getByText(/Only you see this/)).toBeInTheDocument()
    expect(screen.getByRole("meter")).toHaveAttribute(
      "aria-valuenow",
      String(meeting.stats!.reportShare)
    )
    expect(screen.getByText("Their share")).toBeInTheDocument()
    expect(screen.getByText("What went well")).toBeInTheDocument()
    expect(
      screen.getByRole("table", { name: /share of words by conversation/ })
    ).toBeInTheDocument()
  })

  it("saves the card and the reflection", () => {
    const meeting = completedMeetings(ws(), "p-maya")[0]
    workspace.set((w) => ({
      ...w,
      coachingCards: w.coachingCards.filter((c) => c.meetingId !== meeting.id),
    }))
    render(<CoachingCardPanel meeting={meeting} person={maya()} />)
    fireEvent.click(screen.getByRole("button", { name: "Save coaching card" }))
    const card = ws().coachingCards.find((c) => c.meetingId === meeting.id)!
    expect(card.personId).toBe("p-maya")
    expect(card.stats).toEqual(meeting.stats)
    expect(card.nudges.length).toBeLessThanOrEqual(3)
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled()

    fireEvent.change(
      screen.getByLabelText("What will you do differently next time?"),
      { target: { value: "Wait through the pause." } }
    )
    expect(
      ws().coachingCards.find((c) => c.meetingId === meeting.id)!.reflection
    ).toBe("Wait through the pause.")
  })

  it("keeps the saved card after the transcript text is deleted", () => {
    const meeting = completedMeetings(ws(), "p-maya")[0]
    render(<CoachingCardPanel meeting={meeting} person={maya()} />)
    fireEvent.click(
      screen.getByRole("button", { name: /Save coaching card|Update saved/ })
    )
    const saved = ws().coachingCards.find((c) => c.meetingId === meeting.id)!
    actions.purgeTranscript(meeting.id)
    render(<CoachingCardPanel meeting={meeting} person={maya()} />)
    for (const nudge of saved.nudges)
      expect(screen.getAllByText(nudge.title).length).toBeGreaterThan(0)
  })

  it("offers a private reflection when there is no shape to coach on", () => {
    const meeting = completedMeetings(ws()).find((m) => !m.stats)!
    const person = ws().people.find((p) => p.id === meeting.personId)!
    render(<CoachingCardPanel meeting={meeting} person={person} />)
    expect(screen.getByText("Private")).toBeInTheDocument()
    expect(
      screen.getByText("No coaching for this conversation")
    ).toBeInTheDocument()
    expect(screen.queryByRole("meter")).not.toBeInTheDocument()
    fireEvent.change(
      screen.getByLabelText("What will you do differently next time?"),
      { target: { value: "Ask before advising." } }
    )
    expect(meetingNow(meeting.id).privateNotes).toBe("Ask before advising.")
    expect(ws().coachingCards.some((c) => c.meetingId === meeting.id)).toBe(
      false
    )
  })

  it("hides the per-person trend in works council mode", () => {
    workspace.set((w) => ({
      ...w,
      settings: { ...w.settings, worksCouncilMode: true },
    }))
    const meeting = completedMeetings(ws(), "p-maya")[0]
    render(<CoachingCardPanel meeting={meeting} person={maya()} />)
    expect(screen.getByText(/works council mode is on/)).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })
})
