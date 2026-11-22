import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { HIGH_WORKLOAD_THRESHOLD } from "@/lib/constants"
import { addDays, today } from "@/lib/time"
import type { Person } from "@/lib/types"
import { actions, workspace } from "@/lib/vantage/store"
import { withSampleWorkspace } from "@/test/workspace"
import { CareerTab } from "./career-tab"
import { FeedbackTab } from "./feedback-tab"
import { RetentionTab } from "./retention-tab"
import { TimelineTab } from "./timeline-tab"
import { WellbeingTab } from "./wellbeing-tab"

const search = vi.hoisted(() => ({ value: "" }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(search.value),
  useParams: () => ({}),
}))

const tabs = {
  feedback: FeedbackTab,
  career: CareerTab,
  wellbeing: WellbeingTab,
  retention: RetentionTab,
  timeline: TimelineTab,
}
const sampleIds = ["p-maya", "p-priya", "p-diego", "p-sofia"]

function person(id: string): Person {
  const found = workspace.get().people.find((p) => p.id === id)
  if (!found) throw new Error(`No person ${id}`)
  return found
}

/** Render a tab that follows the workspace, the way the profile shell does. */
function Live({ id, tab }: { id: string; tab: keyof typeof tabs }) {
  const ws = workspace.use()
  const Tab = tabs[tab]
  const found = ws.people.find((p) => p.id === id)
  return found ? <Tab person={found} /> : null
}

function addBlankPerson() {
  return actions.addPerson({
    name: "Rina Okafor",
    role: "Engineer",
    startDate: today(),
    workMode: "remote",
    profile: "established-ic",
    cadence: {
      frequency: "weekly",
      durationMin: 30,
      weekday: 2,
      time: "10:00",
    },
    recognitionPref: "either",
    scheduleFirst: false,
  })
}

