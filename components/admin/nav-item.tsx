"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon } from "lucide-react";

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
  const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
  const showBadge = typeof item.badgeCount === "number" && item.badgeCount > 0
  const badgeLabel = item.badgeCount && item.badgeCount > 99 ? "99+" : item.badgeCount

  return (
    <Link
      href={item.href}
      className={`group flex items-center justify-between gap-3 rounded-2xl px-5 py-3 text-[12px] font-bold uppercase tracking-widest transition-all ${
        isActive 
          ? "bg-white/[0.05] text-white shadow-[0_0_20px_rgba(255,255,255,0.02)] border border-white/5" 
          : "text-[#71717A] hover:bg-white/[0.02] hover:text-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 ${isActive ? "text-[#0AA6FF]" : ""}`} />
        <span>{item.label}</span>
      </div>
      {showBadge ? (
        <span
          className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-[10px] ${
            isActive
              ? "bg-[#0AA6FF]/15 text-[#7FD0FF]"
              : "bg-white/[0.08] text-white"
          }`}
        >
          {badgeLabel}
        </span>
      ) : isActive ? (
        <div className="h-1.5 w-1.5 rounded-full bg-[#0AA6FF] shadow-[0_0_10px_#0AA6FF]" />
      ) : null}
    </Link>
  )
}
