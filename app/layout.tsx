import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { cn } from "cn"

import "./globals.css"
import { CustomizerProvider } from "@/components/theme/customizer-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { siteConfig } from "@/config/site"
import { themeInitScript } from "@/lib/theme-presets"

/** Public files sit under the base path when the site is hosted on a sub-path. */
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

const fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

/**
 * Brand swap points: `siteConfig`, `public/favicon.svg`, `app/favicon.ico`,
 * `public/icons/*` and `public/manifest.webmanifest`. The workspace holds
 * private notes about people, so the app asks search engines not to index it.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name}: ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.author.name, url: siteConfig.author.url }],
  creator: siteConfig.author.name,
  referrer: "same-origin",
  manifest: `${base}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: `${base}/favicon.svg`, type: "image/svg+xml" },
      { url: `${base}/favicon.ico`, sizes: "any" },
    ],
    apple: `${base}/icons/apple-touch-icon.png`,
  },
  robots: { index: false, follow: false },
}

/**
 * `themeColor` matches `--background` of the Nova preset (`app/globals.css`
 * `:root` and `.dark`) so the browser chrome blends with the page.
 * `viewportFit: "cover"` lets the shell draw under notches and home
 * indicators; pair it with `env(safe-area-inset-*)` padding on every edge.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfdfe" },
    { media: "(prefers-color-scheme: dark)", color: "#080a0c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontSans.variable,
        fontMono.variable,
        "font-sans"
      )}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-svh bg-background text-foreground">
        <ThemeProvider>
          <CustomizerProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </CustomizerProvider>
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
