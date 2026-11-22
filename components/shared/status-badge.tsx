import { cn } from "cn"
import { Badge } from "@/components/ui/badge"

/**
 * Semantic tone for any lifecycle state. Keeps the state vocabulary of every
 * pillar (commitments, goals, blockers, feedback, career, workload, retention) on one color system.
 */
export type Tone =
  | "neutral"
  | "info"
  | "progress"
  | "warning"
  | "success"
  | "danger"
  | "muted"
  | "brand"

export type BadgeSize = "sm" | "default"

/**
 * One treatment for every tone: tinted fill, hairline ring in the same hue and
 * a readable text color (`*-text` tokens in globals.css are tuned for 4.5:1 on
 * the tint in both modes). `dot` is the solid marker used inside badges and by
 * <StatusDot />; `text` is for inline text-only indicators. Icon sizes: `size-4`
 * default, `size-3.5` beside 12px text, `size-3` only inside `sm` badges.
 */
export const toneClasses: Record<
  Tone,
  { badge: string; dot: string; text: string; soft: string }
> = {
  neutral: {
    badge: "border-border bg-card text-foreground",
    dot: "bg-foreground/55",
    text: "text-foreground",
    soft: "bg-muted text-foreground",
  },
  brand: {
    badge: "border-brand/25 bg-brand/10 text-brand",
    dot: "bg-brand",
    text: "text-brand",
    soft: "bg-brand/10 text-brand",
  },
  info: {
    badge: "border-info/25 bg-info/10 text-info-text",
    dot: "bg-info",
    text: "text-info-text",
    soft: "bg-info/10 text-info-text",
  },
  progress: {
    badge: "border-brand/25 bg-brand/10 text-brand",
    dot: "bg-brand",
    text: "text-brand",
    soft: "bg-brand/10 text-brand",
  },
  warning: {
    badge: "border-warning/35 bg-warning/15 text-warning-text",
    dot: "bg-warning",
    text: "text-warning-text",
    soft: "bg-warning/15 text-warning-text",
  },
  success: {
    badge: "border-success/25 bg-success/10 text-success-text",
    dot: "bg-success",
    text: "text-success-text",
    soft: "bg-success/10 text-success-text",
  },
  danger: {
    badge: "border-destructive/25 bg-destructive/10 text-danger-text",
    dot: "bg-destructive",
    text: "text-danger-text",
    soft: "bg-destructive/10 text-danger-text",
  },
  muted: {
    badge: "border-transparent bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
    text: "text-muted-foreground",
    soft: "bg-muted text-muted-foreground",
  },
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: "h-4.5 gap-1 px-1.5 text-2xs leading-none [&>svg]:size-2.5!",
  default: "gap-1.5",
}

const stateTone: Record<string, Tone> = {
  // Goals
  "On track": "success",
  "At risk": "warning",
  "Off track": "danger",
  Done: "success",
  Dropped: "muted",
  // Commitments
  Open: "info",
  Overdue: "danger",
  "Due today": "warning",
  "Due soon": "warning",
  Kept: "success",
  "You owe": "brand",
  "They owe": "neutral",
  // Blockers
  Escalated: "warning",
  Resolved: "success",
  Recurring: "danger",
  // 1:1s
  Scheduled: "info",
  "In progress": "progress",
  Completed: "success",
  Held: "success",
  Cancelled: "danger",
  Rescheduled: "warning",
  Today: "brand",
  // Cadence
  "On cadence": "success",
  Due: "warning",
  Drifting: "warning",
  "Not started": "muted",
  // Feedback
  Recognition: "success",
  Developmental: "info",
  Upward: "brand",
  Draft: "warning",
  Delivered: "success",
  "Not delivered": "warning",
  // Career
  Planned: "muted",
  Demonstrated: "success",
  // People
  "Steady state": "neutral",
  Onboarding: "info",
  "Performance support": "warning",
  Active: "success",
  Archived: "muted",
  // Trust
  Granted: "success",
  Declined: "neutral",
  Private: "brand",
  Shared: "info",
  Sensitive: "warning",
  "Off the record": "warning",
  "Legal hold": "warning",
  "Manual notes": "neutral",
  // Nudges
  Urgent: "danger",
  Attention: "warning",
  Suggestion: "info",
  // Question bank
  Custom: "brand",
  "Built in": "muted",
  // Workload
  Exhaustion: "danger",
  Detachment: "warning",
  "Reduced efficacy": "warning",
  // Stay drivers
  "Looks forward to": "success",
  "Wants to learn": "info",
  "Reason to stay": "brand",
  "Thought about leaving": "danger",
  Friction: "warning",
  // Generic
  Suggested: "brand",
  Accepted: "success",
  Discarded: "muted",
  Yes: "success",
  No: "muted",
  New: "info",
}

export function toneForState(state: string): Tone {
  return stateTone[state] ?? "neutral"
}

/**
 * Solid status marker for tables and lists; pulses for in-flight tones. Pass
 * `label` (or `state`) so the colour is not the only carrier of meaning; the
 * text is rendered visually hidden.
 */
export function StatusDot({
  tone = "neutral",
  state,
  pulse,
  label,
  className,
}: {
  tone?: Tone
  state?: string
  pulse?: boolean
  /** Screen-reader text. Defaults to `state`. */
  label?: string
  className?: string
}) {
  const t = state ? toneForState(state) : tone
  const live = pulse ?? t === "progress"
  const text = label ?? state
  return (
    <span
      aria-hidden={text ? undefined : true}
      role={text ? "img" : undefined}
      aria-label={text}
      className={cn("relative inline-flex size-2 shrink-0", className)}
    >
      {live && (
        <span
          className={cn(
            "absolute inset-0 animate-ping rounded-full opacity-40 motion-reduce:hidden",
            toneClasses[t].dot
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full",
          toneClasses[t].dot
        )}
      />
    </span>
  )
}

export function StateBadge({
  state,
  tone,
  className,
  dot = true,
  size = "default",
  icon,
  pulse = false,
}: {
  state: string
  tone?: Tone
  className?: string
  dot?: boolean
  /** `sm` fits inside dense table rows and chips. */
  size?: BadgeSize
  /** Replaces the dot with a custom leading icon. */
  icon?: React.ReactNode
  /** Animate the dot for states that are actively changing. */
  pulse?: boolean
}) {
  const t = tone ?? toneForState(state)
  return (
    <Badge
      variant="outline"
      data-tone={t}
      className={cn(
        "font-medium whitespace-nowrap",
        sizeClasses[size],
        toneClasses[t].badge,
        className
      )}
    >
      {icon ? (
        icon
      ) : dot ? (
        <span aria-hidden className="relative inline-flex size-1.5 shrink-0">
          {pulse && (
            <span
              className={cn(
                "absolute inset-0 animate-ping rounded-full opacity-50 motion-reduce:hidden",
                toneClasses[t].dot
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex size-full rounded-full",
              toneClasses[t].dot
            )}
          />
        </span>
      ) : null}
      {state}
    </Badge>
  )
}
