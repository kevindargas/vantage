import { Suspense } from "react"
import type { Metadata } from "next"

import { PageSkeleton } from "@/components/shared/skeletons"
import { QuestionsView } from "@/features/questions/questions-view"

export const metadata: Metadata = { title: "Question Bank" }

export default function QuestionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <QuestionsView />
    </Suspense>
  )
}
