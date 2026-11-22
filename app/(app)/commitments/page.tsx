import { Suspense } from "react"
import type { Metadata } from "next"

import { PageSkeleton } from "@/components/shared/skeletons"
import { CommitmentsView } from "@/features/commitments/commitments-view"

export const metadata: Metadata = { title: "Commitments" }

export default function CommitmentsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CommitmentsView />
    </Suspense>
  )
}
