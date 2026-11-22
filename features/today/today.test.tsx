import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { workspace } from "@/lib/vantage/store"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { TodayView } from "./today-view"

describe("Today with the sample team", () => {
  withSampleWorkspace()

  it("greets the manager and summarizes the day", () => {
    render(<TodayView />)
    expect(
      screen.getByRole("heading", { level: 1, name: /Kevin$/ })
    ).toBeInTheDocument()
    expect(screen.getByText(/^3 conversations today, /)).toBeInTheDocument()
    expect(
      screen.getByText("This is a sample team so you can look around.")
    ).toBeInTheDocument()
  })

  it("renders a brief card for each of the three 1:1s on the day", () => {
    render(<TodayView />)
    const cards = screen.getAllByTestId("brief-card")
    expect(cards).toHaveLength(3)
    expect(within(cards[0]).getByText("Maya Chen")).toBeInTheDocument()
    expect(within(cards[1]).getByText("Priya Nair")).toBeInTheDocument()
    expect(within(cards[2]).getByText("Diego Ramírez")).toBeInTheDocument()
    expect(
      within(cards[2]).getByText(/^Milestone demonstrated/)
    ).toBeInTheDocument()
    for (const card of cards) {
      expect(within(card).getByText("Worth asking")).toBeInTheDocument()
      expect(
        within(card).getByRole("button", { name: /Open 1:1/ })
      ).toHaveAttribute("href", expect.stringMatching(/^\/meetings\/m-/))
    }
  })

  it("lists nudges by severity, including Kenji and Priya", () => {
    render(<TodayView />)
    const urgent = screen.getByTestId("nudges-danger")
    expect(
      within(urgent).getByText("No 1:1 with Kenji in 16 days")
    ).toBeInTheDocument()
    expect(
      within(urgent).getByText("Check in on Priya's workload")
    ).toBeInTheDocument()
    expect(screen.getByTestId("nudges-warning")).toBeInTheDocument()
    expect(screen.getByTestId("nudges-info")).toBeInTheDocument()
    expect(within(urgent).getAllByText(/^Based on:/).length).toBeGreaterThan(0)
  })

  it("removes a nudge when it is dismissed", () => {
    render(<TodayView />)
    const before = screen.getAllByTestId("nudge").length
    fireEvent.click(
      screen.getByRole("button", {
        name: "Dismiss: No 1:1 with Kenji in 16 days",
      })
    )
    expect(screen.getAllByTestId("nudge")).toHaveLength(before - 1)
    expect(
      screen.queryByText("No 1:1 with Kenji in 16 days")
    ).not.toBeInTheDocument()
  })

  it("checks off a carried commitment in place and moves the counts", () => {
    render(<TodayView />)
    const text = "Chase the production read access request"
    const owedBefore = workspace
      .get()
      .commitments.filter(
        (c) => c.owner === "manager" && c.status === "open"
      ).length
    const owed = () =>
      screen.getByText("Open, you owe").closest("[data-stat-card]")!
    expect(owed()).toHaveTextContent(String(owedBefore))
    const boxes = screen.getAllByRole("checkbox").length
    fireEvent.click(
      screen.getByRole("checkbox", { name: `Mark done: ${text}` })
    )
    expect(screen.getAllByRole("checkbox")).toHaveLength(boxes - 1)
    expect(
      screen.queryByRole("checkbox", { name: `Mark done: ${text}` })
    ).not.toBeInTheDocument()
    expect(owed()).toHaveTextContent(String(owedBefore - 1))
  })

  it("shows the working week and a ground rule", () => {
    render(<TodayView />)
    expect(screen.getAllByTestId("week-day")).toHaveLength(5)
    expect(
      screen.getByRole("button", { name: /Open the week/ })
    ).toHaveAttribute("href", "/meetings?view=week")
    expect(
      within(screen.getByTestId("ground-rule")).getByRole("button")
    ).toHaveAttribute("href", "/playbook")
  })
})

describe("Today with an empty workspace", () => {
  withEmptyWorkspace()

  it("shows the first-run state and can load the sample team", () => {
    render(<TodayView />)
    const firstRun = screen.getByTestId("first-run")
    expect(
      within(firstRun).getByRole("button", { name: "Add your first person" })
    ).toHaveAttribute("href", "/people?new=1")
    expect(screen.queryByTestId("brief-card")).not.toBeInTheDocument()
    fireEvent.click(
      within(firstRun).getByRole("button", { name: "Load the sample team" })
    )
    expect(screen.getAllByTestId("brief-card").length).toBeGreaterThan(0)
  })
})
