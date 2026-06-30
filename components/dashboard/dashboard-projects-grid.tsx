"use client"

import { useState, useMemo } from "react"
import {
  ArrowLeft,
  FolderOpen,
  Search,
  ArrowDownAZ,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Lock,
  Globe,
  MoreHorizontal,
  Heart,
  ExternalLink,
  Trash2,
  Loader2,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { DashboardProjectCard } from "@/components/dashboard/dashboard-project-card"
import Link from "next/link"

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

type SortOption = "newest" | "oldest" | "name-az" | "name-za"
type FilterOption = "all" | "private" | "public" | "favorites"
type ViewMode = "grid" | "list"

interface DashboardProjectsGridProps {
  projects: Project[]
  isLoading: boolean
  searchQuery: string
  view: "dashboard" | "projects"
  onViewChange: (view: "dashboard" | "projects") => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  onToggleVisibility: (id: string) => void
  onOpenPublic: (id: string) => void
  isDeleting: string | null
  updatingFavoriteIds: string[]
  updatingVisibilityIds: string[]
}

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  oldest: "Oldest",
  "name-az": "Name A-Z",
  "name-za": "Name Z-A",
}

const FILTER_LABELS: Record<FilterOption, string> = {
  all: "All projects",
  private: "Private",
  public: "Public",
  favorites: "Favorites",
}

