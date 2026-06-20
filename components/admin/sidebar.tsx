"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useEffectEvent, useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  ArrowLeft,
  Bot,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react"
import type { AdminFeedbackPageData } from "@/lib/admin/feedback-types"

const NAV_ITEMS = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Projects", href: "/admin/projects", icon: FolderKanban },
  { label: "Billing", href: "/admin/billing", icon: CreditCard },
  { label: "Models", href: "/admin/models", icon: Bot },
  { label: "Feedback", href: "/admin/feedback", icon: MessageSquare },
  { label: "Audit", href: "/admin/audit", icon: ScrollText },
]

interface AdminSidebarProps {
  user: {
    name?: string | null
    email?: string | null
    role: string
    permissions: string[]
  }
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname()
  const canViewFeedback = user.permissions.includes("admin:view-feedback")
  const [feedbackUnreadCount, setFeedbackUnreadCount] = useState<number | null>(null)

  const syncFeedbackCount = useEffectEvent(async () => {
    if (!canViewFeedback) return
    try {
      const response = await fetch("/api/admin/feedback?pageSize=10", {
        cache: "no-store",
      })
      const payload = (await response.json().catch(() => null)) as AdminFeedbackPageData | null
      if (payload) setFeedbackUnreadCount(payload.summary.unreadCount)
    } catch {
      // ignore
    }
  })

  useEffect(() => {
    if (!canViewFeedback) return
    void syncFeedbackCount()
    const eventSource = new EventSource("/api/admin/feedback/stream")
    const handler = () => void syncFeedbackCount()
    eventSource.addEventListener("feedback.created", handler as EventListener)
    eventSource.addEventListener("feedback.updated", handler as EventListener)
    return () => {
      eventSource.removeEventListener("feedback.created", handler as EventListener)
      eventSource.removeEventListener("feedback.updated", handler as EventListener)
      eventSource.close()
    }
  }, [canViewFeedback])

  const navItems = NAV_ITEMS.filter(
    (item) => item.label !== "Feedback" || canViewFeedback,
  )

  function isActive(href: string) {
    return href === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(href)
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <ShieldCheck className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Admin</span>
                  <span className="text-xs text-[#9B9B9F]">Back Office</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-medium tracking-[0.05em] text-[#9B9B9F]/60 uppercase">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                        {item.label === "Feedback" &&
                        feedbackUnreadCount !== null &&
                        feedbackUnreadCount > 0 ? (
                          <SidebarMenuBadge className="border border-white/[0.04] bg-[#1B1B1F] text-[#E7E7E9]">
                            {feedbackUnreadCount > 99 ? "99+" : feedbackUnreadCount}
                          </SidebarMenuBadge>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/dashboard" className="text-[#9B9B9F] hover:text-[#E7E7E9]">
                <ArrowLeft className="h-4 w-4" />
                <span>Exit to Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