describe("person profile pillar tabs", () => {
  withSampleWorkspace()
  beforeEach(() => {
    search.value = ""
  })

  it.each(sampleIds)("renders all five tabs for %s", (id) => {
    for (const tab of Object.keys(tabs) as (keyof typeof tabs)[]) {
      const { unmount } = render(<Live id={id} tab={tab} />)
      expect(document.body.textContent).not.toBe("")
      unmount()
    }
  })

  describe("feedback", () => {
    it("shows the ledger with labelled parts and preferences", () => {
      render(<Live id="p-sofia" tab="feedback" />)
      expect(screen.getByText("Recognition preference")).toBeInTheDocument()
      expect(
        screen.getByText("Yesterday's planning meeting")
      ).toBeInTheDocument()
      expect(screen.getAllByText("Situation").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Behavior").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Impact").length).toBeGreaterThan(0)
      expect(screen.getByText("Evidence coverage")).toBeInTheDocument()
    })

    it("marks a draft as delivered", () => {
      actions.addFeedback({
        personId: "p-maya",
        kind: "developmental",
        direction: "given",
        situation: "Monday stand-up",
        behavior: "Gave the update for a teammate",
        impact: "The teammate did not speak",
        observedDate: addDays(today(), -5),
      })
      render(<Live id="p-maya" tab="feedback" />)
      expect(screen.getByText(/past the 48 hour window/)).toBeInTheDocument()
      const before = screen.queryAllByText("Not delivered").length
      fireEvent.click(
        screen.getAllByRole("button", { name: "Mark as delivered" })[0]
      )
      expect(screen.queryAllByText("Not delivered").length).toBe(before - 1)
      const drafts = workspace
        .get()
        .feedback.filter((f) => f.personId === "p-maya" && !f.deliveredDate)
      expect(drafts.length).toBe(before - 1)
    })

    it("deletes an entry after confirmation", () => {
      render(<Live id="p-sofia" tab="feedback" />)
      const count = () =>
        workspace.get().feedback.filter((f) => f.personId === "p-sofia").length
      const before = count()
      fireEvent.click(
        screen.getAllByRole("button", { name: "Delete entry" })[0]
      )
      expect(count()).toBe(before)
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Delete entry",
        })
      )
      expect(count()).toBe(before - 1)
    })

    it("has an empty state for a new person", () => {
      const id = addBlankPerson()
      render(<Live id={id} tab="feedback" />)
      expect(screen.getByText("No feedback on the record")).toBeInTheDocument()
    })
  })

  describe("career", () => {
    it("shows both of Maya's aspirations", () => {
      render(<Live id="p-maya" tab="career" />)
      expect(
        screen.getByText(/Grow on the staff engineer track/)
      ).toBeInTheDocument()
      expect(
        screen.getByText("Move into engineering management within two years")
      ).toBeInTheDocument()
      expect(screen.getByText("Aspiration history")).toBeInTheDocument()
      expect(screen.getByText("Stretch assignments")).toBeInTheDocument()
    })

    it("leads with the onboarding track for Diego", () => {
      render(<Live id="p-diego" tab="career" />)
      expect(screen.getByText("First 90 days")).toBeInTheDocument()
      for (const day of [7, 30, 60, 90])
        expect(screen.getByText(`Day ${day}`)).toBeInTheDocument()
      expect(screen.getByText("Onboarding checkpoints")).toBeInTheDocument()
    })

    it("moves a milestone and records a new aspiration", () => {
      render(<Live id="p-maya" tab="career" />)
      const title = "Capacity planning for a shared service"
      fireEvent.change(screen.getByLabelText(`Status of ${title}`), {
        target: { value: "demonstrated" },
      })
      const moved = workspace.get().milestones.find((m) => m.title === title)
      expect(moved?.status).toBe("demonstrated")
      expect(moved?.history.at(-1)?.status).toBe("demonstrated")

      fireEvent.click(screen.getByRole("button", { name: "Update aspiration" }))
      expect(screen.getByText(/not overwritten/)).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText("Aspiration"), {
        target: { value: "Become a principal engineer" },
      })
      fireEvent.click(screen.getByRole("button", { name: "Save aspiration" }))
      expect(
        screen.getByText("Become a principal engineer")
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Grow on the staff engineer track/)
      ).toBeInTheDocument()
      expect(
        workspace.get().aspirations.filter((a) => a.personId === "p-maya")
      ).toHaveLength(3)
    })

    it("adds evidence to a milestone", () => {
      render(<Live id="p-maya" tab="career" />)
      fireEvent.click(
        screen.getAllByRole("button", { name: "Add evidence" })[0]
      )
      fireEvent.change(
        screen.getByPlaceholderText("What you saw, in one line"),
        {
          target: { value: "Ran the review without help" },
        }
      )
      fireEvent.click(screen.getByRole("button", { name: "Save evidence" }))
      expect(
        screen.getByText("Ran the review without help")
      ).toBeInTheDocument()
    })

    it("has empty states for a new person", () => {
      const id = addBlankPerson()
      render(<Live id={id} tab="career" />)
      expect(screen.getByText("No aspiration recorded")).toBeInTheDocument()
      expect(screen.getByText("No milestones yet")).toBeInTheDocument()
    })
  })

  describe("wellbeing", () => {
    it("shows Priya's stated pressures and the trust statement", () => {
      render(<Live id="p-priya" tab="wellbeing" />)
      expect(screen.getByText("Third release in six weeks")).toBeInTheDocument()
      expect(screen.getByText(/Nothing is inferred from/)).toBeInTheDocument()
      expect(screen.getByText("Energy and workload")).toBeInTheDocument()
      expect(screen.getByText("Change the work first")).toBeInTheDocument()
      expect(screen.getByText(/never be used\s+punitively/)).toBeInTheDocument()
    })

    it("resolves a pressure and logs a pulse through the dialog", () => {
      render(<Live id="p-priya" tab="wellbeing" />)
      const open = () =>
        workspace
          .get()
          .workloadMarkers.filter(
            (w) => w.personId === "p-priya" && !w.resolvedDate
          ).length
      const before = open()
      fireEvent.click(
        screen.getAllByRole("button", { name: "Mark resolved" })[0]
      )
      expect(open()).toBe(before - 1)
      expect(
        screen.getAllByRole("button", { name: "Mark resolved" }).length
      ).toBe(before - 1)

      const pulses = () =>
        workspace.get().pulses.filter((p) => p.personId === "p-priya")
      const count = pulses().length
      fireEvent.click(screen.getAllByRole("button", { name: "Log pulse" })[0])
      expect(screen.getByText(/A pulse is voluntary/)).toBeInTheDocument()
      const dialog = within(screen.getByRole("dialog"))
      fireEvent.click(dialog.getByRole("radio", { name: /Energized/ }))
      fireEvent.click(dialog.getByRole("radio", { name: /Light/ }))
      fireEvent.click(dialog.getByRole("button", { name: "Save pulse" }))
      const latest = pulses().find((p) => p.date === today())
      expect(latest).toMatchObject({ energy: 5, workload: 1 })
      expect(pulses().length).toBeGreaterThanOrEqual(count)
    })

    it("hides individual trends in works council mode", () => {
      actions.updateSettings({ worksCouncilMode: true })
      render(<Live id="p-priya" tab="wellbeing" />)
      expect(
        screen.getByText("Individual trend views are switched off")
      ).toBeInTheDocument()
      expect(screen.queryByText("Energy and workload")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Log pulse" })).toBeEnabled()
    })

    it("has empty states for a new person", () => {
      const id = addBlankPerson()
      render(<Live id={id} tab="wellbeing" />)
      expect(screen.getByText("No pulses yet")).toBeInTheDocument()
      expect(screen.getByText("No stated pressures")).toBeInTheDocument()
      act(() => {
        actions.logPulse({
          personId: id,
          energy: 2,
          workload: HIGH_WORKLOAD_THRESHOLD,
        })
      })
      expect(screen.queryByText("No pulses yet")).not.toBeInTheDocument()
      expect(
        screen.getAllByRole("button", { name: "Schedule a workload check-in" })
      ).toHaveLength(2)
    })
  })

  describe("retention", () => {
    it("shows Sofia's leave trigger with its stay action", () => {
      render(<Live id="p-sofia" tab="retention" />)
      expect(
        screen.getByText("The reorganization was announced without notice")
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          "Share org changes with Sofia before they are announced"
        )
      ).toBeInTheDocument()
      expect(screen.getByText("Thought about leaving")).toBeInTheDocument()
      expect(screen.getByText("Why do you stay here?")).toBeInTheDocument()
      expect(screen.getByText("Private")).toBeInTheDocument()
    })

    it("explains why a stay interview does not apply to Diego", () => {
      render(<Live id="p-diego" tab="retention" />)
      expect(screen.getByText("Not applicable yet")).toBeInTheDocument()
      expect(screen.getByText(/is in onboarding/)).toBeInTheDocument()
    })

    it("retires a driver and saves rapport notes on blur", () => {
      render(<Live id="p-sofia" tab="retention" />)
      const text = "Watching her leads grow"
      fireEvent.click(
        screen.getByRole("button", { name: `No longer applies: ${text}` })
      )
      const driver = workspace.get().stayDrivers.find((s) => s.text === text)
      expect(driver?.validTo).toBe(today())
      expect(
        screen.queryByRole("button", { name: `No longer applies: ${text}` })
      ).not.toBeInTheDocument()

      const notes = screen.getByLabelText("Rapport notes")
      fireEvent.change(notes, { target: { value: "Runs trail races" } })
      fireEvent.blur(notes)
      expect(person("p-sofia").rapportNotes).toBe("Runs trail races")

      fireEvent.change(screen.getByLabelText("Recognition preference"), {
        target: { value: "public" },
      })
      expect(person("p-sofia").recognitionPref).toBe("public")
    })

    it("has an empty state for a new person", () => {
      const id = addBlankPerson()
      render(<Live id={id} tab="retention" />)
      expect(screen.getByText("No stay drivers yet")).toBeInTheDocument()
      expect(screen.getByText(/under six months/)).toBeInTheDocument()
    })
  })

  describe("timeline", () => {
    it("lists events grouped by month and filters by pillar", () => {
      render(<Live id="p-maya" tab="timeline" />)
      expect(screen.getAllByText("1:1 held").length).toBeGreaterThan(0)
      expect(screen.getAllByText("Aspiration recorded")).toHaveLength(2)
      fireEvent.click(screen.getByRole("button", { name: /^Career/ }))
      expect(screen.queryByText("1:1 held")).not.toBeInTheDocument()
      expect(screen.getAllByText("Aspiration recorded")).toHaveLength(2)
    })

    it("adds an event when the record changes", () => {
      render(<Live id="p-maya" tab="timeline" />)
      act(() => {
        actions.addCommitment({
          personId: "p-maya",
          owner: "manager",
          text: "Send the staff rubric",
        })
      })
      expect(screen.getByText("Send the staff rubric")).toBeInTheDocument()
    })

    it("shows the record as it stood on a past day", () => {
      const day = addDays(today(), -200)
      search.value = `asof=${day}`
      render(<Live id="p-maya" tab="timeline" />)
      expect(screen.getByText(/The record as it stood on/)).toBeInTheDocument()
      const panel = within(
        screen
          .getByText(/The record as it stood on/)
          .closest("[data-slot=card]")!
      )
      expect(
        panel.getByText("Move into engineering management within two years")
      ).toBeInTheDocument()
      expect(
        panel.queryByText(/Grow on the staff engineer track/)
      ).not.toBeInTheDocument()
      expect(
        screen.getAllByRole("button", { name: "Back to today" }).length
      ).toBeGreaterThan(0)
      expect(
        document.querySelectorAll("[data-after-asof]").length
      ).toBeGreaterThan(0)
    })

    it("has an empty state for a new person", () => {
      const id = addBlankPerson()
      render(<Live id={id} tab="timeline" />)
      expect(screen.getByText("Nothing on the record yet")).toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: "30 days ago" })
      ).not.toBeInTheDocument()
    })
  })
})
