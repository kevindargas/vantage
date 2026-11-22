import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Keep the repo free of generated agent-rules files.
  agentRules: false,
  // Let the dev server be opened by IP as well as by name.
  allowedDevOrigins: ["127.0.0.1"],
}

export default nextConfig
