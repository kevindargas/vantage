import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { TrustView } from "@/features/trust/trust-view"

export const metadata: Metadata = { title: "Trust & Privacy" }

export default function Page() {
  return (
    <>
      <PageHeader
        nav="/trust"
        description="What Vantage keeps, for how long, who agreed to it and what it never does."
      />
      <Suspense fallback={null}>
        <TrustView />
      </Suspense>
    </>
  )
}
