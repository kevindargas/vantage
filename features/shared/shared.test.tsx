import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { withSampleWorkspace } from "@/test/workspace"
import { CommitmentDialog } from "./commitment-dialog"
import { FeedbackComposer } from "./feedback-composer"
import { GoalDialog } from "./goal-dialog"
import { PersonChip } from "./person"
import { ScheduleMeetingDialog } from "./schedule-dialog"

describe("shared feature components", () => {
  withSampleWorkspace()

  it("renders a person chip from the workspace", () => {
    render(<PersonChip personId="p-maya" showRole />)
    expect(screen.getByText("Maya Chen")).toBeInTheDocument()
    expect(screen.getByText("Senior Software Engineer")).toBeInTheDocument()
  })

  it("opens each dialog without throwing", () => {
    const noop = () => {}
    render(<CommitmentDialog open onOpenChange={noop} personId="p-maya" />)
    expect(screen.getByText("Add a commitment")).toBeInTheDocument()
    render(<GoalDialog open onOpenChange={noop} personId="p-maya" />)
    expect(screen.getByText("Add a goal")).toBeInTheDocument()
    render(
      <ScheduleMeetingDialog open onOpenChange={noop} personId="p-kenji" />
    )
    expect(screen.getByText("Schedule a 1:1")).toBeInTheDocument()
    render(<FeedbackComposer open onOpenChange={noop} personId="p-maya" />)
    expect(screen.getByText("Write feedback")).toBeInTheDocument()
  })
})
