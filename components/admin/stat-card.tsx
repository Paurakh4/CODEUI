import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  className?: string
}

export function StatCard({ title, value, description, icon: Icon, className }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border border-white/[0.04] bg-[#0E0E10] p-4 transition-colors duration-150 hover:bg-[#1B1B1F]", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-[0.02em] text-[#9B9B9F]">{title}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[#E7E7E9]">{value}</p>
          {description ? (
            <p className="mt-1 text-sm text-[#9B9B9F]/80">{description}</p>
          ) : null}
        </div>
        {Icon ? (
          <div className="shrink-0 text-[#9B9B9F]">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
