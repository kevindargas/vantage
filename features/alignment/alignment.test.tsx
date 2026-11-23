import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { buildAlignment } from "@/lib/vantage/alignment"
import { recommendCadence } from "@/lib/vantage/cadence"
import { actions, normalizeWorkspace, workspace } from "@/lib/vantage/store"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { AlignmentView } from "./alignment-view"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/alignment",
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

beforeEach(() => window.history.replaceState(null, "", "/alignment"))

const goalByTitle = (title: string) =>
  workspace.get().goals.find((g) => g.title === title)!

describe("alignment with the sample team", () => {
  withSampleWorkspace()

  it("groups the manager's goals under the business goal they serve", () => {
    const a = buildAlignment(workspace.get())
    expect(a.business).toHaveLength(3)
    expect(a.mine).toHaveLength(5)
    const retention = a.branches.find((b) => b.business?.id === "o-retention")!
    expect(retention.objectives.map((s) => s.objective.id)).toEqual([
      "o-billing",
      "o-spend",
    ])
    // The last branch holds the manager's goals with no business goal.
    expect(a.branches.at(-1)!.business).toBeUndefined()
    expect(a.branches.at(-1)!.objectives[0].objective.id).toBe("o-leads")
  })

  it("reports coverage, gaps and people without a link", () => {
    const a = buildAlignment(workspace.get())
    expect(a.alignedGoals.length + a.unalignedGoals.length).toBe(
      a.teamGoals.length
    )
    expect(a.coverage).toBe(
      Math.round((a.alignedGoals.length / a.teamGoals.length) * 100)
    )
    expect(a.unsupported.map((o) => o.id)).toEqual(["o-spend"])
    expect(a.uncovered).toHaveLength(0)
    expect(a.peopleWithoutLink.map((p) => p.name).sort()).toEqual([
      "Kenji Watanabe",
      "Tom Becker",
    ])
    const uptime = a.branches
      .flatMap((b) => b.objectives)
      .find((s) => s.objective.id === "o-uptime")!
    expect(uptime.goals).toHaveLength(4)
    expect(uptime.people).toHaveLength(3)
    expect(uptime.progress).toBe(
      Math.round(
        uptime.goals.reduce((sum, g) => sum + g.progress, 0) /
          uptime.goals.length
      )
    )
  })

  it("leaves goals on the record when an objective is removed", () => {
    const before = workspace.get().goals.length
    actions.removeObjective("o-retention")
    const ws = workspace.get()
    expect(ws.goals).toHaveLength(before)
    expect(
      ws.objectives.find((o) => o.id === "o-billing")!.parentId
    ).toBeUndefined()
    actions.removeObjective("o-billing")
    expect(
      goalByTitle("Launch usage-based billing").objectiveId
    ).toBeUndefined()
  })

  it("stops counting an objective once it is done", () => {
    actions.setObjectiveStatus("o-uptime", "done", "Held for the year")
    const a = buildAlignment(workspace.get())
    expect(a.mine.some((o) => o.id === "o-uptime")).toBe(false)
    expect(
      a.unalignedGoals.some(
        (g) => g.title === "Cut p95 query latency by 30 percent"
      )
    ).toBe(true)
    const done = workspace.get().objectives.find((o) => o.id === "o-uptime")!
    expect(done.validTo).toBeDefined()
    expect(done.history.at(-1)).toMatchObject({
      status: "done",
      note: "Held for the year",
    })
  })

  it("gives an older sample workspace the sample objectives", () => {
    const legacy = JSON.parse(JSON.stringify(workspace.get()))
    delete legacy.objectives
    for (const g of legacy.goals) delete g.objectiveId
    const upgraded = normalizeWorkspace(legacy)
    expect(upgraded.objectives).toHaveLength(8)
    expect(
      upgraded.goals.find((g) => g.title === "Launch usage-based billing")!
        .objectiveId
    ).toBe("o-billing")
  })

  it("shows the tree and each person's line of sight", () => {
    render(<AlignmentView />)
    const reliable = screen.getByRole("group", {
      name: "Be the most reliable platform in the category",
    })
    const uptime = within(reliable).getByRole("list", {
      name: "Team goals that support Hold 99.95 percent uptime while shipping daily",
    })
    expect(
      within(uptime).getByText("Migrate ingestion to the new pipeline")
    ).toBeInTheDocument()
    expect(
      screen.getByText(/No one on the team has a goal that supports this yet/)
    ).toBeInTheDocument()
    const tom = screen.getByRole("listitem", { name: "Tom Becker" })
    expect(
      within(tom).getByText("0 of 2 goals tied to yours")
    ).toBeInTheDocument()
    expect(screen.getByText("Not yet: Kenji, Tom")).toBeInTheDocument()
  })

  it("adds one of the manager's goals under a business goal", () => {
    render(<AlignmentView />)
    fireEvent.click(screen.getAllByRole("button", { name: "Add my goal" })[0])
    fireEvent.change(screen.getByLabelText("Goal"), {
      target: { value: "Halve incident response time" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add goal" }))
    const added = workspace
      .get()
      .objectives.find((o) => o.title === "Halve incident response time")!
    expect(added).toMatchObject({ level: "manager", status: "on-track" })
    expect(
      screen.getByRole("listitem", { name: "Halve incident response time" })
    ).toBeInTheDocument()
  })
})

describe("alignment with an empty workspace", () => {
  withEmptyWorkspace()

  it("asks for the direction first", () => {
    render(<AlignmentView />)
    expect(screen.getByText("Start with the direction")).toBeInTheDocument()
    expect(buildAlignment(workspace.get()).coverage).toBeNull()
  })

  it("ties a new team goal to one of the manager's goals", () => {
    const personId = actions.addPerson({
      name: "Ada Park",
      role: "Engineer",
      startDate: "2026-01-05",
      workMode: "remote",
      profile: "established-ic",
      cadence: recommendCadence("established-ic", "remote"),
      recognitionPref: "private",
    })
    const mine = actions.addObjective({ level: "manager", title: "Ship v2" })
    const goalId = actions.addGoal({
      personId,
      title: "Build the importer",
      readiness: "D3",
      objectiveId: mine,
    })
    let a = buildAlignment(workspace.get())
    expect(a.coverage).toBe(100)
    expect(a.people[0].objectives.map((o) => o.title)).toEqual(["Ship v2"])
    actions.alignGoal(goalId, undefined)
    a = buildAlignment(workspace.get())
    expect(a.coverage).toBe(0)
    expect(a.peopleWithoutLink.map((p) => p.name)).toEqual(["Ada Park"])
  })
})
