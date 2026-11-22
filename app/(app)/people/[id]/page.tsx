import { Suspense } from "react"
import type { Metadata } from "next"

import { PageSkeleton } from "@/components/shared/skeletons"
import { ProfileView } from "@/features/people/profile/profile-view"

export const metadata: Metadata = { title: "Person" }

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileView id={id} />
    </Suspense>
  )
}
