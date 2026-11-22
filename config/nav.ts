import type { LucideIcon } from "lucide-react"
import {
  BookOpenIcon,
  CalendarCheckIcon,
  ChartNoAxesCombinedIcon,
  CircleHelpIcon,
  FileTextIcon,
  GraduationCapIcon,
  ListChecksIcon,
  MessageSquareHeartIcon,
  MessagesSquareIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SunriseIcon,
  TargetIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"

/**
 * Live sidebar badges. Each key resolves to a count in `config/nav-counts.ts`,
 * computed from the workspace, so the sidebar never shows a literal that
 * drifts from the page it points at.
 */
export type NavBadgeKey = "nudges" | "meetingsToday" | "overdue" | "undelivered"

export type NavCounts = Record<NavBadgeKey, number>

export interface NavItem {
  title: string
  href: string
  icon?: LucideIcon
  /** Which live count to show next to the item. See `getNavCounts()`. */
  badge?: NavBadgeKey
  description?: string
  /**
   * "Go to" chord shown in the sidebar tooltip and command menu, e.g. "G T".
   * The first key is always the prefix from `siteConfig.shortcuts.goTo`.
   */
  shortcut?: string
  /** Extra search terms for the command menu. */
  keywords?: string[]
  items?: NavItem[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Application navigation. Workspace is the daily loop (brief, people, 1:1s,
 * commitments). Develop holds the tools for growing people. Insights is the
 * view across the team and on the manager's own habits. Guide is reference
 * and configuration.
 */
export const navigation: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        title: "Today",
        href: "/today",
        icon: SunriseIcon,
        badge: "nudges",
        shortcut: "G T",
        keywords: ["home", "brief", "morning", "dashboard", "nudges"],
        description:
          "Morning brief for the day's 1:1s and what needs attention",
      },
      {
        title: "People",
        href: "/people",
        icon: UsersIcon,
        shortcut: "G P",
        keywords: ["team", "direct reports", "employees", "add"],
        description: "Your direct reports and the running record for each",
      },
      {
        title: "1:1s",
        href: "/meetings",
        icon: CalendarCheckIcon,
        badge: "meetingsToday",
        shortcut: "G M",
        keywords: ["meetings", "one on one", "agenda", "schedule", "calendar"],
        description: "Upcoming and past conversations, agendas and notes",
      },
      {
        title: "Commitments",
        href: "/commitments",
        icon: ListChecksIcon,
        badge: "overdue",
        shortcut: "G C",
        keywords: ["action items", "follow through", "tasks", "promises"],
        description:
          "What each side owes, with carry-forward and follow-through",
      },
    ],
  },
  {
    label: "Develop",
    items: [
      {
        title: "Goals",
        href: "/goals",
        icon: TargetIcon,
        shortcut: "G L",
        keywords: ["okr", "objectives", "readiness", "delegation"],
        description:
          "Active goals across the team with a readiness level on each",
      },
      {
        title: "Feedback",
        href: "/feedback",
        icon: MessageSquareHeartIcon,
        badge: "undelivered",
        shortcut: "G F",
        keywords: ["sbi", "sbii", "recognition", "praise", "ledger"],
        description: "Situation, behavior, impact and intent, logged all year",
      },
      {
        title: "Question Bank",
        href: "/questions",
        icon: CircleHelpIcon,
        shortcut: "G Q",
        keywords: ["prompts", "grow", "stay interview", "onboarding"],
        description: "High-signal questions for every kind of 1:1",
      },
      {
        title: "Reviews",
        href: "/reviews",
        icon: FileTextIcon,
        shortcut: "G R",
        keywords: ["performance review", "promotion", "evidence", "draft"],
        description:
          "Evidence-based review drafts with a source for every claim",
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        title: "Team Insights",
        href: "/insights",
        icon: ChartNoAxesCombinedIcon,
        shortcut: "G I",
        keywords: ["analytics", "trends", "cadence", "dashboard", "drift"],
        description:
          "Cadence health, follow-through, blockers and workload trends",
      },
      {
        title: "Coaching",
        href: "/coaching",
        icon: GraduationCapIcon,
        shortcut: "G O",
        keywords: ["talk ratio", "listening", "private", "oxygen", "habits"],
        description: "Private coaching on how your conversations went",
      },
      {
        title: "Ask Vantage",
        href: "/ask",
        icon: SparklesIcon,
        shortcut: "G A",
        keywords: ["copilot", "query", "search", "patterns", "question"],
        description:
          "Questions across the whole team, answered from the record",
      },
    ],
  },
  {
    label: "Guide",
    items: [
      {
        title: "Playbook",
        href: "/playbook",
        icon: BookOpenIcon,
        shortcut: "G B",
        keywords: [
          "cadence",
          "runbook",
          "ground rules",
          "frameworks",
          "how to",
        ],
        description:
          "Cadence, ground rules, the 30-minute runbook and the frameworks",
      },
      {
        title: "Trust & Privacy",
        href: "/trust",
        icon: ShieldCheckIcon,
        shortcut: "G U",
        keywords: [
          "consent",
          "retention",
          "transcripts",
          "privacy",
          "legal hold",
        ],
        description:
          "Consent log, retention, sensitive topics and what is never done",
      },
      {
        title: "Settings",
        href: "/settings",
        icon: SettingsIcon,
        shortcut: "G S",
        keywords: ["profile", "export", "import", "backup", "sample data"],
        description:
          "Your profile, data export and import, and workspace reset",
      },
    ],
  },
]

export const flatNavigation: NavItem[] = navigation.flatMap((g) =>
  g.items.flatMap((i) => [i, ...(i.items ?? [])])
)

/** Nav item whose href (ignoring the query string) matches `href`. */
export function findNavItem(href: string): NavItem | undefined {
  const path = href.split("?")[0]
  return (
    flatNavigation.find((n) => n.href === href) ??
    flatNavigation.find((n) => n.href.split("?")[0] === path)
  )
}

/** Sidebar group that owns `href`; used for page eyebrows and breadcrumbs. */
export function findNavGroup(href: string): NavGroup | undefined {
  const path = href.split("?")[0]
  return navigation.find((g) =>
    g.items.some(
      (i) =>
        i.href.split("?")[0] === path ||
        (i.items ?? []).some((s) => s.href.split("?")[0] === path)
    )
  )
}

type ShortcutItem = NavItem & { shortcut: string }

/**
 * Lookup for "G + key" chords: lower-case second key to nav item, e.g.
 * goToShortcuts.t opens Today. `config/nav.test.ts` asserts every second key
 * is unique so no page silently shadows another.
 */
export const goToShortcuts: Record<string, NavItem> = Object.fromEntries(
  flatNavigation
    .filter((i): i is ShortcutItem => typeof i.shortcut === "string")
    .map((i) => [i.shortcut.split(" ")[1].toLowerCase(), i])
)

/** Quick-create menu (the `C` key and the New button). Each href is read by its page. */
export const quickCreateItems: NavItem[] = [
  { title: "Person", href: "/people?new=1", icon: UserPlusIcon },
  { title: "1:1", href: "/meetings?new=1", icon: MessagesSquareIcon },
  { title: "Commitment", href: "/commitments?new=1", icon: ListChecksIcon },
  { title: "Feedback", href: "/feedback?new=1", icon: MessageSquareHeartIcon },
  { title: "Goal", href: "/goals?new=1", icon: TargetIcon },
]
