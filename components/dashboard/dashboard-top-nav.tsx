"use client"

import Link from "next/link"
import { Crown, Zap } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserMenu } from "@/components/user-menu"
import type { SubscriptionTier } from "@/lib/pricing"

interface DashboardTopNavProps {
  userTier: SubscriptionTier
  userTotalCredits: number
  onOpenPricing: () => void
  onOpenFeedback: () => void
}

export function DashboardTopNav({
  userTier,
  userTotalCredits,
  onOpenPricing,
  onOpenFeedback,
}: DashboardTopNavProps) {
  return (
    <header className="sticky top-0 right-0 z-30 flex items-center justify-between gap-1 px-2 py-1.5 bg-background/70 backdrop-blur-xl border-b border-white/[0.04]">
      <div className="flex items-center gap-1">
        <SidebarTrigger className="text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg h-7 w-7" />
      </div>
      <div className="flex items-center gap-3 sm:gap-5">
        <Link
          href="/discover"
          className="hidden sm:flex text-[11px] text-[#9B9B9F]/80 hover:text-[#E7E7E9] transition-colors"
        >
          Discover
        </Link>
        <button
          onClick={onOpenFeedback}
          className="hidden sm:flex text-[11px] text-[#9B9B9F]/80 hover:text-[#E7E7E9] transition-colors"
        >
          Feedback
        </button>
        <div className="hidden sm:block w-px h-3.5 bg-white/[0.08]" />
        <button
          onClick={onOpenPricing}
          className="hidden sm:flex items-center text-[11px] font-medium text-[#E7E7E9] hover:text-white px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] hover:bg-white/[0.1] hover:border-white/[0.15] transition-colors"
        >
          Upgrade
        </button>
        <div className="flex items-center gap-1.5">
          <div
            onClick={onOpenPricing}
            className="flex items-center gap-1.5 bg-[#0E0E10] hover:bg-[#1B1B1F] border border-white/[0.05] rounded-full px-2.5 py-1 h-auto transition-colors cursor-pointer"
          >
            {userTier === "proplus" ? (
              <Crown className="w-3 h-3 text-[#E7E7E9]" />
            ) : (
              <Zap className="w-3 h-3 text-[#9B9B9F]" />
            )}
            <div className="flex items-center gap-0.5">
              <span className="text-[11px] font-medium text-[#E7E7E9]">{userTotalCredits}</span>
              <span className="hidden sm:inline text-[9px] text-[#6B6B70] font-[400] tracking-[0.02em]">Credits</span>
            </div>
          </div>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
