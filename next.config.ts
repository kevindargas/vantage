import type { NextConfig } from "next"

/**
 * The app has no server: `next build` writes plain files to `out/`, which any
 * static host can serve. Set NEXT_PUBLIC_BASE_PATH when the site lives under a
 * sub-path, for example `/vantage` on GitHub Pages project sites.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // Every route becomes `route/index.html`, which static hosts resolve
  // without rewrite rules.
  trailingSlash: true,
  images: { unoptimized: true },
  // Keep the repo free of generated agent-rules files.
  agentRules: false,
  // Let the dev server be opened by IP as well as by name.
  allowedDevOrigins: ["127.0.0.1"],
}

export default nextConfig
