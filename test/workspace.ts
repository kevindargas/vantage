import { afterAll, beforeAll, beforeEach } from "vitest"

import { freezeClock } from "@/lib/time"
import type { Workspace } from "@/lib/types"
import { buildSampleWorkspace } from "@/lib/vantage/sample"
import { emptyWorkspace, workspace } from "@/lib/vantage/store"

/** The instant every view test runs at: a Wednesday at noon, local time. */
export const TEST_NOW = "2026-11-18T12:00:00"

/**
 * Call at the top of a `describe` block. Pins the clock and loads a fresh
 * copy of the sample team before each test, so views render against known
 * data and mutations never leak between tests.
 */
export function withSampleWorkspace() {
  beforeAll(() => freezeClock(TEST_NOW))
  afterAll(() => freezeClock(null))
  beforeEach(() => workspace.__reset(buildSampleWorkspace()))
}

/** Same, with a workspace that has a manager and nothing else. */
export function withEmptyWorkspace() {
  beforeAll(() => freezeClock(TEST_NOW))
  afterAll(() => freezeClock(null))
  beforeEach(() =>
    workspace.__reset(emptyWorkspace({ name: "Kevin Dargas" }))
  )
}

/** Replace the workspace inside a test. */
export function loadWorkspace(ws: Workspace) {
  workspace.__reset(ws)
}
