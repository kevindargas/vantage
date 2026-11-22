"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

/**
 * Client-side redirect for the root page: `router.replace` runs as soon as
 * the bundle is live, the meta refresh covers browsers without JavaScript and
 * the link covers everything else.
 */
export function RootRedirect({ href }: { href: string }) {
  const router = useRouter()
  useEffect(() => {
    router.replace(href)
  }, [router, href])
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6 text-sm text-muted-foreground">
      <meta httpEquiv="refresh" content={`1;url=${href}`} />
      <p>
        Opening your workspace.{" "}
        <Link href={href} className="text-foreground underline">
          Continue to the dashboard
        </Link>{" "}
        if nothing happens.
      </p>
    </main>
  )
}
