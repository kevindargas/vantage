"use client"

import React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { HomeIcon } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { flatNavigation } from "@/config/nav"
import { firstName, formatDay } from "@/lib/format"
import type { Workspace } from "@/lib/types"
import { workspace } from "@/lib/vantage/store"

/** Labels for route segments that are modules rather than pages. */
const segmentLabels: Record<string, string> = {}

/** Record pages: the id travels in `?id=` and the crumb shows the record. */
const RECORD_SEGMENTS: Record<string, string> = {
  "/people/profile": "Person",
  "/meetings/session": "1:1",
}

function navTitle(path: string) {
  return flatNavigation.find((n) => n.href.split("?")[0] === path)?.title
}

function recordLabel(ws: Workspace, path: string, id: string | null) {
  if (path === "/people/profile")
    return ws.people.find((p) => p.id === id)?.name ?? RECORD_SEGMENTS[path]
  const meeting = ws.meetings.find((m) => m.id === id)
  if (!meeting) return RECORD_SEGMENTS[path]
  const person = ws.people.find((p) => p.id === meeting.personId)
  return `${person ? firstName(person.name) : "1:1"}, ${formatDay(meeting.scheduledAt)}`
}

function labelFor(
  ws: Workspace,
  path: string,
  segment: string,
  last: boolean,
  id: string | null
) {
  if (path in RECORD_SEGMENTS) return recordLabel(ws, path, id)
  // Intermediate module segments read as the module, not the landing page.
  if (!last && segmentLabels[segment]) return segmentLabels[segment]
  return (
    navTitle(path) ??
    segmentLabels[segment] ??
    segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

function BreadcrumbTrail() {
  const pathname = usePathname()
  const id = useSearchParams().get("id")
  const ws = workspace.use()
  const segments = pathname.split("/").filter(Boolean)
  const crumbs = segments
    .map((seg, i) => {
      const path = "/" + segments.slice(0, i + 1).join("/")
      const last = i === segments.length - 1
      return {
        label: labelFor(ws, path, seg, last, id),
        path,
        hasPage: navTitle(path) !== undefined || last,
      }
    })
    // A group and its only page can share a name ("Service Health"); keep the page.
    .filter(
      (c, i, all) => !(i < all.length - 1 && all[i + 1].label === c.label)
    )
  return (
    <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
      <BreadcrumbList className="flex-nowrap gap-0.5 text-[13px] sm:gap-1">
        <BreadcrumbItem className="hidden md:inline-flex">
          <BreadcrumbLink
            render={<Link href="/today" />}
            aria-label="Home"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <HomeIcon className="size-3.5" />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <React.Fragment key={c.path}>
              <BreadcrumbSeparator className="hidden text-muted-foreground/50 md:block [&>svg]:size-3" />
              <BreadcrumbItem
                className={last ? "min-w-0" : "hidden min-w-0 md:inline-flex"}
              >
                {last ? (
                  <BreadcrumbPage className="max-w-48 truncate font-medium xl:max-w-72">
                    {c.label}
                  </BreadcrumbPage>
                ) : c.hasPage ? (
                  <BreadcrumbLink
                    render={<Link href={c.path} />}
                    className="max-w-40 truncate rounded-md px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {c.label}
                  </BreadcrumbLink>
                ) : (
                  <span className="max-w-40 truncate px-1.5 text-muted-foreground/80">
                    {c.label}
                  </span>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/** The trail reads `?id=`, so it renders inside its own Suspense boundary. */
export function Breadcrumbs() {
  return (
    <React.Suspense fallback={<div className="min-w-0 flex-1" />}>
      <BreadcrumbTrail />
    </React.Suspense>
  )
}
