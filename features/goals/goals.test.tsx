import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { workspace } from "@/lib/vantage/store"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { GoalsView } from "./goals-view"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/goals",
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

beforeEach(() => window.history.replaceState(null, "", "/goals"))

const TITLE = "Migrate ingestion to the new pipeline"
const goal = () => workspace.get().goals.find((g) => g.title === TITLE)!

describe("GoalsView with the sample team", () => {
  withSampleWorkspace()

  it("lists goals by person with readiness guidance", () => {
    render(<GoalsView />)
    const maya = screen.getByRole("list", { name: "Goals for Maya Chen" })
    expect(within(maya).getByText(TITLE)).toBeInTheDocument()
    expect(within(maya).getByText("2 of 4 key results")).toBeInTheDocument()
    expect(screen.getByText("Lead it this way")).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Readiness levels" })
    ).toHaveTextContent("Self-reliant")
    // Closed goals stay out until asked for.
    expect(screen.queryByText("Ship audit log export")).not.toBeInTheDocument()
  })

  it("changes a goal's status and appends to its history", () => {
    render(<GoalsView />)
    const before = goal().history.length

    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(`Change status of ${TITLE}`),
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "Off track" }))
    fireEvent.change(screen.getByLabelText("Note (optional)"), {
      target: { value: "Approval slipped again" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save status" }))

    const after = goal()
    expect(after.status).toBe("off-track")
    expect(after.history).toHaveLength(before + 1)
    expect(after.history.at(-1)).toMatchObject({
      status: "off-track",
      note: "Approval slipped again",
    })
  })

  it("changes the readiness level", () => {
    render(<GoalsView />)
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`Readiness for ${TITLE}`) })
    )
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /D2.*Coaching/,
      })
    )
    expect(goal().readiness).toBe("D2")
  })

  it("scopes to one person from the URL", () => {
    window.history.replaceState(null, "", "/goals?person=p-maya")
    render(<GoalsView />)
    expect(
      screen.getByRole("list", { name: "Goals for Maya Chen" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("list", { name: "Goals for Tom Becker" })
    ).not.toBeInTheDocument()
  })
})

describe("GoalsView with an empty workspace", () => {
  withEmptyWorkspace()

  it("shows the empty state", () => {
    render(<GoalsView />)
    expect(screen.getByText("No one to set goals with yet")).toBeInTheDocument()
  })
})
