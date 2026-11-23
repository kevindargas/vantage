import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { meetingTypeLabels } from "@/lib/constants"
import { addDays, atTime, today } from "@/lib/time"
import type { Meeting } from "@/lib/types"
import { getPerson, upcomingMeetings } from "@/lib/vantage/selectors"
import { actions, workspace } from "@/lib/vantage/store"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { MeetingView } from "./meeting-view"
import { MeetingsView } from "./meetings-view"

// Read the query string from the real location so `?view=` and friends can be
// set per test.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/meetings",
  useSearchParams: () => new URLSearchParams(window.location.search),
  useParams: () => ({}),
}))

function visit(search = "") {
  window.history.replaceState(null, "", `/meetings${search}`)
}

function firstWith(status: Meeting["status"]) {
  const meeting = workspace.get().meetings.find((m) => m.status === status)
  if (!meeting) throw new Error(`The sample has no ${status} 1:1`)
  return meeting
}

function nameOf(meeting: Meeting) {
  return getPerson(workspace.get(), meeting.personId)?.name ?? ""
}

beforeEach(() => visit())

describe("1:1s list", () => {
  withSampleWorkspace()

  it("renders the upcoming sample 1:1s", () => {
    render(<MeetingsView />)
    const upcoming = upcomingMeetings(workspace.get())
    expect(upcoming.length).toBeGreaterThan(0)
    expect(screen.getAllByText(nameOf(upcoming[0])).length).toBeGreaterThan(0)
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"))
    for (const m of upcoming)
      expect(links).toContain(`/meetings/session?id=${m.id}`)
    expect(screen.getByText("Share held")).toBeInTheDocument()
  })

  it("renders the week view with today marked", () => {
    visit("?view=week")
    render(<MeetingsView />)
    expect(
      screen.getByRole("button", { name: "Previous week" })
    ).toBeInTheDocument()
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "Next week" }))
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(0)
  })

  it("renders the past view as a table", () => {
    visit("?view=past")
    render(<MeetingsView />)
    const table = screen.getByRole("table")
    const held = workspace
      .get()
      .meetings.filter(
        (m) => m.status === "completed" || m.status === "cancelled"
      )
    expect(held.length).toBeGreaterThan(0)
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(1)
  })

  it("scopes to one person and shows a chip to clear it", () => {
    const person = workspace.get().people[0]
    visit(`?person=${person.id}`)
    render(<MeetingsView />)
    expect(
      screen.getByRole("button", {
        name: `Clear the filter on ${person.name}`,
      })
    ).toBeInTheDocument()
    const others = upcomingMeetings(workspace.get()).filter(
      (m) => m.personId !== person.id
    )
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"))
    for (const m of others)
      expect(links).not.toContain(`/meetings/session?id=${m.id}`)
  })

  it("opens the schedule dialog from the URL with the type preselected", () => {
    const person = workspace.get().people[0]
    visit(`?new=1&person=${person.id}&type=career`)
    render(<MeetingsView />)
    expect(screen.getByText("Schedule a 1:1")).toBeInTheDocument()
    expect(
      screen.getAllByText(meetingTypeLabels.career).length
    ).toBeGreaterThan(0)
  })
})

describe("1:1s list without data", () => {
  withEmptyWorkspace()

  it("points to adding a person", () => {
    render(<MeetingsView />)
    expect(screen.getByText("Add a direct report first")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Add a person/ })
    ).toHaveAttribute("href", "/people?new=1")
  })
})

