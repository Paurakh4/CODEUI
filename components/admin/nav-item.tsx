"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface AdminNavItemProps {
  item: {
    label: string
    href: string
    icon: LucideIcon
    badgeCount?: number | null
  }
}

export function AdminNavItem({ item }: AdminNavItemProps) {
  const pathname = usePathname()
  const Icon = item.icon
  const isActive =
    pathname === item.href ||
    (item.href !== "/admin" && pathname.startsWith(item.href))
  const showBadge = typeof item.badgeCount === "number" && item.badgeCount > 0
  const badgeLabel =
    item.badgeCount && item.badgeCount > 99 ? "99+" : item.badgeCount

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors duration-150",
        isActive
          ? "bg-[#1B1B1F] text-[#E7E7E9]"
          : "text-[#9B9B9F] hover:bg-[#1B1B1F] hover:text-[#E7E7E9]",
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
      </div>
      {showBadge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-white/[0.04] bg-[#1B1B1F] px-1.5 text-[10px] font-medium text-[#E7E7E9]">
          {badgeLabel}
        </span>
      ) : null}
    </Link>
  )
}
