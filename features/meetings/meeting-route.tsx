"use client"

import { useSearchParams } from "next/navigation"

import { MeetingView } from "./meeting-view"

/** Reads `?id=` and renders that 1:1. */
export function MeetingRoute() {
  const id = useSearchParams().get("id") ?? ""
  return <MeetingView key={id} id={id} />
}
