"use client"

import * as React from "react"
import { MotionConfig } from "motion/react"

import { PageSkeleton } from "@/components/shared/skeletons"
import { useCustomizer } from "@/components/theme/customizer-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getNavCounts } from "@/config/nav-counts"
import { workspace } from "@/lib/vantage/store"
import { AppSidebar } from "./app-sidebar"
import { CommandMenu } from "./command-menu"
import { FoldAware } from "./fold-aware"
import { SiteHeader } from "./site-header"

export function AppFrame({
  children,
  defaultSidebarOpen = true,
}: {
  children: React.ReactNode
  defaultSidebarOpen?: boolean
}) {
  const { settings } = useCustomizer()
  // The workspace lives in the browser. Until it has been read, pages render a
  // skeleton so stored data never replaces a server-rendered empty state.
  const hydrated = workspace.useHydrated()
  const ws = workspace.use()
  const navCounts = React.useMemo(() => getNavCounts(ws), [ws])
  // Marks the document once React has hydrated the shell, so browser tests can
  // wait for `html[data-hydrated]` before they measure.
  React.useEffect(() => {
    document.documentElement.setAttribute("data-hydrated", "")
  }, [])
  return (
    // `reducedMotion="user"` makes every motion.* animation honour prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <SidebarProvider
        defaultOpen={defaultSidebarOpen}
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 64)",
            "--header-height":
              "calc(var(--spacing) * 12 + env(safe-area-inset-top, 0px))",
          } as React.CSSProperties
        }
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <AppSidebar variant={settings.sidebar} navCounts={navCounts} />
        <SidebarInset className="min-w-0">
          <SiteHeader />
          <div
            id="main-content"
            tabIndex={-1}
            className="@container/main flex flex-1 flex-col gap-6 p-4 pb-12 outline-none lg:p-6 lg:pb-16"
          >
            {hydrated ? children : <PageSkeleton />}
          </div>
        </SidebarInset>
        <FoldAware />
        <CommandMenu navCounts={navCounts} />
      </SidebarProvider>
    </MotionConfig>
  )
}
