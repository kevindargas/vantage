"use client"

import * as React from "react"
import Link from "next/link"
import { BellIcon } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusDot, type Tone } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { buildNudges, type NudgeSeverity } from "@/lib/vantage/nudges"
import { workspace } from "@/lib/vantage/store"

const severityTone: Record<NudgeSeverity, Tone> = {
  danger: "danger",
  warning: "warning",
  info: "info",
}

/** Header bell: the most urgent nudges, each linking to where it can be acted on. */
export function NudgeBell() {
  const ws = workspace.use()
  const [open, setOpen] = React.useState(false)
  const nudges = React.useMemo(() => buildNudges(ws), [ws])
  const top = nudges.slice(0, 6)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Nudges, ${nudges.length} need attention`}
            className="relative text-muted-foreground hover:text-foreground"
          />
        }
      >
        <BellIcon />
        {nudges.length > 0 && (
          <span
            aria-hidden
            className="absolute top-1 right-1 size-2 rounded-full bg-brand ring-2 ring-background"
          />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-96 gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Needs your attention</p>
          <span className="text-xs text-muted-foreground tabular-nums">
            {nudges.length}
          </span>
        </div>
        {top.length === 0 ? (
          <EmptyState
            bare
            size="sm"
            title="All clear"
            description="No overdue 1:1s, commitments or feedback."
          />
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {top.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex gap-3 px-4 py-3 outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
                >
                  <StatusDot
                    tone={severityTone[n.severity]}
                    pulse={false}
                    className="mt-1.5"
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-sm leading-snug font-medium">
                      {n.title}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {n.detail}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            render={<Link href="/today" onClick={() => setOpen(false)} />}
          >
            Open the morning brief
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
