import { Suspense } from "react"
import type { Metadata } from "next"

import { PageSkeleton } from "@/components/shared/skeletons"
import { ProfileRoute } from "@/features/people/profile/profile-route"

export const metadata: Metadata = { title: "Person" }

export default function PersonPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileRoute />
    </Suspense>
  )
}
