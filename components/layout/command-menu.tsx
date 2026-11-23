"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CornerDownLeftIcon,
  LaptopIcon,
  ListChecksIcon,
  MoonIcon,
  PanelLeftIcon,
  PlusIcon,
  SearchIcon,
  SunIcon,
  TargetIcon,
  UserIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

import { CountPill } from "@/components/shared/count-pill"
import { withThemeTransition } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { useSidebar } from "@/components/ui/sidebar"
import {
  goToShortcuts,
  navigation,
  quickCreateItems,
  type NavCounts,
} from "@/config/nav"
import { siteConfig } from "@/config/site"
import { openQuickCreate } from "./quick-create"
import { dayOf } from "@/lib/time"
import { formatDay } from "@/lib/format"
import { meetingTypeLabels } from "@/lib/constants"
import type { Workspace } from "@/lib/types"
import { workspace } from "@/lib/vantage/store"

const OPEN_EVENT = "vantage:command-menu"
/** How long after pressing G the second key of a chord is accepted. */
const CHORD_TIMEOUT_MS = 1200

export function openCommandMenu() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/**
 * Keyboard contract for single-key shortcuts (C, D, G-then-letter).
 *
 * The global handler in `CommandMenu` ignores a keydown when:
 * - `event.defaultPrevented` is true. Page-level handlers (a table's "/" focus,
 *   the live 1:1 view's keys) claim a key by calling
 *   `event.preventDefault()`; they do not need to stop propagation.
 * - a modifier is held (Meta, Ctrl, Alt) or the key is a repeat.
 * - the target is an input, textarea, select or contenteditable element.
 * - focus is inside a dialog, sheet, menu, listbox, combobox or the command
 *   palette itself.
 *
 * Cmd/Ctrl K and Cmd/Ctrl , are handled before those checks because they are
 * modifier chords and must work while typing.
 */
export function shouldIgnoreShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.repeat) return true
  if (event.metaKey || event.ctrlKey || event.altKey) return true
  return isScopedTarget(event.target)
}

const SCOPED_SELECTOR = [
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
  '[role="combobox"]',
  "[data-slot=sheet-content]",
  "[data-slot=dialog-content]",
  "[cmdk-root]",
].join(", ")

/** True when a bare keystroke should be left alone: typing, or inside a scoped surface. */
function isScopedTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  return target.closest(SCOPED_SELECTOR) !== null
}

function Keys({ keys }: { keys: readonly string[] }) {
  return (
    <KbdGroup>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </KbdGroup>
  )
}

/** Icon-only variant for headers too narrow for the search field. */
export function CommandMenuIconTrigger({ className }: { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={openCommandMenu}
      aria-label="Search"
      aria-keyshortcuts="Meta+K"
      className={cn("text-muted-foreground hover:text-foreground", className)}
    >
      <SearchIcon />
    </Button>
  )
}

export function CommandMenuTrigger({ className }: { className?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={openCommandMenu}
      aria-keyshortcuts="Meta+K"
      className={cn(
        "h-7 w-44 justify-start gap-2 border-border/70 bg-muted/40 px-2 font-normal text-muted-foreground shadow-none hover:border-border hover:bg-muted/70 hover:text-foreground xl:w-64 dark:bg-input/20 dark:hover:bg-input/40",
        className
      )}
    >
      <SearchIcon className="size-3.5 opacity-70" />
      <span className="hidden truncate lg:inline">
        Search people, 1:1s and actions
      </span>
      <span className="lg:hidden">Search</span>
      <KbdGroup className="ml-auto hidden xl:flex">
        {siteConfig.shortcuts.commandMenu.map((k) => (
          <Kbd
            key={k}
            className="h-4.5 min-w-4.5 bg-background/80 text-3xs shadow-xs ring-1 ring-border/60 dark:bg-muted"
          >
            {k}
          </Kbd>
        ))}
      </KbdGroup>
    </Button>
  )
}

type SearchKind = "Person" | "1:1" | "Commitment" | "Goal"

interface SearchEntry {
  kind: SearchKind
  title: string
  meta: string
  href: string
  /** Lower-cased haystack. */
  text: string
}

