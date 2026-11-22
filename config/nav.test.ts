import { describe, expect, it } from "vitest"

import { flatNavigation, goToShortcuts, quickCreateItems } from "./nav"

describe("navigation", () => {
  it("has unique hrefs", () => {
    const hrefs = flatNavigation.map((n) => n.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it("never assigns the same chord key twice", () => {
    const keys = flatNavigation
      .filter((n) => n.shortcut)
      .map((n) => n.shortcut!.split(" ")[1].toLowerCase())
    expect(new Set(keys).size).toBe(keys.length)
    expect(Object.keys(goToShortcuts)).toHaveLength(keys.length)
  })

  it("points quick create at pages that exist in the nav", () => {
    const paths = new Set(flatNavigation.map((n) => n.href))
    for (const item of quickCreateItems)
      expect(paths.has(item.href.split("?")[0])).toBe(true)
  })
})
