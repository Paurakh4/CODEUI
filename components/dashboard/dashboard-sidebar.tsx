"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Search,
  Heart,
  Code,
  Loader2,
  FolderOpen,
  Info,
  Star,
  Clock,
  Save,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { SubscriptionTier } from "@/lib/pricing"

interface Project {
  id: string
  name: string
  emoji?: string
  htmlContent?: string
  isPrivate: boolean
  isFavorite: boolean
  views: number
  likes: number
  createdAt: string
  updatedAt: string
}

interface DashboardSidebarProps {
  projects: Project[]
  isLoadingProjects: boolean
  onStart: (prompt?: string, model?: string) => void
  onOpenPricing: () => void
  onViewChange: (view: "dashboard" | "projects") => void
  userTier: SubscriptionTier
  userTotalCredits: number
  userMonthlyCredits: number
  usagePercentage: number
  formatRelativeDate: (date: string) => string
}

const TIER_CREDITS: Record<SubscriptionTier, number> = {
  free: 20,
  pro: 120,
  proplus: 350,
}

function getTierBadge(tier: SubscriptionTier) {
  switch (tier) {
    case "proplus":
      return { label: "Pro+", color: "text-white", bg: "bg-white/10", border: "border-white/20" }
    case "pro":
      return { label: "Pro", color: "text-[#E7E7E9]", bg: "bg-white/5", border: "border-white/10" }
    default:
      return { label: "Free", color: "text-[#9B9B9F]", bg: "bg-transparent", border: "border-white/[0.04]" }
  }
}

