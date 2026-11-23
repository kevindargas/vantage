import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { workspace } from "@/lib/vantage/store"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { AddPersonWizard } from "./add-person-wizard"
import { PeopleView } from "./people-view"
import { ProfileView } from "./profile/profile-view"

const push = vi.hoisted(() => vi.fn())

// The views read `?tab=` and `?new=` from the URL, so the mock follows it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

function visit(url: string) {
  window.history.replaceState(null, "", url)
}

beforeEach(() => {
  push.mockClear()
  visit("/people")
})

describe("people roster", () => {
  withSampleWorkspace()

  it("renders a card for every active person", () => {
    render(<PeopleView />)
    const active = workspace.get().people.filter((p) => p.status === "active")
    expect(active.length).toBeGreaterThan(0)
    for (const person of active) {
      expect(screen.getByText(person.name)).toBeInTheDocument()
      expect(screen.getByText(person.name).closest("a")).toHaveAttribute(
        "href",
        `/people/profile?id=${person.id}`
      )
    }
    expect(screen.getByText("Direct reports")).toBeInTheDocument()
  })

  it("filters by search", () => {
    render(<PeopleView />)
    fireEvent.change(screen.getByLabelText("Search people"), {
      target: { value: "maya" },
    })
    expect(screen.getByText("Maya Chen")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    fireEvent.change(screen.getByLabelText("Search people"), {
      target: { value: "no such person" },
    })
    expect(screen.getByText("No one matches")).toBeInTheDocument()
  })

  it("opens the wizard from ?new=1", () => {
    visit("/people?new=1")
    render(<PeopleView />)
    expect(screen.getByText("Add a person")).toBeInTheDocument()
  })
})

describe("empty roster", () => {
  withEmptyWorkspace()

  it("explains what adding a person does and offers the sample team", () => {
    render(<PeopleView />)
    expect(screen.getByText("Add your first direct report")).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Load the sample team" })
    )
    expect(workspace.get().people.length).toBeGreaterThan(0)
    expect(screen.getByText("Direct reports")).toBeInTheDocument()
  })
})

describe("add-person wizard", () => {
  withEmptyWorkspace()

  const next = () =>
    fireEvent.click(screen.getByRole("button", { name: "Next" }))

  it("validates the first step", () => {
    render(<AddPersonWizard open onOpenChange={() => {}} />)
    next()
    expect(screen.getByText("Enter their name.")).toBeInTheDocument()
    expect(screen.getByText("Enter their role.")).toBeInTheDocument()
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument()
  })

  it("walks to the review step and adds the person", () => {
    const onOpenChange = vi.fn()
    render(<AddPersonWizard open onOpenChange={onOpenChange} />)

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Priya Raman" },
    })
    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "Product Designer" },
    })
    next()

    // Starting today makes them a new hire, with onboarding as the focus.
    expect(screen.getByText("Step 2 of 5")).toBeInTheDocument()
    expect(screen.getByText("Suggested")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /New hire/ })).toBeChecked()
    next()

    expect(screen.getByText("Step 3 of 5")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/How do they like to receive/), {
      target: { value: "In writing first" },
    })
    next()

    expect(screen.getByText("Step 4 of 5")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Where do they want to be/), {
      target: { value: "Lead a product area" },
    })
    fireEvent.change(screen.getByLabelText("What they look forward to 1"), {
      target: { value: "User research" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add a goal" }))
    fireEvent.change(screen.getByLabelText("Goal 1"), {
      target: { value: "Ship the first design review" },
    })
    next()

    expect(screen.getByText("Step 5 of 5")).toBeInTheDocument()
    expect(screen.getByText("What will be created")).toBeInTheDocument()
    expect(screen.getByText("A profile for Priya Raman")).toBeInTheDocument()
    expect(screen.getByText("1 goal for this quarter")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Add to my team" }))

    const ws = workspace.get()
    const person = ws.people.find((p) => p.name === "Priya Raman")
    expect(person).toBeDefined()
    expect(person).toMatchObject({
      role: "Product Designer",
      profile: "new-hire",
      focus: "onboarding",
      feedbackStyle: "In writing first",
      cadence: { frequency: "weekly", durationMin: 45, weekday: 2 },
    })
    const id = person!.id
    expect(ws.meetings.filter((m) => m.personId === id)).toHaveLength(1)
    expect(ws.goals.filter((g) => g.personId === id)).toHaveLength(1)
    expect(ws.aspirations.filter((a) => a.personId === id)).toHaveLength(1)
    expect(ws.stayDrivers.filter((d) => d.personId === id)).toHaveLength(1)
    expect(push).toHaveBeenCalledWith(`/people/profile?id=${id}`)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("asks before closing a half-filled form", () => {
    const onOpenChange = vi.fn()
    render(<AddPersonWizard open onOpenChange={onOpenChange} />)
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Priya" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByText("Discard this setup?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe("person profile", () => {
  withSampleWorkspace()

  it.each([
    ["overview", "Needs your attention"],
    ["meetings", "Cadence"],
    ["commitments", "You owe"],
    ["goals", "Active goals"],
    ["blockers", "Open blockers"],
  ])("renders the %s tab for Maya", (tab, heading) => {
    visit(`/people/profile?id=p-maya&tab=${tab}`)
    render(<ProfileView id="p-maya" />)
    expect(
      screen.getByRole("heading", { level: 1, name: "Maya Chen" })
    ).toBeInTheDocument()
    const selected = screen.getByRole("tab", { selected: true })
    expect(selected).toHaveAttribute("aria-selected", "true")
    const panel = screen.getByRole("tabpanel")
    expect(within(panel).getAllByText(heading).length).toBeGreaterThan(0)
  })

  it("lists all ten tabs", () => {
    visit("/people/profile?id=p-maya")
    render(<ProfileView id="p-maya" />)
    expect(screen.getAllByRole("tab")).toHaveLength(10)
  })

  it("marks a commitment done from the commitments tab", () => {
    visit("/people/profile?id=p-maya&tab=commitments")
    render(<ProfileView id="p-maya" />)
    const open = workspace
      .get()
      .commitments.filter((c) => c.personId === "p-maya" && c.status === "open")
    expect(open.length).toBeGreaterThan(0)
    fireEvent.click(
      screen.getByRole("checkbox", { name: `Mark done: ${open[0].text}` })
    )
    expect(
      workspace.get().commitments.find((c) => c.id === open[0].id)?.status
    ).toBe("done")
  })

  it("shows an archived banner with restore", () => {
    visit("/people/profile?id=p-maya")
    const { rerender } = render(<ProfileView id="p-maya" />)
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "More actions" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }))
    rerender(<ProfileView id="p-maya" />)
    expect(workspace.get().people.find((p) => p.id === "p-maya")?.status).toBe(
      "archived"
    )
    fireEvent.click(screen.getByRole("button", { name: "Restore" }))
    expect(workspace.get().people.find((p) => p.id === "p-maya")?.status).toBe(
      "active"
    )
  })

  it("renders not-found for an unknown id", () => {
    visit("/people/profile?id=p-nobody")
    render(<ProfileView id="p-nobody" />)
    expect(
      screen.getByText("We could not find that record")
    ).toBeInTheDocument()
  })
})
