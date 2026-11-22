"use client"

import Link from "next/link"
import { cn } from "cn"

import {
  PersonAvatar,
  type AvatarSize,
} from "@/components/shared/person-avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { activePeople, getPerson } from "@/lib/vantage/selectors"
import { workspace } from "@/lib/vantage/store"

const nameSize: Record<AvatarSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
}

/**
 * A person's avatar and name, linked to their profile. Reads the workspace, so
 * a rename shows everywhere at once.
 */
export function PersonChip({
  personId,
  size = "sm",
  showRole = false,
  link = true,
  className,
}: {
  personId: string
  size?: AvatarSize
  /** Show the role under the name. */
  showRole?: boolean
  /** Link the chip to the profile. Turn off inside rows that are already links. */
  link?: boolean
  className?: string
}) {
  const person = getPerson(workspace.use(), personId)
  const name = person?.name ?? "Removed person"
  const body = (
    <>
      <PersonAvatar name={name} size={size} />
      <span className="grid min-w-0 leading-tight">
        <span className={cn("truncate font-medium", nameSize[size])}>
          {name}
        </span>
        {showRole && person && (
          <span className="truncate text-xs text-muted-foreground">
            {person.role}
          </span>
        )}
      </span>
    </>
  )
  const classes = cn("inline-flex min-w-0 items-center gap-2", className)
  if (!link || !person) return <span className={classes}>{body}</span>
  return (
    <Link
      href={`/people/${person.id}`}
      className={cn(
        classes,
        "rounded-md underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {body}
    </Link>
  )
}

/** Select for choosing a direct report. `allLabel` adds an "everyone" option with value "all". */
export function PersonSelect({
  value,
  onChange,
  allLabel,
  id,
  className,
  placeholder = "Choose a person",
}: {
  value: string
  onChange: (personId: string) => void
  allLabel?: string
  id?: string
  className?: string
  placeholder?: string
}) {
  const people = activePeople(workspace.use())
  const items = [
    ...(allLabel ? [{ value: "all", label: allLabel }] : []),
    ...people.map((p) => ({ value: p.id, label: p.name })),
  ]
  return (
    <Select
      value={value || null}
      onValueChange={(v) => v && onChange(v)}
      items={items}
    >
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
