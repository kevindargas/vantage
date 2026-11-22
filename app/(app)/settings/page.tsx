import { Suspense } from "react"
import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { SettingsView } from "@/features/settings/settings-view"

export const metadata: Metadata = { title: "Settings" }

export default function Page() {
  return (
    <>
      <PageHeader
        nav="/settings"
        description="Your profile, your data and a fresh start when you need one."
      />
      <Suspense fallback={null}>
        <SettingsView />
      </Suspense>
    </>
  )
}
