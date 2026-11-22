import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { workspace } from "@/lib/vantage/store"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { ReviewsView } from "./reviews-view"

const search = vi.hoisted(() => ({ value: "" }))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.value),
}))
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const editor = () => screen.getByLabelText("Draft text") as HTMLTextAreaElement

describe("reviews with the sample team", () => {
  withSampleWorkspace()
  beforeEach(() => {
    search.value = "person=p-maya"
  })

  it("asks for a person when none is selected", () => {
    search.value = ""
    render(<ReviewsView />)
    expect(screen.getByText("No person selected")).toBeInTheDocument()
    expect(screen.getByText(/never suggests/)).toBeInTheDocument()
  })

  it("shows the evidence for the person in the URL", () => {
    render(<ReviewsView />)
    expect(screen.getByText("Evidence on record")).toBeInTheDocument()
    expect(screen.getByText("Competency coverage")).toBeInTheDocument()
    expect(screen.getByText("Saved drafts for Maya")).toBeInTheDocument()
    expect(screen.getByText("No saved drafts")).toBeInTheDocument()
  })

  it("generates a draft and flags vague wording as the manager types", () => {
    render(<ReviewsView />)
    expect(editor().value).toBe("")
    fireEvent.click(screen.getByRole("button", { name: "Generate draft" }))
    expect(editor().value).toContain("# Review evidence: Maya Chen")

    fireEvent.change(editor(), {
      target: { value: `${editor().value}\nMaya has always a great attitude.` },
    })
    const flags = within(screen.getByRole("list", { name: "Flagged phrases" }))
    expect(flags.getByText("always")).toBeInTheDocument()
    expect(flags.getByText("great attitude")).toBeInTheDocument()
    expect(flags.getByText(/Name the occasions/)).toBeInTheDocument()
  })

  it("asks before a new draft replaces edits", () => {
    render(<ReviewsView />)
    fireEvent.click(screen.getByRole("button", { name: "Generate draft" }))
    fireEvent.change(editor(), { target: { value: "My own words." } })
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))
    const dialog = within(screen.getByRole("alertdialog"))
    expect(dialog.getByText("Replace your edits?")).toBeInTheDocument()
    expect(editor().value).toBe("My own words.")
    fireEvent.click(dialog.getByRole("button", { name: "Replace" }))
    expect(editor().value).toContain("# Review evidence: Maya Chen")
  })

  it("saves a draft, lists it and deletes it behind a dialog", () => {
    render(<ReviewsView />)
    fireEvent.click(screen.getByRole("button", { name: "Generate draft" }))
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }))

    const saved = workspace.get().reviews
    expect(saved).toHaveLength(1)
    expect(saved[0].personId).toBe("p-maya")
    expect(saved[0].body).toContain("Maya Chen")
    expect(saved[0].from <= saved[0].to).toBe(true)
    expect(screen.getByText("Open in editor")).toBeInTheDocument()

    // Saving again updates the same draft instead of adding one.
    fireEvent.change(editor(), { target: { value: "Shorter." } })
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }))
    expect(workspace.get().reviews).toHaveLength(1)
    expect(workspace.get().reviews[0].body).toBe("Shorter.")

    fireEvent.click(screen.getByRole("button", { name: /^Delete the draft/ }))
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete draft",
      })
    )
    expect(workspace.get().reviews).toHaveLength(0)
  })
})

describe("reviews with an empty workspace", () => {
  withEmptyWorkspace()

  it("explains that there is no one to review", () => {
    search.value = "person=p-maya"
    render(<ReviewsView />)
    expect(screen.getByText("No one to review yet")).toBeInTheDocument()
    expect(screen.queryByLabelText("Draft text")).not.toBeInTheDocument()
  })
})
