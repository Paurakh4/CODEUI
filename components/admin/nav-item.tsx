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
        "flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
      </div>
      {showBadge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
          {badgeLabel}
        </span>
      ) : null}
    </Link>
  )
}
