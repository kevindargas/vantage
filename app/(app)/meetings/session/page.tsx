import { Suspense } from "react"
import type { Metadata } from "next"

import { RecordSkeleton } from "@/components/shared/skeletons"
import { MeetingRoute } from "@/features/meetings/meeting-route"

export const metadata: Metadata = { title: "1:1" }

export default function MeetingPage() {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <MeetingRoute />
    </Suspense>
  )
}
