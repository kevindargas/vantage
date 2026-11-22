import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { buildSampleWorkspace } from "@/lib/vantage/sample"
import { workspace } from "@/lib/vantage/store"
import {
  loadWorkspace,
  withEmptyWorkspace,
  withSampleWorkspace,
} from "@/test/workspace"
import { buildInsights } from "./insights-data"
import { InsightsView } from "./insights-view"
import { resolveInsightPeriod } from "./period"

const perPersonBlocks = [
  "cadence-by-person",
  "follow-by-person",
  "ranked-blockers",
  "pulse-heat",
  "feedback-gaps",
  "career-gaps",
]

describe("Team Insights with the sample team", () => {
  withSampleWorkspace()

  it("mounts every section and the per-person blocks", () => {
    render(<InsightsView />)
    for (const title of [
      "Cadence health",
      "Commitments",
      "Blockers",
      "Workload",
      "Feedback rhythm",
      "Growth",
    ])
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument()
    for (const id of perPersonBlocks)
      expect(screen.getByTestId(id)).toBeInTheDocument()
    expect(screen.queryByTestId("works-council-note")).not.toBeInTheDocument()
    expect(
      screen.getByText(/From voluntary 1 to 5 pulses only/)
    ).toBeInTheDocument()
  })

  it("computes its numbers from the workspace", () => {
    const ws = workspace.get()
    const data = buildInsights(ws, 90)
    expect(data.kpis.held).toBeGreaterThan(0)
    expect(data.kpis.heldRate).toBe(
      Math.round(
        (data.kpis.held / (data.kpis.held + data.kpis.cancelled)) * 100
      )
    )
    expect(data.heldPerWeek.reduce((s, w) => s + w.held, 0)).toBe(
      data.kpis.held
    )
    expect(data.cadence).toHaveLength(7)
    expect(data.cadence.every((row) => row.slots.length === 12)).toBe(true)
    expect(buildInsights(ws, 30).kpis.held).toBeLessThan(data.kpis.held)
  })

  it("resolves the period param", () => {
    expect(resolveInsightPeriod("180d").days).toBe(180)
    expect(resolveInsightPeriod("nonsense").days).toBe(90)
    expect(resolveInsightPeriod(null).days).toBe(90)
  })

  it("hides per-person blocks in works council mode", () => {
    const ws = buildSampleWorkspace()
    loadWorkspace({
      ...ws,
      settings: { ...ws.settings, worksCouncilMode: true },
    })
    render(<InsightsView />)
    expect(screen.getByTestId("works-council-note")).toBeInTheDocument()
    for (const id of [...perPersonBlocks, "milestones"])
      expect(screen.queryByTestId(id)).not.toBeInTheDocument()
    expect(screen.queryByText("Maya Chen")).not.toBeInTheDocument()
    expect(
      screen.getByText("1:1s held and cancelled per week")
    ).toBeInTheDocument()
  })
})

describe("Team Insights with an empty workspace", () => {
  withEmptyWorkspace()

  it("shows the empty state", () => {
    render(<InsightsView />)
    expect(screen.getByText("No team to chart yet")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Add a person" })
    ).toHaveAttribute("href", "/people?new=1")
  })

  it("builds empty data without throwing", () => {
    const data = buildInsights(workspace.get(), 90)
    expect(data.kpis.heldRate).toBeNull()
    expect(data.kpis.energy).toBeNull()
    expect(data.followByPerson).toEqual([])
  })
})
