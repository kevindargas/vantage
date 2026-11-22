import { Suspense } from "react"
import type { Metadata } from "next"

import { RecordSkeleton } from "@/components/shared/skeletons"
import { MeetingView } from "@/features/meetings/meeting-view"

export const metadata: Metadata = { title: "1:1" }

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <MeetingView id={id} />
    </Suspense>
  )
}
