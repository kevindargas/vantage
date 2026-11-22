import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { ReviewsView } from "@/features/reviews/reviews-view"

export const metadata: Metadata = { title: "Reviews" }

export default function Page() {
  return (
    <>
      <PageHeader
        nav="/reviews"
        description="Dated evidence for a review or a promotion case, and a draft you edit. Every claim points back to the record."
      />
      <Suspense fallback={null}>
        <ReviewsView />
      </Suspense>
    </>
  )
}
