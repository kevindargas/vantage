import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { siteConfig } from "@/config/site"
import { actions, workspace } from "@/lib/vantage/store"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { SettingsView } from "./settings-view"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function chooseFile(text: string) {
  const file = new File([text], "backup.json", { type: "application/json" })
  fireEvent.change(screen.getByLabelText("Workspace file to import"), {
    target: { files: [file] },
  })
}

const confirm = (name: string) =>
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", { name })
  )

describe("settings with the sample team", () => {
  withSampleWorkspace()
  beforeEach(() => vi.mocked(toast.error).mockClear())

  it("renders every section from the workspace", () => {
    render(<SettingsView />)
    expect(screen.getByLabelText("Name")).toHaveValue("Kevin Dargas")
    expect(
      screen.getByText(/currently holds the sample team/)
    ).toBeInTheDocument()
    expect(screen.getByText("Keyboard")).toBeInTheDocument()
    expect(
      screen.getByText(`version ${siteConfig.version}`)
    ).toBeInTheDocument()
    expect(screen.getByText(/has no notifications/)).toBeInTheDocument()
  })

  it("saves the profile on the Save button only", () => {
    render(<SettingsView />)
    fireEvent.change(screen.getByLabelText("Team"), {
      target: { value: "Payments" },
    })
    expect(workspace.get().manager.team).not.toBe("Payments")
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }))
    expect(workspace.get().manager.team).toBe("Payments")
    expect(toast.success).toHaveBeenCalledWith("Profile saved")
  })

  it("stores the brief time", () => {
    render(<SettingsView />)
    fireEvent.change(screen.getByLabelText("Brief time"), {
      target: { value: "07:30" },
    })
    expect(workspace.get().settings.briefTime).toBe("07:30")
  })

  it("clears the workspace through the dialog and keeps the profile", () => {
    render(<SettingsView />)
    fireEvent.click(screen.getByRole("button", { name: "Clear the workspace" }))
    expect(workspace.get().people.length).toBeGreaterThan(0)
    confirm("Clear the workspace")
    expect(workspace.get().people).toHaveLength(0)
    expect(workspace.get().meetings).toHaveLength(0)
    expect(workspace.get().manager.name).toBe("Kevin Dargas")
    expect(workspace.get().settings.sampleData).toBe(false)
  })

  it("rejects a file that is not a workspace", async () => {
    render(<SettingsView />)
    const before = workspace.get()
    chooseFile(JSON.stringify({ hello: "world" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    chooseFile("not json at all")
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole("alertdialog")).toBeNull()
    expect(workspace.get()).toBe(before)
  })

  it("imports an exported workspace after confirmation", async () => {
    const backup = actions.exportWorkspace()
    const people = workspace.get().people.length
    actions.clearAll()
    render(<SettingsView />)
    chooseFile(backup)
    await screen.findByRole("alertdialog")
    expect(workspace.get().people).toHaveLength(0)
    confirm("Replace workspace")
    expect(workspace.get().people).toHaveLength(people)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("reloads the sample team through the dialog", () => {
    actions.clearAll()
    render(<SettingsView />)
    fireEvent.click(
      screen.getByRole("button", { name: "Load the sample team" })
    )
    confirm("Load the sample team")
    expect(workspace.get().people.length).toBeGreaterThan(0)
    expect(workspace.get().settings.sampleData).toBe(true)
  })
})

describe("settings with an empty workspace", () => {
  withEmptyWorkspace()

  it("renders with zero counts", () => {
    render(<SettingsView />)
    expect(screen.getByLabelText("Name")).toHaveValue("Kevin Dargas")
    expect(
      screen.queryByText(/currently holds the sample team/)
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Export workspace" })
    ).toBeInTheDocument()
  })
})
