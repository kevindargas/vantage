import { Suspense } from "react"
import type { Metadata } from "next"

import { PageSkeleton } from "@/components/shared/skeletons"
import { MeetingsView } from "@/features/meetings/meetings-view"

export const metadata: Metadata = { title: "1:1s" }

export default function MeetingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MeetingsView />
    </Suspense>
  )
}
