import { Suspense } from "react"
import type { Metadata } from "next"

import { PageSkeleton } from "@/components/shared/skeletons"
import { FeedbackView } from "@/features/feedback/feedback-view"

export const metadata: Metadata = { title: "Feedback" }

export default function FeedbackPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FeedbackView />
    </Suspense>
  )
}
