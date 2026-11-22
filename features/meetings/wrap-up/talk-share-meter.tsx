import { cn } from "cn"
import { CheckIcon, TriangleAlertIcon } from "lucide-react"

import { toneClasses } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { TALK_SHARE_MAX, TALK_SHARE_MIN } from "@/lib/constants"
import { shareState, shareStateLabels } from "./analysis"

/**
 * The share of words spoken by the direct report, drawn against the target
 * band. One horizontal bar: the fill is their share, the rest is the manager,
 * and the shaded zone marks the range to aim for. Values are printed as text,
 * so nothing depends on colour alone.
 */
export function TalkShareMeter({
  share,
  name,
  compact = false,
  className,
}: {
  /** Direct report's share of words, 0 to 100. */
  share: number
  /** Direct report's first name. */
  name: string
  /** Drops the headline figure for use inside a denser card. */
  compact?: boolean
  className?: string
}) {
  const value = Math.min(100, Math.max(0, Math.round(share)))
  const state = shareState(value)
  const inRange = state === "in"
  const tone = inRange ? "success" : "warning"
  const band = { left: TALK_SHARE_MIN, width: TALK_SHARE_MAX - TALK_SHARE_MIN }

  return (
    <div
      data-slot="talk-share-meter"
      className={cn("flex flex-col gap-2", className)}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        {compact ? (
          <p className="text-sm font-medium">
            {name} spoke {value}% of the words
          </p>
        ) : (
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight">
              {value}%
            </span>
            <span className="text-sm text-muted-foreground">
              of the words were {name}&apos;s
            </span>
          </p>
        )}
        <Badge
          variant="outline"
          className={cn("font-medium", toneClasses[tone].badge)}
        >
          {inRange ? <CheckIcon /> : <TriangleAlertIcon />}
          {shareStateLabels[state]}
        </Badge>
      </div>

      <div className="relative pt-6 pb-6">
        <span
          aria-hidden
          className="absolute top-0 -translate-x-1/2 text-2xs font-medium whitespace-nowrap text-muted-foreground"
          style={{ left: `${band.left + band.width / 2}%` }}
        >
          Target range
        </span>
        <div
          role="meter"
          aria-label={`${name}'s share of the conversation`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-valuetext={`${name} spoke ${value}% of the words. Target ${TALK_SHARE_MIN} to ${TALK_SHARE_MAX}%. ${shareStateLabels[state]}.`}
          className="relative h-3"
        >
          <div className="absolute inset-0 rounded-full bg-muted" />
          <div
            aria-hidden
            className="absolute -inset-y-1.5 rounded-sm border-x border-success/60 bg-success/15"
            style={{ left: `${band.left}%`, width: `${band.width}%` }}
          />
          <div
            aria-hidden
            className={cn(
              "absolute inset-y-0 left-0 rounded-l-full rounded-r-[4px]",
              inRange ? "bg-chart-1" : "bg-warning"
            )}
            style={{ width: `${value}%` }}
          />
          <div
            aria-hidden
            className={cn(
              "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
              inRange ? "bg-chart-1" : "bg-warning"
            )}
            style={{ left: `clamp(0.5rem, ${value}%, calc(100% - 0.5rem))` }}
          />
        </div>
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-4 text-2xs text-muted-foreground tabular-nums"
        >
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${TALK_SHARE_MIN}%` }}
          >
            {TALK_SHARE_MIN}%
          </span>
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${TALK_SHARE_MAX}%` }}
          >
            {TALK_SHARE_MAX}%
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              inRange ? "bg-chart-1" : "bg-warning"
            )}
          />
          {name} <span className="font-medium text-foreground">{value}%</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 rounded-full bg-muted-foreground/30"
          />
          You{" "}
          <span className="font-medium text-foreground">{100 - value}%</span>
        </span>
      </div>
    </div>
  )
}
