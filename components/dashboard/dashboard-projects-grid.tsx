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
    <div className="w-full max-w-[1400px] mx-auto px-3 sm:px-4 pb-4 z-10">
      {/* Header */}
      {view === "dashboard" ? (
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-[#E7E7E9] mb-0.5 sm:mb-1">
              My Projects
            </h2>
            <p className="text-xs sm:text-sm text-[#9B9B9F]">
              Explore what you have built with CodeUI.
            </p>
          </div>
          {projects.length > 0 && (
            <button
              onClick={() => onViewChange("projects")}
              className="flex items-center gap-1 text-xs sm:text-sm text-[#9B9B9F] hover:text-[#E7E7E9] transition-colors group"
            >
              Browse All{" "}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6 mt-2 md:mt-0 pt-2">
          <button
            onClick={() => onViewChange("dashboard")}
            className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 text-[#9B9B9F] hover:text-[#E7E7E9] hover:bg-[#1B1B1F] border border-white/[0.04] shrink-0 rounded-lg transition-colors">
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#E7E7E9]">
              My Projects
            </h1>
            <p className="text-xs sm:text-sm text-[#9B9B9F]">
              A collection of everything you&apos;ve created.
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: view === "dashboard" ? 4 : 8 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-white/[0.04] bg-[#0E0E10]">
              <Skeleton className="aspect-video w-full bg-[#1B1B1F] rounded-none" />
              <div className="p-2.5 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4 bg-[#1B1B1F]" />
                <Skeleton className="h-2.5 w-1/2 bg-[#1B1B1F]" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length > 0 ? (
        /* Project Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
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
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <FolderOpen className="w-8 h-8 text-[#6B6B70] mb-3" />
          <h3 className="text-base font-semibold text-[#E7E7E9] mb-1">
            {hasSearch ? "No matching projects" : "No projects yet"}
          </h3>
          <p className="text-sm text-[#9B9B9F]">
            {hasSearch
              ? "Try a different search term."
              : "Start by creating your first project above!"}
          </p>
        </div>
      )}
    </div>
  )
}
