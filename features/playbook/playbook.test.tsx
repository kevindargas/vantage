import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  cadenceProfiles,
  frameworks,
  groundRules,
  runbookPhases,
} from "@/lib/constants"
import { questionsFor } from "@/lib/vantage/question-bank"
import { withEmptyWorkspace, withSampleWorkspace } from "@/test/workspace"
import { PlaybookView } from "./playbook-view"

describe("playbook with the sample team", () => {
  withSampleWorkspace()

  it("renders all five ground rules and four runbook phases", () => {
    render(<PlaybookView />)
    expect(screen.getAllByTestId("ground-rule")).toHaveLength(5)
    for (const rule of groundRules)
      expect(screen.getByText(rule.title)).toBeInTheDocument()
    expect(screen.getAllByTestId("runbook-phase")).toHaveLength(4)
    for (const phase of runbookPhases) {
      expect(screen.getByText(phase.title)).toBeInTheDocument()
      expect(screen.getByText(phase.range)).toBeInTheDocument()
    }
  })

  it("renders the cadence guide, frameworks, readiness ladder and moments", () => {
    render(<PlaybookView />)
    for (const profile of Object.values(cadenceProfiles))
      expect(screen.getByText(profile.label)).toBeInTheDocument()
    for (const framework of frameworks)
      expect(screen.getByText(framework.name)).toBeInTheDocument()
    expect(screen.getAllByTestId("readiness-level")).toHaveLength(4)
    expect(screen.getByText(questionsFor("stay")[0].text)).toBeInTheDocument()
    for (const scenario of [
      "onboarding",
      "career",
      "stay",
      "burnout",
      "performance",
    ])
      expect(
        document.querySelector(`a[href="/questions?scenario=${scenario}"]`)
      ).not.toBeNull()
  })

  it("links every section from the page nav", () => {
    render(<PlaybookView />)
    const nav = screen.getByRole("navigation", { name: "On this page" })
    for (const link of nav.querySelectorAll("a")) {
      const id = link.getAttribute("href")!.slice(1)
      expect(document.getElementById(id)).not.toBeNull()
    }
    expect(nav.querySelectorAll("a")).toHaveLength(7)
  })
})

describe("playbook with an empty workspace", () => {
  withEmptyWorkspace()

  it("reads the same, because it is reference material", () => {
    render(<PlaybookView />)
    expect(screen.getAllByTestId("ground-rule")).toHaveLength(5)
    expect(screen.getAllByTestId("runbook-phase")).toHaveLength(4)
  })
})
