import { cn } from "@/lib/utils"

type StatusVariant =
  | "green"
  | "blue"
  | "gray"
  | "purple"
  | "yellow"
  | "red"

const VARIANT_STYLES: Record<StatusVariant, string> = {
  green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  gray: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  yellow: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  red: "bg-red-500/10 text-red-400 border-red-500/20",
}

const VARIANT_DOT: Record<StatusVariant, string> = {
  green: "bg-emerald-400",
  blue: "bg-blue-400",
  gray: "bg-zinc-400",
  purple: "bg-purple-400",
  yellow: "bg-amber-400",
  red: "bg-red-400",
}

interface StatusPillProps {
  label: string
  variant: StatusVariant
  className?: string
}

export function StatusPill({ label, variant, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", VARIANT_DOT[variant])} />
      {label}
    </span>
  )
}

export function variantForRole(role: string): StatusVariant {
  if (role === "owner") return "blue"
  if (role === "admin") return "purple"
  if (role === "moderator") return "yellow"
  return "gray"
}

export function variantForTier(tier: string): StatusVariant {
  if (tier === "proplus") return "purple"
  if (tier === "pro") return "purple"
  if (tier === "free") return "gray"
  return "gray"
}

export function variantForStatus(status: string): StatusVariant {
  if (status === "active") return "green"
  if (status === "suspended") return "red"
  if (status === "pending") return "yellow"
  return "gray"
}