const kindIcons: Record<SearchKind, LucideIcon> = {
  Person: UserIcon,
  "1:1": CalendarCheckIcon,
  Commitment: ListChecksIcon,
  Goal: TargetIcon,
}

/** Search index over the local workspace, rebuilt when the workspace changes. */
function buildSearchIndex(ws: Workspace): SearchEntry[] {
  const nameOf = (id: string) =>
    ws.people.find((p) => p.id === id)?.name ?? "Unknown"
  const entries: SearchEntry[] = []
  for (const p of ws.people)
    entries.push({
      kind: "Person",
      title: p.name,
      meta: p.role,
      href: `/people/profile?id=${p.id}`,
      text: `${p.name} ${p.role} ${p.team ?? ""}`.toLowerCase(),
    })
  for (const m of [...ws.meetings].sort((a, b) =>
    b.scheduledAt.localeCompare(a.scheduledAt)
  )) {
    const name = nameOf(m.personId)
    entries.push({
      kind: "1:1",
      title: `${name}: ${meetingTypeLabels[m.type]}`,
      meta: formatDay(dayOf(m.scheduledAt)),
      href: `/meetings/session?id=${m.id}`,
      text: `${name} ${meetingTypeLabels[m.type]} ${m.agenda
        .map((a) => a.text)
        .join(" ")} ${m.sharedNotes}`.toLowerCase(),
    })
  }
  for (const c of ws.commitments)
    if (c.status === "open")
      entries.push({
        kind: "Commitment",
        title: c.text,
        meta: nameOf(c.personId),
        href: `/commitments?person=${c.personId}`,
        text: `${c.text} ${nameOf(c.personId)}`.toLowerCase(),
      })
  for (const g of ws.goals)
    if (!g.validTo)
      entries.push({
        kind: "Goal",
        title: g.title,
        meta: nameOf(g.personId),
        href: `/people/profile?id=${g.personId}&tab=goals`,
        text: `${g.title} ${nameOf(g.personId)}`.toLowerCase(),
      })
  return entries
}

function searchRecords(index: SearchEntry[], q: string): SearchEntry[] {
  const hits: SearchEntry[] = []
  for (const entry of index) {
    if (entry.text.includes(q)) {
      hits.push(entry)
      if (hits.length >= 12) break
    }
  }
  return hits
}

