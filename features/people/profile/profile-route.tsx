"use client"

import { useSearchParams } from "next/navigation"

import { ProfileView } from "./profile-view"

/** Reads `?id=` and renders that person's profile. */
export function ProfileRoute() {
  const id = useSearchParams().get("id") ?? ""
  return <ProfileView key={id} id={id} />
}
