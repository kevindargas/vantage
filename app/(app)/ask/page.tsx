import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { AskView } from "@/features/ask/ask-view"

export const metadata: Metadata = { title: "Ask Vantage" }

export default function Page() {
  return (
    <>
      <PageHeader
        nav="/ask"
        description="Questions across the whole team, answered from your own record."
      />
      <Suspense fallback={null}>
        <AskView />
      </Suspense>
    </>
  )
}
