import type { Metadata } from "next"

import { PageHeader } from "@/components/shared/page-header"
import { PlaybookView } from "@/features/playbook/playbook-view"

export const metadata: Metadata = { title: "Playbook" }

export default function Page() {
  return (
    <>
      <PageHeader
        nav="/playbook"
        description="How to run 1:1s people look forward to: cadence, ground rules, the 30-minute runbook, what to track and the frameworks behind it."
      />
      <PlaybookView />
    </>
  )
}
