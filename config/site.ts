export const siteConfig = {
  name: "Vantage",
  tagline: "Run 1:1s people look forward to.",
  description:
    "A manager's workspace for 1:1s: agendas owned by the direct report, commitments that carry forward, a running record of goals, blockers, feedback, career and workload for each person, and private coaching on how the conversation went. Everything stays in your browser.",
  version: "0.1.0",
  /**
   * Search terms for `metadata.keywords` in app/layout.tsx. Keep them to what
   * the app actually does.
   */
  keywords: [
    "1:1 meetings",
    "one on one meetings",
    "people management",
    "manager tools",
    "meeting agenda",
    "action items",
    "SBI feedback",
    "career development",
    "stay interviews",
    "coaching",
    "Next.js",
    "shadcn/ui",
  ],
  /** Author shown in metadata. */
  author: {
    name: "Kevin Dargas",
    url: "https://github.com/kevindargas",
  },
  /** Public source repository. */
  repository: "https://github.com/kevindargas/vantage",
  license: "MIT",
  /**
   * Public URL of the deployed app. Used for metadata; override with
   * NEXT_PUBLIC_SITE_URL when you deploy.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Locale used by every formatter in lib/format.ts. Times use the browser's zone. */
  locale: "en-US",
  /** Landing route after the root redirect. */
  home: "/today",
  /**
   * Global keyboard shortcuts. Each entry is the key sequence as displayed in
   * tooltips and the command menu. The handlers live in
   * components/layout/command-menu.tsx (Cmd K, chords, C, D, Cmd ,) and the
   * sidebar provider (Cmd B).
   */
  shortcuts: {
    commandMenu: ["⌘", "K"],
    sidebar: ["⌘", "B"],
    settings: ["⌘", ","],
    quickCreate: ["C"],
    darkMode: ["D"],
    /** Prefix key for "go to" chords, e.g. G then T for Today. */
    goTo: "G",
  },
} as const
