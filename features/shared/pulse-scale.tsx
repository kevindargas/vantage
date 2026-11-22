"use client"

import { cn } from "cn"

/**
 * A 1 to 5 scale for the voluntary energy and workload pulse. Rendered as a
 * radio group so it works from the keyboard.
 */
export function PulseScale({
  value,
  onChange,
  labels,
  legend,
  name,
  className,
}: {
  value: number | null
  onChange: (value: number) => void
  /** Five labels, lowest first. */
  labels: readonly string[]
  legend: string
  name: string
  className?: string
}) {
  return (
    <fieldset className={cn("flex flex-col gap-1.5", className)}>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {labels.map((label, i) => {
          const n = i + 1
          const selected = value === n
          return (
            <label
              key={label}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                selected
                  ? "border-brand/40 bg-brand/10 text-brand"
                  : "bg-card hover:bg-muted/60"
              )}
            >
              <input
                type="radio"
                name={name}
                value={n}
                checked={selected}
                onChange={() => onChange(n)}
                className="sr-only"
              />
              <span className="text-base font-semibold tabular-nums">{n}</span>
              <span className="text-2xs leading-tight text-muted-foreground">
                {label}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