describe("1:1 record", () => {
  withSampleWorkspace()

  afterEach(() => vi.useRealTimers())

  it("renders a scheduled 1:1 in prepare mode", () => {
    const meeting = firstWith("scheduled")
    render(<MeetingView id={meeting.id} />)
    expect(screen.getByText("Shared agenda")).toBeInTheDocument()
    expect(screen.getByText("Carried over")).toBeInTheDocument()
    expect(screen.getByText("Suggested questions")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Start 1:1/ })
    ).toBeInTheDocument()
  })

  it("adds an agenda item through the UI", () => {
    const meeting = firstWith("scheduled")
    render(<MeetingView id={meeting.id} />)
    const input = screen.getByLabelText("Add one of your items")
    fireEvent.change(input, { target: { value: "Review the launch plan" } })
    fireEvent.submit(input.closest("form")!)
    const after = workspace.get().meetings.find((m) => m.id === meeting.id)!
    expect(after.agenda).toHaveLength(meeting.agenda.length + 1)
    expect(after.agenda.at(-1)).toMatchObject({
      text: "Review the launch plan",
      owner: "manager",
      done: false,
    })
    expect(
      screen.getByDisplayValue("Review the launch plan")
    ).toBeInTheDocument()
  })

  it("adds a suggested question to the agenda with its id", () => {
    const meeting = firstWith("scheduled")
    render(<MeetingView id={meeting.id} />)
    const buttons = screen.getAllByRole("button", { name: /^Add to agenda:/ })
    fireEvent.click(buttons[0])
    const after = workspace.get().meetings.find((m) => m.id === meeting.id)!
    expect(after.agenda.at(-1)?.questionId).toMatch(/^q-/)
    expect(after.agenda.at(-1)?.owner).toBe("manager")
  })

  it("offers rescheduling before it lets you cancel", () => {
    const meeting = firstWith("scheduled")
    render(<MeetingView id={meeting.id} />)
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(
      screen.getByText(
        "A cancelled 1:1 tells them it is optional. Move it within the week instead."
      )
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Cancel it anyway" }))
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Release day" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cancel 1:1" }))
    const after = workspace.get().meetings.find((m) => m.id === meeting.id)!
    expect(after.status).toBe("cancelled")
    expect(after.cancelledBy).toBe("manager")
    expect(after.cancelReason).toBe("Release day")
    expect(screen.getByText("This 1:1 was cancelled")).toBeInTheDocument()
  })

  it("renders an in-progress 1:1 in live mode", () => {
    vi.useFakeTimers()
    const meeting = firstWith("scheduled")
    actions.startMeeting(meeting.id)
    const view = render(<MeetingView id={meeting.id} />)
    expect(screen.getByRole("timer")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toBeInTheDocument()
    expect(screen.getByText("Shared notes")).toBeInTheDocument()
    expect(screen.getByText("Private scratchpad")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("switch", { name: "Off the record" }))
    expect(
      screen.getByText(
        "Off the record. Nothing typed or pasted for this stretch is kept."
      )
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Shared notes")).toBeDisabled()
    fireEvent.click(screen.getByRole("switch", { name: "Off the record" }))
    expect(screen.getByLabelText("Shared notes")).toBeEnabled()

    fireEvent.change(screen.getByLabelText("Shared notes"), {
      target: { value: "Agreed to split the migration" },
    })
    fireEvent.blur(screen.getByLabelText("Shared notes"))
    expect(
      workspace.get().meetings.find((m) => m.id === meeting.id)?.sharedNotes
    ).toBe("Agreed to split the migration")

    fireEvent.click(screen.getByRole("button", { name: /Wrap up/ }))
    expect(
      screen.queryByRole("button", { name: /Wrap up/ })
    ).not.toBeInTheDocument()
    view.unmount()
  })

  it("renders a completed 1:1 as a read view", () => {
    const meeting = firstWith("completed")
    render(<MeetingView id={meeting.id} />)
    expect(screen.getByText("Commitments made")).toBeInTheDocument()
    expect(screen.getByText("For you only")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Start 1:1/ })
    ).not.toBeInTheDocument()
  })

  it("renders a cancelled 1:1 with a way back", () => {
    const meeting = firstWith("cancelled")
    render(<MeetingView id={meeting.id} />)
    expect(screen.getByText("This 1:1 was cancelled")).toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: /Reschedule/ }).length
    ).toBeGreaterThan(0)
  })

  it("marks a performance check-in as manual notes", () => {
    const person = workspace.get().people[0]
    const id = actions.scheduleMeeting({
      personId: person.id,
      type: "performance",
      scheduledAt: atTime(addDays(today(), 1), "10:00"),
      durationMin: 30,
    })
    render(<MeetingView id={id} />)
    expect(screen.getByText("Manual notes")).toBeInTheDocument()
    expect(
      screen.getByText(/Performance conversations are documented by hand/)
    ).toBeInTheDocument()
  })

  it("does not mark an ordinary weekly 1:1 as manual notes", () => {
    const person = workspace.get().people[0]
    const id = actions.scheduleMeeting({
      personId: person.id,
      type: "weekly",
      scheduledAt: atTime(addDays(today(), 1), "10:00"),
      durationMin: 30,
    })
    render(<MeetingView id={id} />)
    expect(screen.queryByText("Manual notes")).not.toBeInTheDocument()
  })

  it("renders not-found for an unknown id", () => {
    render(<MeetingView id="m-missing" />)
    expect(
      screen.getByText("We could not find that record")
    ).toBeInTheDocument()
  })
})
