import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { upcomingMeetings } from "@/lib/vantage/selectors"
import { workspace } from "@/lib/vantage/store"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { QuestionsView } from "./questions-view"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/questions",
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

beforeEach(() => window.history.replaceState(null, "", "/questions"))

const OPENING = "What is the most important thing we should talk about today?"

describe("QuestionsView with the sample team", () => {
  withSampleWorkspace()

  it("lists every question and searches text and purpose", () => {
    render(<QuestionsView />)
    expect(screen.getByText(OPENING)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Search questions and purposes"), {
      target: { value: "hands over the floor" },
    })
    expect(screen.getByText(OPENING)).toBeInTheDocument()
    expect(
      within(screen.getByRole("list", { name: "Questions" })).getAllByRole(
        "listitem"
      )
    ).toHaveLength(1)
    fireEvent.change(screen.getByLabelText("Search questions and purposes"), {
      target: { value: "zzzz" },
    })
    expect(screen.getByText("No questions match")).toBeInTheDocument()
  })

  it("filters to one scenario from the URL and shows its intro", () => {
    window.history.replaceState(null, "", "/questions?scenario=stay")
    render(<QuestionsView />)
    expect(
      screen.getByText(/Five questions on why they stay/)
    ).toBeInTheDocument()
    expect(screen.getByText("1 of 5")).toBeInTheDocument()
    expect(screen.queryByText(OPENING)).not.toBeInTheDocument()
  })

  it("adds a bank question to an upcoming 1:1 as a manager agenda item", () => {
    render(<QuestionsView />)
    const meeting = upcomingMeetings(workspace.get())[0]
    const before = meeting.agenda.length

    fireEvent.click(
      screen.getByRole("button", { name: `Add to a 1:1: ${OPENING}` })
    )
    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getAllByRole("button")[0])

    const after = workspace.get().meetings.find((m) => m.id === meeting.id)!
    expect(after.agenda).toHaveLength(before + 1)
    expect(after.agenda.at(-1)).toMatchObject({
      text: OPENING,
      owner: "manager",
      questionId: "q-open-1",
    })

    // The same 1:1 is now disabled for this question.
    fireEvent.click(
      screen.getByRole("button", { name: `Add to a 1:1: ${OPENING}` })
    )
    expect(
      within(screen.getByRole("dialog")).getAllByRole("button")[0]
    ).toBeDisabled()
  })

  it("adds a custom question and marks it", () => {
    render(<QuestionsView />)
    fireEvent.click(screen.getAllByRole("button", { name: "Add question" })[0])
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "What should we stop doing as a team?" },
    })
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add question",
      })
    )

    expect(workspace.get().customQuestions).toHaveLength(1)
    expect(workspace.get().customQuestions[0]).toMatchObject({
      text: "What should we stop doing as a team?",
      scenario: "opening",
      custom: true,
    })
    expect(
      screen.getByText("What should we stop doing as a team?")
    ).toBeInTheDocument()
    expect(screen.getByText("Custom")).toBeInTheDocument()
  })
})

describe("QuestionsView with an empty workspace", () => {
  withEmptyWorkspace()

  it("still offers the built-in bank and says no 1:1 is scheduled", () => {
    render(<QuestionsView />)
    expect(screen.getByText(OPENING)).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: `Add to a 1:1: ${OPENING}` })
    )
    expect(screen.getByText(/No 1:1 is scheduled/)).toBeInTheDocument()
  })
})
