import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { workspace } from "@/lib/vantage/store"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { FeedbackView } from "./feedback-view"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/feedback",
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

beforeEach(() => window.history.replaceState(null, "", "/feedback"))

const DRAFT =
  "Answered for her lead three times when questions were addressed to him"
const draft = () => workspace.get().feedback.find((f) => f.behavior === DRAFT)!

describe("FeedbackView with the sample team", () => {
  withSampleWorkspace()

  it("shows drafts, coverage and the ledger", () => {
    render(<FeedbackView />)
    const waiting = screen.getByRole("list", { name: "Needs delivery" })
    expect(within(waiting).getByText(DRAFT)).toBeInTheDocument()
    expect(within(waiting).getByText(/48 hour window/)).toBeInTheDocument()
    expect(screen.getByText("Coverage by person")).toBeInTheDocument()
    expect(screen.getByText("How to write it")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Added tests for the edge cases reviewers had not asked for"
      )
    ).toBeInTheDocument()
  })

  it("marks a draft as delivered and clears it from Needs delivery", () => {
    render(<FeedbackView />)
    expect(draft().deliveredDate).toBeUndefined()

    fireEvent.click(
      screen.getByRole("button", { name: `Mark as delivered: ${DRAFT}` })
    )

    expect(draft().deliveredDate).toBe("2026-11-18")
    expect(
      screen.queryByRole("list", { name: "Needs delivery" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("Nothing is waiting to be said")
    ).toBeInTheDocument()
  })

  it("opens one entry from ?entry= on first load", () => {
    window.history.replaceState(null, "", `/feedback?entry=${draft().id}`)
    render(<FeedbackView />)
    const sheet = screen.getByRole("dialog")
    expect(
      within(sheet).getByText("Yesterday's planning meeting")
    ).toBeInTheDocument()
    expect(within(sheet).getByText("Situation")).toBeInTheDocument()
    expect(within(sheet).getByText("Intent")).toBeInTheDocument()
    expect(
      within(sheet).getByRole("button", { name: "Mark as delivered" })
    ).toBeInTheDocument()
  })

  it("opens the composer from ?new=1", () => {
    window.history.replaceState(null, "", "/feedback?new=1&person=p-maya")
    render(<FeedbackView />)
    expect(screen.getByRole("dialog")).toHaveTextContent("Write feedback")
  })
})

describe("FeedbackView with an empty workspace", () => {
  withEmptyWorkspace()

  it("shows the empty state", () => {
    render(<FeedbackView />)
    expect(
      screen.getByText("No one to give feedback to yet")
    ).toBeInTheDocument()
  })
})
