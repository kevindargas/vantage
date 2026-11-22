import { Suspense } from "react"
import type { Metadata } from "next"

import { PageSkeleton } from "@/components/shared/skeletons"
import { GoalsView } from "@/features/goals/goals-view"

export const metadata: Metadata = { title: "Goals" }

export default function GoalsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <GoalsView />
    </Suspense>
  )
}
