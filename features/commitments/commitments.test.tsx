import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { actions, workspace } from "@/lib/vantage/store"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { CommitmentsView } from "./commitments-view"

// Read the real URL, so deep links can be tested.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/commitments",
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

beforeEach(() => window.history.replaceState(null, "", "/commitments"))

function stat(label: string) {
  const card = [...document.querySelectorAll("[data-stat-card]")].find((el) =>
    within(el as HTMLElement).queryByText(label)
  )
  return card?.querySelector("[data-slot=card-title]")?.textContent
}

describe("CommitmentsView with the sample team", () => {
  withSampleWorkspace()

  it("groups open commitments by urgency and shows follow-through", () => {
    render(<CommitmentsView />)
    const overdue = screen.getByRole("list", { name: "Overdue" })
    expect(
      within(overdue).getByText("Chase the production read access request")
    ).toBeInTheDocument()
    expect(within(overdue).getAllByText("You owe").length).toBeGreaterThan(0)
    expect(screen.getByText("Follow-through by person")).toBeInTheDocument()
    expect(stat("Your follow-through")).toMatch(/^\d+%$/)
  })

  it("completes a commitment and moves the KPI", () => {
    render(<CommitmentsView />)
    const before = workspace
      .get()
      .commitments.filter((c) => c.status === "open").length
    expect(stat("Open")).toBe(String(before))

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Mark done: Chase the production read access request",
      })
    )

    const target = workspace
      .get()
      .commitments.find(
        (c) => c.text === "Chase the production read access request"
      )
    expect(target?.status).toBe("done")
    expect(stat("Open")).toBe(String(before - 1))
    expect(
      screen.queryByRole("checkbox", {
        name: "Mark done: Chase the production read access request",
      })
    ).not.toBeInTheDocument()
  })

  it("filters to what the manager owes from the URL", () => {
    window.history.replaceState(null, "", "/commitments?owner=manager")
    render(<CommitmentsView />)
    expect(
      screen.queryAllByText("They owe", { selector: "[data-tone]" })
    ).toHaveLength(0)
    expect(
      screen.getAllByText("You owe", { selector: "[data-tone]" }).length
    ).toBeGreaterThan(0)
  })

  it("opens the add dialog from ?new=1", () => {
    window.history.replaceState(null, "", "/commitments?new=1&person=p-maya")
    render(<CommitmentsView />)
    expect(screen.getByText("Add a commitment")).toBeInTheDocument()
  })

  it("hides the per-person table in works council mode", () => {
    actions.updateSettings({ worksCouncilMode: true })
    render(<CommitmentsView />)
    expect(screen.getByText(/Works council mode is on/)).toBeInTheDocument()
    expect(screen.queryByText("Your rate")).not.toBeInTheDocument()
  })
})

describe("CommitmentsView with an empty workspace", () => {
  withEmptyWorkspace()

  it("shows the empty state", () => {
    render(<CommitmentsView />)
    expect(
      screen.getByText("No one to make commitments with yet")
    ).toBeInTheDocument()
  })
})
