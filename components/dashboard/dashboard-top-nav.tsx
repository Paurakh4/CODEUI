"use client"

import Link from "next/link"
import { Crown, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
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
    <header className="sticky top-0 right-0 z-30 flex items-center justify-between gap-1 sm:gap-2 px-3 sm:px-4 py-2">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg h-8 w-8" />
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden sm:flex text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] h-8 text-xs rounded-lg"
        >
          <Link href="/discover">Discover</Link>
        </Button>
        <button
          onClick={onOpenPricing}
          className="hidden sm:flex text-xs font-medium text-[#E7E7E9] hover:text-white px-2 py-1 rounded transition-colors hover:bg-[#1B1B1F]"
        >
          Upgrade
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenFeedback}
          className="hidden sm:flex text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] h-8 text-xs rounded-lg"
        >
          Feedback
        </Button>
        <div
          onClick={onOpenPricing}
          className="flex items-center gap-2 bg-[#0E0E10] hover:bg-[#1B1B1F] border border-white/[0.04] rounded-full px-3 py-1.5 sm:py-1 h-auto transition-colors cursor-pointer"
        >
          {userTier === "proplus" ? (
            <Crown className="w-3.5 h-3.5 text-[#E7E7E9]" />
          ) : (
            <Zap className="w-3.5 h-3.5 text-[#9B9B9F]" />
          )}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-[#E7E7E9]">{userTotalCredits}</span>
            <span className="hidden sm:inline text-[10px] text-[#6B6B70] font-[400] tracking-[0.02em]">Credits</span>
          </div>
        </div>
        <UserMenu />
      </div>
    </header>
  )
}