function formatRelativeDate(date: string) {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m`
  if (diffHr < 24) return `${diffHr}h`
  if (diffDay === 1) return "Yesterday"
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function DashboardProjectsGrid({
  projects,
  isLoading,
  searchQuery: externalSearchQuery,
  view,
  onViewChange,
  onDelete,
  onToggleFavorite,
  onToggleVisibility,
  onOpenPublic,
  isDeleting,
  updatingFavoriteIds,
  updatingVisibilityIds,
}: DashboardProjectsGridProps) {
  const [localSearch, setLocalSearch] = useState("")
  const [sort, setSort] = useState<SortOption>("newest")
  const [filter, setFilter] = useState<FilterOption>("all")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")

  const searchQuery = externalSearchQuery || localSearch
  const hasSearch = searchQuery.trim().length > 0

  const displayProjects = useMemo(() => {
    let result = [...projects]

    // Filter
    if (filter === "private") result = result.filter((p) => p.isPrivate)
    else if (filter === "public") result = result.filter((p) => !p.isPrivate)
    else if (filter === "favorites") result = result.filter((p) => p.isFavorite)

    // Search
    if (hasSearch) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((p) => p.name.toLowerCase().includes(q))
    }

    // Sort
    if (sort === "newest") {
      result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    } else if (sort === "oldest") {
      result.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    } else if (sort === "name-az") {
      result.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sort === "name-za") {
      result.sort((a, b) => b.name.localeCompare(a.name))
    }

    return result
  }, [projects, filter, hasSearch, searchQuery, sort])

  return (
    <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-4 pb-4 z-10">
      {/* Toolbar Header — sticky with blur backdrop */}
      <div className="sticky top-[40px] z-20 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-2 pb-3 mb-4 bg-background/70 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="flex flex-col gap-3">
          {/* Row 1: Title + back */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewChange("dashboard")}
              className="flex items-center justify-center h-7 w-7 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] rounded-full shrink-0 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-baseline gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#E7E7E9]">
                My projects
              </h1>
              <span className="text-[11px] text-[#9B9B9F] tabular-nums">
                {projects.length} {projects.length === 1 ? "project" : "projects"}
              </span>
            </div>
          </div>

          {/* Row 2: Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-[280px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9B9B9F] pointer-events-none" />
              <input
                type="search"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full h-8 bg-[#0E0E10] border border-white/[0.05] rounded-lg pl-8 pr-3 text-xs text-[#E7E7E9] placeholder:text-[#9B9B9F]/60 outline-none focus-visible:border-white/[0.10] transition-colors"
                aria-label="Search projects"
              />
            </div>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#0E0E10] border border-white/[0.05] text-xs text-[#9B9B9F] hover:text-[#E7E7E9] hover:border-white/[0.08] transition-colors">
                  <ArrowDownAZ className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9] min-w-[140px]"
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                  <DropdownMenuItem
                    key={key}
                    onSelect={() => setSort(key)}
                    className={cn(
                      "gap-2 cursor-pointer focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-xs",
                      sort === key && "text-[#E7E7E9]",
                    )}
                  >
                    {SORT_LABELS[key]}
                    {sort === key && <span className="ml-auto text-[#9B9B9F]">•</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#0E0E10] border border-white/[0.05] text-xs text-[#9B9B9F] hover:text-[#E7E7E9] hover:border-white/[0.08] transition-colors">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{FILTER_LABELS[filter]}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9] min-w-[140px]"
              >
                {(Object.keys(FILTER_LABELS) as FilterOption[]).map((key) => (
                  <DropdownMenuItem
                    key={key}
                    onSelect={() => setFilter(key)}
                    className={cn(
                      "gap-2 cursor-pointer focus:bg-[#1B1B1F] focus:text-[#E7E7E9] text-xs",
                      filter === key && "text-[#E7E7E9]",
                    )}
                  >
                    {FILTER_LABELS[key]}
                    {filter === key && <span className="ml-auto text-[#9B9B9F]">•</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View toggle */}
            <div className="flex items-center rounded-lg bg-[#0E0E10] border border-white/[0.05] overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex items-center justify-center h-8 w-8 transition-colors",
                  viewMode === "grid"
                    ? "text-[#E7E7E9] bg-white/[0.06]"
                    : "text-[#9B9B9F] hover:text-[#E7E7E9]",
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center justify-center h-8 w-8 transition-colors",
                  viewMode === "list"
                    ? "text-[#E7E7E9] bg-white/[0.06]"
                    : "text-[#9B9B9F] hover:text-[#E7E7E9]",
                )}
                aria-label="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-white/[0.04] bg-[#0E0E10]">
                <Skeleton className="aspect-[16/10] w-full bg-[#1B1B1F] rounded-none" />
                <div className="p-2.5 space-y-1.5">
                  <Skeleton className="h-3 w-3/4 bg-[#1B1B1F]" />
                  <Skeleton className="h-2 w-1/2 bg-[#1B1B1F]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-[#0E0E10] p-3">
                <Skeleton className="h-10 w-16 rounded bg-[#1B1B1F]" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-1/3 bg-[#1B1B1F]" />
                  <Skeleton className="h-2 w-1/4 bg-[#1B1B1F]" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : displayProjects.length > 0 ? (
        viewMode === "grid" ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {displayProjects.map((project, i) => (
              <div
                key={project.id}
                className="animate-in fade-in slide-in-from-bottom-1 duration-300"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms`, animationFillMode: "backwards" }}
              >
                <DashboardProjectCard
                  project={project}
                  onDelete={onDelete}
                  isDeleting={isDeleting === project.id}
                  onToggleFavorite={onToggleFavorite}
                  onToggleVisibility={onToggleVisibility}
                  onOpenPublic={onOpenPublic}
                  isFavoriteUpdating={updatingFavoriteIds.includes(project.id)}
                  isVisibilityUpdating={updatingVisibilityIds.includes(project.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="flex flex-col gap-1">
            {displayProjects.map((project) => (
              <ProjectListRow
                key={project.id}
                project={project}
                onDelete={onDelete}
                isDeleting={isDeleting === project.id}
                onToggleFavorite={onToggleFavorite}
                onToggleVisibility={onToggleVisibility}
                onOpenPublic={onOpenPublic}
                isFavoriteUpdating={updatingFavoriteIds.includes(project.id)}
                isVisibilityUpdating={updatingVisibilityIds.includes(project.id)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="w-8 h-8 text-[#6B6B70] mb-3" />
          <h3 className="text-sm font-semibold text-[#E7E7E9] mb-1">
            {hasSearch || filter !== "all" ? "No matching projects" : "No projects yet"}
          </h3>
          <p className="text-xs text-[#9B9B9F]">
            {hasSearch || filter !== "all"
              ? "Try adjusting your search or filters."
              : "Start by creating your first project above!"}
          </p>
        </div>
      )}
    </div>
  )
}

function ProjectListRow({
  project,
  onDelete,
  isDeleting,
  onToggleFavorite,
  onToggleVisibility,
  onOpenPublic,
  isFavoriteUpdating,
  isVisibilityUpdating,
}: {
  project: Project
  onDelete: (id: string) => void
  isDeleting: boolean
  onToggleFavorite: (id: string) => void
  onToggleVisibility: (id: string) => void
  onOpenPublic: (id: string) => void
  isFavoriteUpdating: boolean
  isVisibilityUpdating: boolean
}) {
  return (
    <Link
      href={`/project/${project.id}`}
      className="group flex items-center gap-3 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 py-2.5 hover:border-white/[0.08] hover:bg-[#141416] transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative h-10 w-16 shrink-0 rounded overflow-hidden bg-[#1B1B1F]">
        {project.htmlContent ? (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1B1B1F] to-[#0E0E10]" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1B1B1F] to-[#0E0E10]">
            {project.emoji ? (
              <span className="text-sm opacity-40">{project.emoji}</span>
            ) : null}
          </div>
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <h3 className="text-xs font-medium text-[#E7E7E9] truncate">
          {project.name}
        </h3>
        <div className="flex items-center gap-1 text-[10px] text-[#9B9B9F]/50 mt-0.5">
          <span>{formatRelativeDate(project.updatedAt)}</span>
          <span>·</span>
          {project.isPrivate ? (
            <span className="flex items-center gap-0.5">
              <Lock className="w-2.5 h-2.5" />
              Private
            </span>
          ) : (
            <span className="flex items-center gap-0.5">
              <Globe className="w-2.5 h-2.5" />
              Public
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!isFavoriteUpdating) onToggleFavorite(project.id)
          }}
          disabled={isFavoriteUpdating}
          className="flex items-center justify-center h-6 w-6 rounded text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] transition-colors"
          aria-label="Toggle favorite"
        >
          {isFavoriteUpdating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Heart className={cn("w-3.5 h-3.5", project.isFavorite && "fill-current")} />
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              className="flex items-center justify-center h-6 w-6 rounded text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] transition-colors"
              aria-label="More actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9]"
          >
            {!project.isPrivate && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  onOpenPublic(project.id)
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
                if (!isVisibilityUpdating) onToggleVisibility(project.id)
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
                if (!isDeleting) onDelete(project.id)
              }}
              className="gap-2 cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10 text-xs"
              disabled={isDeleting}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isDeleting ? "Deleting..." : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Link>
  )
}
