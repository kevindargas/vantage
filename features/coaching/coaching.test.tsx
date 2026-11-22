import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { buildSampleWorkspace } from "@/lib/vantage/sample"
import { workspace } from "@/lib/vantage/store"
import {
  loadWorkspace,
  withEmptyWorkspace,
  withSampleWorkspace,
} from "@/test/workspace"
import { buildCoaching } from "./coaching-data"
import { CoachingView } from "./coaching-view"

describe("Coaching with the sample team", () => {
  withSampleWorkspace()

  it("is marked private and mounts the chart, scorecard and cards", () => {
    render(<CoachingView />)
    expect(screen.getByText("Private")).toBeInTheDocument()
    expect(screen.getByText(/^Only you see this page/)).toBeInTheDocument()
    expect(screen.getByTestId("talk-share-chart")).toBeInTheDocument()
    expect(screen.getByTestId("by-person")).toBeInTheDocument()
    expect(
      within(screen.getByTestId("habits")).getAllByRole("listitem")
    ).toHaveLength(5)
    expect(
      within(screen.getByTestId("theme")).getByText("Your recurring theme")
    ).toBeInTheDocument()
    expect(screen.getAllByTestId("coaching-card")).toHaveLength(6)
    fireEvent.click(screen.getByRole("button", { name: /^Show all/ }))
    expect(screen.getAllByTestId("coaching-card")).toHaveLength(
      workspace.get().coachingCards.length
    )
  })

  it("derives averages, habits and the theme from the workspace", () => {
    const data = buildCoaching(workspace.get())
    expect(data.analyzed.length).toBe(50)
    expect(data.averages!.insideBand).toBeLessThanOrEqual(data.analyzed.length)
    expect(data.habits.map((h) => h.framework)).toEqual([
      "Rogelberg",
      "GROW",
      "Rogelberg",
      "SBII",
      "Project Oxygen",
    ])
    expect(data.habits.every((h) => h.held <= h.total && h.total > 0)).toBe(
      true
    )
    expect(data.theme!.count).toBeGreaterThan(1)
    expect(data.byPerson[0].share).toBeLessThanOrEqual(
      data.byPerson[data.byPerson.length - 1].share
    )
  })

  it("hides the comparison by person in works council mode", () => {
    const ws = buildSampleWorkspace()
    loadWorkspace({
      ...ws,
      settings: { ...ws.settings, worksCouncilMode: true },
    })
    render(<CoachingView />)
    expect(screen.getByTestId("works-council-note")).toBeInTheDocument()
    expect(screen.queryByTestId("by-person")).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.getByTestId("habits")).toBeInTheDocument()
  })
})

describe("Coaching with an empty workspace", () => {
  withEmptyWorkspace()

  it("explains when coaching appears and links to Trust", () => {
    render(<CoachingView />)
    expect(screen.getByText("No coaching yet")).toBeInTheDocument()
    expect(
      screen.getByText(/analyzed from a transcript, with consent from both/)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /consent/ })).toHaveAttribute(
      "href",
      "/trust"
    )
  })
})