export function DashboardSidebar({
  projects,
  isLoadingProjects,
  onStart,
  onOpenPricing,
  onViewChange,
  userTier,
  userTotalCredits,
  userMonthlyCredits,
  usagePercentage,
  formatRelativeDate,
}: DashboardSidebarProps) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const tierBadge = getTierBadge(userTier)

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredProjects = useMemo(() => {
    if (!normalizedQuery) return []
    return projects
      .filter((p) => p.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 8)
  }, [projects, normalizedQuery])

  const favoriteProjects = useMemo(
    () => [...projects]
      .filter((p) => p.isFavorite)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8),
    [projects],
  )

  const recentProjects = useMemo(
    () => [...projects]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8),
    [projects],
  )

  const savedProjects = useMemo(
    () => [...projects]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
    [projects],
  )

  const maxCredits = TIER_CREDITS[userTier] || 20
  const usagePct = Math.max(0, Math.min(100, (userMonthlyCredits / maxCredits) * 100))

  return (
    <Sidebar
      variant="floating"
      collapsible="offcanvas"
      className="dashboard-sidebar"
    >
      <SidebarHeader className="p-1.5">
        <div className="flex items-center gap-1 px-1">
          <div className="w-4 h-4 bg-white text-black rounded flex items-center justify-center text-[8px] font-bold shrink-0">
            C
          </div>
          <span className="text-xs font-semibold text-[#E7E7E9] truncate">Personal</span>
          <span className={cn(
            "text-[9px] font-semibold px-1 py-0.5 rounded border",
            tierBadge.bg,
            tierBadge.color,
            tierBadge.border,
          )}>
            {tierBadge.label}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {!isCollapsed && (
          <>
            {/* Create Project */}
            <SidebarGroup>
              <SidebarGroupContent>
                <Button
                  onClick={() => onStart()}
                  className="w-full justify-start gap-1.5 bg-[#121212] text-white hover:bg-[#1B1B1F] h-7 rounded-lg text-[11px]"
                >
                  <Code className="w-3 h-3" />
                  <span className="text-xs font-medium">Create Project</span>
                </Button>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Projects */}
            <SidebarGroup>
              <SidebarGroupContent>
                <button
                  onClick={() => onViewChange("projects")}
                  className="w-full flex items-center justify-start gap-1.5 px-2 h-7 text-[11px] text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg transition-colors"
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>Projects</span>
                </button>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Search */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[#9B9B9F] text-[10px] font-semibold">
                Search
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9B9B9F] pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 120)}
                    placeholder="Search projects..."
                    className="w-full h-7 bg-[#0E0E10] border border-white/[0.04] rounded-lg pl-7 pr-2.5 text-[11px] text-[#E7E7E9] placeholder:text-[#9B9B9F] outline-none focus-visible:ring-1 focus-visible:ring-white transition-colors"
                    aria-label="Search projects"
                  />
                  {isSearchFocused && normalizedQuery && (
                    <div className="absolute z-40 mt-1 left-0 right-0 rounded-lg border border-white/[0.04] bg-[#050505]/95 backdrop-blur-xl shadow-xl overflow-hidden">
                      <div className="max-h-56 overflow-y-auto py-0.5">
                        {filteredProjects.length > 0 ? (
                          filteredProjects.map((project) => (
                            <Link
                              key={project.id}
                              href={`/project/${project.id}`}
                              onClick={() => {
                                setIsSearchFocused(false)
                                setSearchQuery("")
                              }}
                              className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-[#E7E7E9] hover:bg-[#1B1B1F] transition-colors"
                            >
                              <span className="truncate">{project.name}</span>
                              <span className="text-[9px] text-[#9B9B9F] whitespace-nowrap">
                                {formatRelativeDate(project.updatedAt)}
                              </span>
                            </Link>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-[11px] text-[#9B9B9F] text-center">
                            No matching projects found.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Favorites */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#9B9B9F] text-[10px] font-semibold">
            Favorites
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9B9B9F]" />
              </div>
            ) : favoriteProjects.length > 0 ? (
              <SidebarMenu>
                {favoriteProjects.map((project) => (
                  <SidebarMenuItem key={`fav-${project.id}`}>
                    <SidebarMenuButton asChild tooltip={project.name} size="sm">
                      <Link href={`/project/${project.id}`}>
                        <Heart className="w-3 h-3 text-[#E7E7E9] fill-current shrink-0" />
                        <span className="truncate">{project.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className="text-[9px] text-[#9B9B9F]">
                      {formatRelativeDate(project.updatedAt)}
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <div className="px-2 py-2 text-[11px] text-[#9B9B9F]">
                <span className="flex items-center gap-1.5">
                  <Star className="w-2.5 h-2.5" />
                  Favorite projects to pin them here.
                </span>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Recent Chats */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#9B9B9F] text-[10px] font-semibold">
            Recent
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9B9B9F]" />
              </div>
            ) : recentProjects.length > 0 ? (
              <SidebarMenu>
                {recentProjects.map((project) => (
                  <SidebarMenuItem key={`recent-${project.id}`}>
                    <SidebarMenuButton asChild tooltip={project.name} size="sm">
                      <Link href={`/project/${project.id}`}>
                        <Clock className="w-3 h-3 text-[#9B9B9F] shrink-0" />
                        <span className="truncate">{project.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className="text-[9px] text-[#9B9B9F]">
                      {formatRelativeDate(project.updatedAt)}
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <div className="px-2 py-2 text-[11px] text-[#9B9B9F]">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-2.5 h-2.5" />
                  No activity yet.
                </span>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Saved Projects */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[#9B9B9F] text-[10px] font-semibold">
            Saved
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9B9B9F]" />
              </div>
            ) : savedProjects.length > 0 ? (
              <SidebarMenu>
                {savedProjects.map((project) => (
                  <SidebarMenuItem key={`saved-${project.id}`}>
                    <SidebarMenuButton asChild tooltip={project.name} size="sm">
                      <Link href={`/project/${project.id}`}>
                        <Save className="w-3 h-3 text-[#9B9B9F] shrink-0" />
                        <span className="truncate">{project.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            ) : (
              <div className="px-2 py-2 text-[11px] text-[#9B9B9F]">
                <span className="flex items-center gap-1.5">
                  <FolderOpen className="w-2.5 h-2.5" />
                  No saved projects.
                </span>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: Credits Widget */}
      {!isCollapsed && (
        <SidebarFooter className="p-1.5">
          <div className="rounded-lg bg-[#0E0E10] border border-white/[0.04] p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-normal text-[#9B9B9F]">Credits</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      aria-label="How credits work"
                      className="text-[#9B9B9F] hover:text-[#E7E7E9] transition-colors"
                    >
                      <Info className="w-2.5 h-2.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px] bg-[#0E0E10] text-[#E7E7E9] border-white/[0.04] text-[11px]">
                    Credits are consumed when you run AI generation. Monthly credits reset every billing cycle.
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-[11px] font-semibold text-[#E7E7E9]">{userTotalCredits}</span>
            </div>
            <div className="h-0.5 w-full bg-[#050505] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-[#E7E7E9]"
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[9px] text-[#9B9B9F]">{userMonthlyCredits} monthly credits</p>
              <button
                onClick={onOpenPricing}
                className="text-[9px] font-normal text-[#9B9B9F] hover:text-[#E7E7E9] transition-colors"
              >
                View plans &rarr;
              </button>
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
