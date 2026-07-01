"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Search,
  Heart,
  Loader2,
  FolderOpen,
  Clock,
  FileClock,
  MoreHorizontal,
  Globe,
  Lock,
  ExternalLink,
  Trash2,
  ChevronRight,
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
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  onOpenPricing: () => void
  onViewChange: (view: "dashboard" | "projects") => void
  userTier: SubscriptionTier
  userTotalCredits: number
  userMonthlyCredits: number
  usagePercentage: number
  formatRelativeDate: (date: string) => string
  onToggleFavorite?: (projectId: string) => void
  onToggleVisibility?: (projectId: string) => void
  onDeleteProject?: (projectId: string) => void
  onOpenPublic?: (projectId: string) => void
  updatingFavoriteIds?: string[]
  updatingVisibilityIds?: string[]
  deletingProjectId?: string | null
}

const TIER_CREDITS: Record<SubscriptionTier, number> = {
  free: 20,
  pro: 120,
  proplus: 350,
}

function getDaysUntilReset() {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return Math.ceil((nextMonth.getTime() - now.getTime()) / 86400000)
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

interface SidebarProjectItemProps {
  project: Project
  icon: "favorite" | "recent"
  formatRelativeDate: (date: string) => string
  onToggleFavorite?: (projectId: string) => void
  onToggleVisibility?: (projectId: string) => void
  onDeleteRequest?: (project: Project) => void
  onOpenPublic?: (projectId: string) => void
  isFavoriteUpdating?: boolean
  isVisibilityUpdating?: boolean
}

function SidebarProjectItem({
  project,
  icon,
  formatRelativeDate,
  onToggleFavorite,
  onToggleVisibility,
  onDeleteRequest,
  onOpenPublic,
  isFavoriteUpdating = false,
  isVisibilityUpdating = false,
}: SidebarProjectItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isFavoriteUpdating) return
    onToggleFavorite?.(project.id)
  }

  const showFavoriteHeart = icon === "favorite"

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={project.name} size="sm">
        <Link
          href={`/project/${project.id}`}
          className="flex items-center w-full min-w-0 pr-12"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {showFavoriteHeart ? (
              <button
                type="button"
                onClick={handleHeartClick}
                disabled={isFavoriteUpdating}
                aria-label={`Remove ${project.name} from favorites`}
                className="shrink-0 text-[#E7E7E9] hover:text-[#9B9B9F] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isFavoriteUpdating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Heart className="w-3 h-3 fill-current" />
                )}
              </button>
            ) : (
              <FileClock className="w-3 h-3 text-[#9B9B9F]/70 shrink-0" />
            )}
            <span className="truncate">{project.name}</span>
          </div>
          <span className="text-[9px] text-[#9B9B9F]/60 whitespace-nowrap ml-2 shrink-0 group-hover/menu-item:opacity-0 transition-opacity">
            {formatRelativeDate(project.updatedAt)}
          </span>
        </Link>
      </SidebarMenuButton>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            aria-label={`Actions for ${project.name}`}
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md w-5 h-5 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] transition-opacity",
              "opacity-0 group-hover/menu-item:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
              menuOpen && "opacity-100",
            )}
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="right"
          onClick={(e) => e.stopPropagation()}
          className="bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9] min-w-[160px]"
        >
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              if (!isFavoriteUpdating) onToggleFavorite?.(project.id)
            }}
            className="gap-2 cursor-pointer focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-xs"
            disabled={isFavoriteUpdating}
          >
            <Heart className={cn("w-3.5 h-3.5", project.isFavorite && "fill-current")} />
            {project.isFavorite ? "Remove favorite" : "Add to favorites"}
          </DropdownMenuItem>
          {!project.isPrivate && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                onOpenPublic?.(project.id)
              }}
              className="gap-2 cursor-pointer focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open public page
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              if (!isVisibilityUpdating) onToggleVisibility?.(project.id)
            }}
            className="gap-2 cursor-pointer focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-xs"
            disabled={isVisibilityUpdating}
          >
            {isVisibilityUpdating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : project.isPrivate ? (
              <Globe className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            {project.isPrivate ? "Make public" : "Make private"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              onDeleteRequest?.(project)
            }}
            className="gap-2 cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

export function DashboardSidebar({
  projects,
  isLoadingProjects,
  onOpenPricing,
  onViewChange,
  userTier,
  userTotalCredits,
  userMonthlyCredits,
  usagePercentage: _usagePercentage,
  formatRelativeDate,
  onToggleFavorite,
  onToggleVisibility,
  onDeleteProject,
  onOpenPublic,
  updatingFavoriteIds = [],
  updatingVisibilityIds = [],
  deletingProjectId = null,
}: DashboardSidebarProps) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null)
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
      .slice(0, 6),
    [projects],
  )
  const recentProjectsCount = projects.length

  const maxCredits = TIER_CREDITS[userTier] || 20
  const usagePct = Math.max(0, Math.min(100, (userMonthlyCredits / maxCredits) * 100))

  const handleConfirmDelete = () => {
    if (projectPendingDelete && onDeleteProject) {
      onDeleteProject(projectPendingDelete.id)
    }
    setProjectPendingDelete(null)
  }

  return (
    <Sidebar
      variant="floating"
      collapsible="offcanvas"
      className="dashboard-sidebar"
    >
      <SidebarHeader className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 bg-white text-black rounded flex items-center justify-center text-[8px] font-bold shrink-0">
            C
          </div>
          <span className="text-xs font-semibold text-[#E7E7E9] truncate">Personal</span>
          <span className={cn(
            "text-[8px] font-semibold px-1 py-0.5 rounded-full border shrink-0",
            tierBadge.bg,
            tierBadge.color,
            tierBadge.border,
          )}>
            {tierBadge.label}
          </span>
          <ChevronRight className="w-3 h-3 text-[#9B9B9F]/40 shrink-0 ml-auto" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {!isCollapsed && (
          <>
            {/* Workspace — Projects */}
            <SidebarGroup className="pb-1">
              <SidebarGroupContent>
                <button
                  onClick={() => onViewChange("projects")}
                  className="w-full flex items-center justify-start gap-1.5 px-2 h-7 text-[11px] text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-lg transition-colors"
                >
                  <FolderOpen className="w-3 h-3 opacity-80" />
                  <span>Projects</span>
                </button>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Divider */}
            <div className="mx-2 border-t border-white/[0.05]" />

            {/* Search — integrated, tighter above, more space below */}
            <SidebarGroup className="pt-2 pb-3">
              <SidebarGroupContent>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9B9B9F] opacity-80 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 120)}
                    placeholder="Search projects..."
                    className="w-full h-7 bg-[#0E0E10] border border-white/[0.05] rounded-lg pl-7 pr-12 text-[11px] text-[#E7E7E9] placeholder:text-[#9B9B9F] outline-none focus-visible:border-white/[0.10] transition-colors"
                    aria-label="Search projects"
                  />
                  <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] text-[#6B6B70] font-medium pointer-events-none select-none">
                    ⌘K
                  </kbd>
                  {isSearchFocused && normalizedQuery && (
                    <div className="absolute z-40 mt-1 left-0 right-0 rounded-lg border border-white/[0.05] bg-[#050505]/95 backdrop-blur-xl shadow-xl overflow-hidden">
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
                              <span className="truncate min-w-0 flex-1">{project.name}</span>
                              <span className="text-[9px] text-[#9B9B9F]/60 whitespace-nowrap shrink-0">
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

            {/* Divider */}
            <div className="mx-2 border-t border-white/[0.05]" />
          </>
        )}

        {/* Favorites — only show if 2+ items, otherwise merge into Recent */}
        {favoriteProjects.length >= 2 && (
          <>
            <SidebarGroup className="pt-2">
              <SidebarGroupLabel className="text-[#9B9B9F] text-[10px] font-medium">
                Pinned
              </SidebarGroupLabel>
              <SidebarGroupContent>
                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9B9B9F]" />
                  </div>
                ) : (
                  <SidebarMenu>
                    {favoriteProjects.map((project) => (
                      <SidebarProjectItem
                        key={`fav-${project.id}`}
                        project={project}
                        icon="favorite"
                        formatRelativeDate={formatRelativeDate}
                        onToggleFavorite={onToggleFavorite}
                        onToggleVisibility={onToggleVisibility}
                        onDeleteRequest={setProjectPendingDelete}
                        onOpenPublic={onOpenPublic}
                        isFavoriteUpdating={updatingFavoriteIds.includes(project.id)}
                        isVisibilityUpdating={updatingVisibilityIds.includes(project.id)}
                      />
                    ))}
                  </SidebarMenu>
                )}
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Divider */}
            <div className="mx-2 border-t border-white/[0.05]" />
          </>
        )}

        {/* Recent */}
        <SidebarGroup className="pt-1">
          <SidebarGroupLabel className="text-[#9B9B9F] text-[10px] font-medium">
            Recent
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9B9B9F]" />
              </div>
            ) : recentProjects.length > 0 ? (
              <>
                <SidebarMenu>
                  {recentProjects.map((project) => (
                    <SidebarProjectItem
                      key={`recent-${project.id}`}
                      project={project}
                      icon="recent"
                      formatRelativeDate={formatRelativeDate}
                      onToggleFavorite={onToggleFavorite}
                      onToggleVisibility={onToggleVisibility}
                      onDeleteRequest={setProjectPendingDelete}
                      onOpenPublic={onOpenPublic}
                      isFavoriteUpdating={updatingFavoriteIds.includes(project.id)}
                      isVisibilityUpdating={updatingVisibilityIds.includes(project.id)}
                    />
                  ))}
                </SidebarMenu>
                {recentProjectsCount > 6 && (
                  <button
                    onClick={() => onViewChange("projects")}
                    className="flex items-center gap-0.5 px-2 pt-1.5 text-[10px] text-[#9B9B9F] hover:text-[#E7E7E9] transition-colors"
                  >
                    View history ({recentProjectsCount})
                    <ChevronRight className="w-2.5 h-2.5" />
                  </button>
                )}
              </>
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
      </SidebarContent>

      {/* Footer: Credits — quiet, integrated status */}
      {!isCollapsed && (
        <SidebarFooter className="p-2 pb-3 mt-auto">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#E7E7E9] tabular-nums">
                {userTotalCredits} <span className="text-[#9B9B9F] font-normal">credits</span>
              </span>
              <button
                onClick={onOpenPricing}
                className="text-[10px] text-[#9B9B9F] hover:text-[#E7E7E9] transition-colors"
              >
                {userTier === "free" ? "View plans" : "Manage plan"}
              </button>
            </div>
            <div className="relative h-0.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 bg-[#9B9B9F]/40"
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <p className="text-[9px] text-[#6B6B70] leading-none">
              {userTier === "free" ? "Monthly allowance" : `Resets in ${getDaysUntilReset()} days`}
            </p>
          </div>
        </SidebarFooter>
      )}

      <AlertDialog
        open={projectPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setProjectPendingDelete(null)
        }}
      >
        <AlertDialogContent className="bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#E7E7E9]">Delete project?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#9B9B9F]">
              {projectPendingDelete
                ? `"${projectPendingDelete.name}" will be permanently deleted. This action cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-transparent border-white/[0.04] text-[#E7E7E9] hover:bg-[#1B1B1F] hover:text-[#E7E7E9]"
              disabled={
                projectPendingDelete !== null &&
                deletingProjectId === projectPendingDelete.id
              }
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              className="bg-red-500/90 text-white hover:bg-red-500"
              disabled={
                projectPendingDelete !== null &&
                deletingProjectId === projectPendingDelete.id
              }
            >
              {projectPendingDelete !== null &&
                deletingProjectId === projectPendingDelete.id ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}
