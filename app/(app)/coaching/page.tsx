import { Suspense } from "react"
import type { Metadata } from "next"

import { PageSkeleton } from "@/components/shared/skeletons"
import { CoachingView } from "@/features/coaching/coaching-view"

export const metadata: Metadata = { title: "Coaching" }

export default function CoachingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CoachingView />
    </Suspense>
  )
}
