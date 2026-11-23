import { AppShell } from "@/components/layout/app-shell"

/**
 * The app is exported as static files, so nothing here reads the request.
 * The shell and every page read the workspace from the browser.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell defaultSidebarOpen>{children}</AppShell>
}
