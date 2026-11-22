import { Suspense } from "react"
import type { Metadata } from "next"

import { PageSkeleton } from "@/components/shared/skeletons"
import { InsightsView } from "@/features/insights/insights-view"

export const metadata: Metadata = { title: "Team Insights" }

export default function InsightsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InsightsView />
    </Suspense>
  )
}
