"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  Heart,
  MoreHorizontal,
  Globe,
  Lock,
  ExternalLink,
  Trash2,
  Loader2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PROJECT_CARD_DESKTOP_PREVIEW_WIDTH = 1440
const PROJECT_CARD_DESKTOP_PREVIEW_HEIGHT = 900

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

interface DashboardProjectCardProps {
  project: Project
  onDelete?: (projectId: string) => void
  isDeleting?: boolean
  onToggleFavorite?: (projectId: string) => void
  onToggleVisibility?: (projectId: string) => void
  onOpenPublic?: (projectId: string) => void
  isFavoriteUpdating?: boolean
  isVisibilityUpdating?: boolean
}

const formatNumber = (num: number) => {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

export function DashboardProjectCard({
  project,
  onDelete,
  isDeleting = false,
  onToggleFavorite,
  onToggleVisibility,
  onOpenPublic,
  isFavoriteUpdating = false,
  isVisibilityUpdating = false,
}: DashboardProjectCardProps) {
  const hasPreviewHtml = Boolean(project.htmlContent?.trim())

  return (
    <Link href={`/project/${project.id}`} className="block group">
      <div className="card-float relative glass-card rounded-lg overflow-hidden">
        {/* Preview area */}
        <div className={cn(
          "aspect-video w-full relative overflow-hidden",
          hasPreviewHtml ? "bg-black" : "bg-[#0E0E10]"
        )}>
          {hasPreviewHtml ? (
            <ProjectCardPreview htmlContent={project.htmlContent!} projectName={project.name} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl opacity-40 group-hover:opacity-70 transition-opacity">
                {project.emoji || "\uD83C\uDFA8"}
              </span>
            </div>
          )}

          {/* Overlay actions */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />

          <div className="absolute top-1.5 right-1.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="secondary"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleFavorite?.(project.id)
              }}
              aria-label={project.isFavorite ? `Remove ${project.name} from favorites` : `Add ${project.name} to favorites`}
              disabled={isFavoriteUpdating}
              className={cn(
                  "h-7 w-7 rounded-full bg-[#0E0E10]/70 backdrop-blur-sm border border-white/[0.04] text-white hover:bg-[#0E0E10]/90",
                project.isFavorite && "text-[#E7E7E9]"
              )}
            >
              {isFavoriteUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Heart className={cn("w-3.5 h-3.5", project.isFavorite && "fill-current")} />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  aria-label={`Actions for ${project.name}`}
                  className="h-7 w-7 rounded-full bg-[#0E0E10]/70 backdrop-blur-sm border border-white/[0.04] text-white hover:bg-[#0E0E10]/90"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9]">
                {!project.isPrivate && (
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      onOpenPublic?.(project.id)
                    }}
                    className="gap-2 cursor-pointer focus:bg-[#1B1B1F] focus:text-[#E7E7E9]"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open public page
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    if (!isVisibilityUpdating) onToggleVisibility?.(project.id)
                  }}
                  className="gap-2 cursor-pointer focus:bg-[#1B1B1F] focus:text-[#E7E7E9]"
                  disabled={isVisibilityUpdating}
                >
                  {isVisibilityUpdating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : project.isPrivate ? (
                    <Globe className="w-4 h-4" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {isVisibilityUpdating
                    ? "Saving visibility..."
                    : project.isPrivate
                      ? "Make public"
                      : "Make private"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    if (!isDeleting) onDelete?.(project.id)
                  }}
                  className="gap-2 cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10"
                  disabled={isDeleting}
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? "Deleting..." : "Delete project"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="absolute top-1.5 left-1.5">
            <span
              className={cn(
                "text-[9px] px-1 py-0.5 rounded border backdrop-blur-sm",
                project.isPrivate
                  ? "bg-[#0E0E10]/50 text-[#9B9B9F] border-white/[0.04]"
                  : "bg-white/5 text-[#E7E7E9] border-white/10"
              )}
            >
              {project.isPrivate ? "Private" : "Public"}
            </span>
          </div>
        </div>

        {/* Info section */}
        <div className="p-2">
          <h3 className="font-medium text-xs sm:text-sm text-[#E7E7E9] truncate mb-1">
            {project.name}
          </h3>
          <div className="flex items-center justify-between text-[11px] text-[#9B9B9F]">
            <div className="flex items-center gap-1.5">
              <span>{formatNumber(project.views)} views</span>
              <span>\u2022</span>
              <div className="flex items-center gap-0.5">
                <Heart className="w-2.5 h-2.5" />
                <span>{formatNumber(project.likes)}</span>
              </div>
            </div>
            <span className="px-1 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-white/5 text-[#9B9B9F] border border-white/10">
              Free
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

function ProjectCardPreview({
  htmlContent,
  projectName,
}: {
  htmlContent: string
  projectName: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.1)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScale = () => {
      const { width, height } = container.getBoundingClientRect()
      if (width <= 0 || height <= 0) return

      const nextScale = Math.min(
        width / PROJECT_CARD_DESKTOP_PREVIEW_WIDTH,
        height / PROJECT_CARD_DESKTOP_PREVIEW_HEIGHT,
      )

      setPreviewScale((currentScale) =>
        Math.abs(currentScale - nextScale) < 0.001 ? currentScale : nextScale,
      )
    }

    updateScale()

    const observer = new ResizeObserver(updateScale)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-black">
      <div
        className="absolute left-1/2 top-0 origin-top"
        style={{
          width: PROJECT_CARD_DESKTOP_PREVIEW_WIDTH,
          height: PROJECT_CARD_DESKTOP_PREVIEW_HEIGHT,
          transform: `translateX(-50%) scale(${previewScale})`,
        }}
      >
        <iframe
          title={`${projectName} preview`}
          srcDoc={htmlContent}
          sandbox="allow-scripts"
          loading="lazy"
          tabIndex={-1}
          className="block h-full w-full border-0 bg-white pointer-events-none"
        />
      </div>
    </div>
  )
}
