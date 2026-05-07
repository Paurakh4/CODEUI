"use client"

import { ChevronRight, ArrowLeft, FolderOpen, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardProjectCard } from "@/components/dashboard/dashboard-project-card"

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

export function DashboardProjectsGrid({
  projects,
  isLoading,
  searchQuery,
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
  const hasSearch = searchQuery.trim().length > 0
  const displayProjects = view === "dashboard" ? projects.slice(0, 4) : projects

  return (
    <div className="w-full max-w-[1400px] mx-auto px-2 sm:px-3 pb-2 z-10">
      {/* Header */}
      {view === "dashboard" ? (
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-[#E7E7E9]">
              My Projects
            </h2>
            <p className="text-[11px] sm:text-xs text-[#9B9B9F]">
              Explore what you have built with CodeUI.
            </p>
          </div>
          {projects.length > 0 && (
            <button
              onClick={() => onViewChange("projects")}
              className="flex items-center gap-0.5 text-[11px] sm:text-xs text-[#9B9B9F] hover:text-[#E7E7E9] transition-colors group"
            >
              Browse All{" "}
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mb-2 mt-1 pt-1">
          <button
            onClick={() => onViewChange("dashboard")}
            className="flex items-center justify-center h-6 w-6 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] border border-white/[0.04] shrink-0 rounded-lg transition-colors">
            <ArrowLeft className="w-3 h-3" />
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#E7E7E9]">
              My Projects
            </h1>
            <p className="text-[11px] sm:text-xs text-[#9B9B9F]">
              A collection of everything you&apos;ve created.
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
          {Array.from({ length: view === "dashboard" ? 4 : 8 }).map((_, i) => (
            <div key={i} className="rounded-lg overflow-hidden border border-white/[0.04] bg-[#0E0E10]">
              <Skeleton className="aspect-video w-full bg-[#1B1B1F] rounded-none" />
              <div className="p-2 space-y-1">
                <Skeleton className="h-3 w-3/4 bg-[#1B1B1F]" />
                <Skeleton className="h-2 w-1/2 bg-[#1B1B1F]" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length > 0 ? (
        /* Project Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
          {displayProjects.map((project) => (
            <DashboardProjectCard
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
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <FolderOpen className="w-6 h-6 text-[#6B6B70] mb-2" />
          <h3 className="text-sm font-semibold text-[#E7E7E9] mb-0.5">
            {hasSearch ? "No matching projects" : "No projects yet"}
          </h3>
          <p className="text-xs text-[#9B9B9F]">
            {hasSearch
              ? "Try a different search term."
              : "Start by creating your first project above!"}
          </p>
        </div>
      )}
    </div>
  )
}
