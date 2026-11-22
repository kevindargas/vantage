import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { askExamples } from "@/lib/vantage/ask"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { AskView } from "./ask-view"

const search = vi.hoisted(() => ({ value: "" }))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}))
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function submit(question: string) {
  fireEvent.change(screen.getByLabelText("Your question"), {
    target: { value: question },
  })
  fireEvent.click(screen.getByRole("button", { name: "Ask" }))
}

describe("ask with the sample team", () => {
  withSampleWorkspace()
  beforeEach(() => {
    search.value = ""
  })

  it("says what it is and offers every example", () => {
    render(<AskView />)
    expect(screen.getByText(/It is not a chat\s+model/)).toBeInTheDocument()
    for (const example of askExamples)
      expect(
        screen.getAllByRole("button", { name: example }).length
      ).toBeGreaterThan(0)
    expect(screen.getByText("What you can ask about")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Answer" })).toBeNull()
  })

  it("answers a question with rows and shows how it was read", () => {
    render(<AskView />)
    submit("What do I owe people that is overdue?")

    const answer = within(screen.getByRole("region", { name: "Answer" }))
    const chips = within(
      answer.getByRole("list", { name: "How the question was read" })
    )
    expect(chips.getByText("Topic: Commitments")).toBeInTheDocument()
    expect(chips.getByText("Everyone on the team")).toBeInTheDocument()
    expect(chips.getByText("Any time")).toBeInTheDocument()
    expect(answer.getByText(/open commitments? past due/)).toBeInTheDocument()

    const rows = answer
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/commitments?person="))
    expect(rows.length).toBeGreaterThan(0)
    expect(answer.getByRole("button", { name: "Copy as text" })).toBeEnabled()

    // The question is kept for the session.
    const recent = screen
      .getByText("Recent questions")
      .closest("[data-slot=card]")
    expect(
      within(recent as HTMLElement).getByText(
        "What do I owe people that is overdue?"
      )
    ).toBeInTheDocument()
  })

  it("runs the question in the URL and recognizes a person and a period", () => {
    search.value = `q=${encodeURIComponent("What blocked Maya this quarter?")}`
    render(<AskView />)
    expect(screen.getByLabelText("Your question")).toHaveValue(
      "What blocked Maya this quarter?"
    )
    expect(screen.getByText("Person: Maya Chen")).toBeInTheDocument()
    expect(screen.getByText("Period: this quarter")).toBeInTheDocument()
  })

  it("runs an example chip", () => {
    render(<AskView />)
    fireEvent.click(
      screen.getAllByRole("button", { name: "Which goals are at risk?" })[0]
    )
    expect(screen.getByText("Topic: Goals")).toBeInTheDocument()
  })

  it("suggests other questions when nothing matches", () => {
    render(<AskView />)
    submit("zzzz qqqq")
    expect(screen.getByText("Nothing on record matches")).toBeInTheDocument()
  })
})

describe("ask with an empty workspace", () => {
  withEmptyWorkspace()

  it("renders and points at adding a person", () => {
    search.value = ""
    render(<AskView />)
    expect(screen.getByText("Nothing to ask about yet")).toBeInTheDocument()
    submit("Which goals are at risk?")
    expect(screen.getByText("Topic: Goals")).toBeInTheDocument()
    expect(screen.getByText("Nothing on record matches")).toBeInTheDocument()
  })
})
