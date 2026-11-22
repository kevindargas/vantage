import { Suspense } from "react"
import type { Metadata } from "next"

import { PageSkeleton } from "@/components/shared/skeletons"
import { PeopleView } from "@/features/people/people-view"

export const metadata: Metadata = { title: "People" }

export default function PeoplePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PeopleView />
    </Suspense>
  )
}
