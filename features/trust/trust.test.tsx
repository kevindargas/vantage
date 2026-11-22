import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_SENSITIVE_KEYWORDS, trustGuarantees } from "@/lib/constants"
import { actions, STORAGE_KEY, workspace } from "@/lib/vantage/store"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { TrustView } from "./trust-view"

const search = vi.hoisted(() => ({ value: "" }))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}))
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function renderTab(tab: string) {
  search.value = tab ? `tab=${tab}` : ""
  return render(<TrustView />)
}

const settings = () => workspace.get().settings

describe("trust centre with the sample team", () => {
  withSampleWorkspace()

  it("shows the guarantees and where the data lives", () => {
    renderTab("")
    expect(screen.getAllByTestId("trust-guarantee")).toHaveLength(
      trustGuarantees.length
    )
    expect(screen.getByText("What Vantage never does")).toBeInTheDocument()
    expect(screen.getByText("Records audio")).toBeInTheDocument()
    expect(screen.getByText(STORAGE_KEY)).toBeInTheDocument()
    expect(screen.getByText(/\d+ KB/)).toBeInTheDocument()
  })

  it("lists the consent log with its totals", () => {
    renderTab("consent")
    const log = workspace.get().consentLog
    expect(log.length).toBeGreaterThan(0)
    expect(screen.getByText("Decisions recorded")).toBeInTheDocument()
    expect(screen.getAllByRole("row")).toHaveLength(log.length + 1)
    expect(screen.getByText(/both of you agree/)).toBeInTheDocument()
  })

  it("changes the retention days", () => {
    renderTab("retention")
    fireEvent.change(screen.getByLabelText("Retention in days"), {
      target: { value: "7" },
    })
    expect(settings().transcriptTtlDays).toBe(7)
    expect(screen.getByLabelText("Retention in days")).toHaveValue(7)
  })

  it("asks before turning legal hold on", () => {
    renderTab("retention")
    fireEvent.click(
      screen.getByRole("switch", {
        name: "Keep transcripts past their deletion day",
      })
    )
    expect(settings().legalHold).toBe(false)
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Turn on legal hold",
      })
    )
    expect(settings().legalHold).toBe(true)
  })

  it("deletes every held transcript behind a dialog", () => {
    const meeting = workspace
      .get()
      .meetings.find((m) => m.status === "completed")!
    actions.updateMeeting(meeting.id, {
      transcript: {
        text: "A: hello",
        addedAt: "2026-11-17T10:00:00.000Z",
        expiresOn: "2026-11-30",
      },
    })
    const held = () => workspace.get().meetings.filter((m) => m.transcript)
    expect(held().length).toBeGreaterThan(0)
    renderTab("retention")
    expect(
      screen.getAllByRole("button", { name: /^Delete the transcript/ })
    ).toHaveLength(held().length)
    fireEvent.click(
      screen.getByRole("button", { name: "Delete all transcripts" })
    )
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete all transcripts",
      })
    )
    expect(held()).toHaveLength(0)
    expect(screen.getByText("No transcripts held")).toBeInTheDocument()
  })

  it("adds and removes a sensitive keyword, and the tester follows", () => {
    renderTab("sensitive")
    const line = screen.getByLabelText("Agenda line")
    fireEvent.change(line, {
      target: { value: "Walk through the grievance process" },
    })
    expect(screen.getByText("Capture would be offered")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Add a keyword"), {
      target: { value: "Grievance" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    expect(settings().sensitiveKeywords).toContain("Grievance")
    expect(screen.getByText("Capture not offered")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Remove Grievance" }))
    expect(settings().sensitiveKeywords).not.toContain("Grievance")
    expect(screen.getByText("Capture would be offered")).toBeInTheDocument()
  })

  it("restores the default keywords and toggles works council mode", () => {
    renderTab("sensitive")
    fireEvent.click(screen.getByRole("button", { name: "Remove PIP" }))
    expect(settings().sensitiveKeywords).not.toContain("PIP")
    fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }))
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Restore defaults",
      })
    )
    expect(settings().sensitiveKeywords).toEqual(DEFAULT_SENSITIVE_KEYWORDS)

    const before = settings().worksCouncilMode
    fireEvent.click(
      screen.getByRole("switch", { name: "Show team totals only" })
    )
    expect(settings().worksCouncilMode).toBe(!before)
  })
})

describe("trust centre with an empty workspace", () => {
  withEmptyWorkspace()
  beforeEach(() => {
    search.value = ""
  })

  it("renders every tab with its empty state", () => {
    renderTab("").unmount()
    renderTab("consent")
    expect(screen.getByText("No consent decisions yet")).toBeInTheDocument()
    renderTab("retention")
    expect(screen.getByText("No transcripts held")).toBeInTheDocument()
    renderTab("sensitive")
    expect(
      screen.getByRole("list", { name: "Sensitive keywords" })
    ).toBeInTheDocument()
  })
})