export function CommandMenu({
  navCounts,
}: {
  /** Live badge counts from `getNavCounts()`. */
  navCounts?: NavCounts
}) {
  const ws = workspace.use()
  const searchIndex = React.useMemo(() => buildSearchIndex(ws), [ws])
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const { toggleSidebar } = useSidebar()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  // Timestamp of the last bare "G" press, for G-then-key chords.
  const pendingChord = React.useRef<number | null>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (mod && !e.altKey && e.key === ",") {
        e.preventDefault()
        router.push("/settings")
        return
      }
      if (open || shouldIgnoreShortcut(e)) return

      const key = e.key.toLowerCase()
      const started = pendingChord.current
      pendingChord.current = null
      if (started !== null && e.timeStamp - started < CHORD_TIMEOUT_MS) {
        const target = goToShortcuts[key]
        if (target) {
          e.preventDefault()
          router.push(target.href)
        }
        return
      }
      if (key === siteConfig.shortcuts.goTo.toLowerCase()) {
        pendingChord.current = e.timeStamp
        return
      }
      if (key === siteConfig.shortcuts.quickCreate[0].toLowerCase()) {
        e.preventDefault()
        openQuickCreate()
        return
      }
      if (key === siteConfig.shortcuts.darkMode[0].toLowerCase()) {
        e.preventDefault()
        withThemeTransition(() =>
          setTheme(resolvedTheme === "dark" ? "light" : "dark")
        )
      }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      document.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [open, router, resolvedTheme, setTheme])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setQuery("")
  }

  const run = React.useCallback((action: () => void) => {
    setOpen(false)
    setQuery("")
    action()
  }, [])

  const go = React.useCallback(
    (href: string) => run(() => router.push(href)),
    [run, router]
  )

  const q = query.trim().toLowerCase()
  const records = React.useMemo(
    () => (q.length < 2 ? [] : searchRecords(searchIndex, q)),
    [q, searchIndex]
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Command menu"
      description="Search people and 1:1s, jump to a page or run an action"
      className="sm:max-w-xl"
    >
      <Command loop>
        <CommandInput
          placeholder="Search people, 1:1s, commitments and pages"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-96">
          <CommandEmpty>
            <div className="flex flex-col items-center gap-1 py-2">
              <span className="text-sm">
                No results for &quot;{query}&quot;
              </span>
              <span className="text-xs text-muted-foreground">
                Try a name, a commitment or a page such as Feedback.
              </span>
            </div>
          </CommandEmpty>

          {records.length > 0 && (
            <CommandGroup heading="Workspace">
              {records.map((r) => {
                const Icon = kindIcons[r.kind]
                return (
                  <CommandItem
                    key={`${r.kind}-${r.href}-${r.title}`}
                    value={`${r.kind} ${r.title} ${r.meta}`}
                    onSelect={() => go(r.href)}
                  >
                    <Icon className="text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    <CommandShortcut className="flex items-center gap-2 tracking-normal">
                      <span className="max-w-40 truncate text-xs">
                        {r.meta}
                      </span>
                      <span className="hidden text-2xs sm:inline">
                        {r.kind}
                      </span>
                    </CommandShortcut>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}

          <CommandGroup heading="Actions">
            {quickCreateItems.map((item) => (
              <CommandItem
                key={item.href}
                value={`new create ${item.title}`}
                onSelect={() => go(item.href)}
              >
                {item.icon ? (
                  <item.icon className="text-muted-foreground" />
                ) : (
                  <PlusIcon />
                )}
                <span>New {item.title.toLowerCase()}</span>
              </CommandItem>
            ))}
            <CommandItem
              value="toggle sidebar collapse expand"
              onSelect={() => run(toggleSidebar)}
            >
              <PanelLeftIcon className="text-muted-foreground" />
              <span>Toggle sidebar</span>
              <CommandShortcut className="tracking-normal">
                <Keys keys={siteConfig.shortcuts.sidebar} />
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {navigation.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => {
                const count = item.badge ? navCounts?.[item.badge] : undefined
                return (
                  <CommandItem
                    key={item.href}
                    value={[
                      group.label,
                      item.title,
                      ...(item.keywords ?? []),
                    ].join(" ")}
                    onSelect={() => go(item.href)}
                  >
                    {item.icon ? (
                      <item.icon className="text-muted-foreground" />
                    ) : (
                      <ArrowRightIcon />
                    )}
                    <span className="shrink-0">{item.title}</span>
                    {count !== undefined && count > 0 && (
                      <CountPill count={count} />
                    )}
                    {item.description && (
                      <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground sm:inline">
                        {item.description}
                      </span>
                    )}
                    {item.shortcut && (
                      <CommandShortcut className="tracking-normal">
                        <Keys keys={item.shortcut.split(" ")} />
                      </CommandShortcut>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}

          <CommandSeparator />

          <CommandGroup heading="Appearance">
            <CommandItem
              value="theme light mode"
              onSelect={() => run(() => setTheme("light"))}
            >
              <SunIcon className="text-muted-foreground" />
              <span>Light theme</span>
            </CommandItem>
            <CommandItem
              value="theme dark mode"
              onSelect={() => run(() => setTheme("dark"))}
            >
              <MoonIcon className="text-muted-foreground" />
              <span>Dark theme</span>
              <CommandShortcut className="tracking-normal">
                <Keys keys={siteConfig.shortcuts.darkMode} />
              </CommandShortcut>
            </CommandItem>
            <CommandItem
              value="theme system auto"
              onSelect={() => run(() => setTheme("system"))}
            >
              <LaptopIcon className="text-muted-foreground" />
              <span>System theme</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>

        <div className="flex items-center justify-between gap-4 border-t border-border/60 px-3 py-2 text-2xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span className="ml-0.5">Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>
                <CornerDownLeftIcon />
              </Kbd>
              <span className="ml-0.5">Open</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Esc</Kbd>
              <span className="ml-0.5">Close</span>
            </span>
          </div>
          <span className="hidden items-center gap-1 sm:flex">
            <Kbd>{siteConfig.shortcuts.goTo}</Kbd>
            <span>then a letter to jump</span>
          </span>
        </div>
      </Command>
    </CommandDialog>
  )
}
