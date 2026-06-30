import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  message: string
  className?: string
}

export function EmptyState({ icon: Icon, message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center",
        className,
      )}
    >
      <Icon className="h-5 w-5 text-[#9B9B9F]/50" />
      <span className="text-sm text-[#9B9B9F]">{message}</span>
    </div>
  )
}
