"use client"

import * as React from "react"

/**
 * Mirrors the Viewport Segments API into CSS so `[data-fold-grid]` layouts
 * can put their column gap on the hinge of a foldable (see the Foldables
 * block in app/globals.css). Renders nothing.
 *
 * - `html[data-fold]` is `vertical` when two segments sit side by side
 *   (unfolded landscape), `horizontal` when they are stacked (unfolded
 *   portrait) and absent on a flat screen or a browser without the API.
 * - `--hinge-left`, `--hinge-right` and `--hinge-width` are viewport CSS px.
 * - Every `[data-fold-grid]` gets `--fold-grid-left`, its own left edge in
 *   viewport px, so the first column can end exactly at the hinge.
 *
 * The values are refreshed on resize, orientation and posture changes. The
 * API ships behind a feature flag in Safari 27.1 on iPhone Duo and is
 * available in Chromium on Android foldables; everywhere else the normal
 * breakpoints apply.
 */
type Segment = { left: number; right: number; top: number; bottom: number }

interface ViewportWithSegments {
  segments?: Segment[] | null
  addEventListener?: (type: string, cb: () => void) => void
  removeEventListener?: (type: string, cb: () => void) => void
}

interface DevicePosture {
  addEventListener: (type: string, cb: () => void) => void
  removeEventListener: (type: string, cb: () => void) => void
}

function readSegments(): Segment[] {
  const viewport = (window as unknown as { viewport?: ViewportWithSegments })
    .viewport
  const segments = viewport?.segments
  return Array.isArray(segments) ? segments : []
}

export function applyFold() {
  const root = document.documentElement
  const segments = readSegments()
  const grids = document.querySelectorAll<HTMLElement>("[data-fold-grid]")

  if (segments.length !== 2) {
    root.removeAttribute("data-fold")
    root.style.removeProperty("--hinge-left")
    root.style.removeProperty("--hinge-right")
    root.style.removeProperty("--hinge-width")
    grids.forEach((g) => g.style.removeProperty("--fold-grid-left"))
    return
  }

  const [a, b] = segments
  const sideBySide = a.top === b.top
  if (sideBySide) {
    const left = Math.min(a.right, b.right)
    const right = Math.max(a.left, b.left)
    root.setAttribute("data-fold", "vertical")
    root.style.setProperty("--hinge-left", `${left}px`)
    root.style.setProperty("--hinge-right", `${right}px`)
    root.style.setProperty("--hinge-width", `${Math.max(0, right - left)}px`)
    grids.forEach((g) => {
      g.style.setProperty(
        "--fold-grid-left",
        `${g.getBoundingClientRect().left}px`
      )
    })
  } else {
    root.setAttribute("data-fold", "horizontal")
    root.style.removeProperty("--hinge-left")
    root.style.removeProperty("--hinge-right")
    root.style.removeProperty("--hinge-width")
    grids.forEach((g) => g.style.removeProperty("--fold-grid-left"))
  }
}

export function FoldAware() {
  React.useEffect(() => {
    const viewport = (window as unknown as { viewport?: ViewportWithSegments })
      .viewport
    const posture = (navigator as unknown as { devicePosture?: DevicePosture })
      .devicePosture
    if (!viewport?.segments && !posture) return

    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(applyFold)
    }
    schedule()
    window.addEventListener("resize", schedule)
    window.addEventListener("orientationchange", schedule)
    viewport?.addEventListener?.("resize", schedule)
    posture?.addEventListener("change", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", schedule)
      window.removeEventListener("orientationchange", schedule)
      viewport?.removeEventListener?.("resize", schedule)
      posture?.removeEventListener("change", schedule)
    }
  }, [])
  return null
}
