import { cn } from "cn"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { initials } from "@/lib/format"

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl"

const sizes: Record<AvatarSize, string> = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-3xs",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-14 text-lg",
}

/** Deterministic hue (0-359) from a string so a person always gets the same avatar color. */
export function hueFromString(input: string) {
  let h = 0
  for (let i = 0; i < input.length; i++)
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h % 360
}

/** Gradient style for an initials avatar; the light text stays readable on these lightnesses. */
export function avatarGradient(seed: string): React.CSSProperties {
  const hue = hueFromString(seed)
  return {
    backgroundImage: `linear-gradient(135deg, oklch(0.6 0.13 ${hue}) 0%, oklch(0.46 0.15 ${(hue + 36) % 360}) 100%)`,
    color: "oklch(0.99 0 0)",
  }
}

/** Initials avatar with a stable color per name. */
export function PersonAvatar({
  name,
  size = "md",
  className,
}: {
  name: string
  size?: AvatarSize
  className?: string
}) {
  return (
    <Avatar className={cn(sizes[size], "shrink-0", className)}>
      <AvatarFallback
        className="font-semibold"
        style={avatarGradient(name || "?")}
      >
        {initials(name) || "?"}
      </AvatarFallback>
    </Avatar>
  )
}
