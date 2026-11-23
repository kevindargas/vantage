import { Suspense } from "react"
import type { Metadata } from "next"

import { PageSkeleton } from "@/components/shared/skeletons"
import { AlignmentView } from "@/features/alignment/alignment-view"

export const metadata: Metadata = { title: "Alignment" }

export default function AlignmentPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AlignmentView />
    </Suspense>
  )
}
