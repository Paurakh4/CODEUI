"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
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
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PROJECT_CARD_DESKTOP_PREVIEW_WIDTH = 1440
const PROJECT_CARD_DESKTOP_PREVIEW_HEIGHT = 900

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

function isRecentlyUpdated(date: string) {
  const diffMs = Date.now() - new Date(date).getTime()
  return diffMs < 3600000
}

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
  const router = useRouter()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const hasPreviewHtml = Boolean(project.htmlContent?.trim())

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't navigate if the click came from the actions overlay
    const target = e.target as HTMLElement
    if (target.closest("[data-card-action]")) return
    router.push(`/project/${project.id}`)
  }

  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      router.push(`/project/${project.id}`)
    }
  }

  return (
    <>
      <div
        role="link"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        aria-label={`Open ${project.name}`}
        className="block group cursor-pointer"
      >
        <div className="card-float relative glass-card rounded-lg overflow-hidden transition-all duration-[140ms] ease-[cubic-bezier(.2,.8,.2,1)] hover:border-white/[0.1] hover:shadow-lg hover:shadow-black/20">
          {/* Preview area — 16:10 fixed ratio, inherits top radius */}
          <div className={cn(
            "aspect-[16/10] w-full relative overflow-hidden rounded-t-lg transition-transform duration-[160ms] ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.01]",
            hasPreviewHtml ? "bg-black" : "bg-[#0E0E10]"
          )}>
            {hasPreviewHtml ? (
              <ProjectCardPreview htmlContent={project.htmlContent!} projectName={project.name} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1B1B1F] via-[#141416] to-[#0E0E10]">
                <div className="flex flex-col items-center gap-1.5 opacity-30 group-hover:opacity-50 transition-opacity">
                  {project.emoji ? (
                    <span className="text-3xl">{project.emoji}</span>
                  ) : null}
                  <div className="h-px w-12 bg-white/10" />
                </div>
              </div>
            )}

            {/* Overlay actions */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />

            <div
              data-card-action
              className="absolute top-1.5 right-1.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
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
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9]"
                >
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
                      if (!isDeleting) setIsDeleteDialogOpen(true)
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

            {/* Status badge — bottom-right of preview */}
            <div className="absolute bottom-1.5 right-1.5">
              <span
                className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded-full border backdrop-blur-sm",
                  project.isPrivate
                    ? "bg-[#0E0E10]/60 text-[#9B9B9F] border-white/[0.04]"
                    : "bg-white/5 text-[#E7E7E9] border-white/10"
                )}
              >
                {project.isPrivate ? "Private" : "Public"}
              </span>
            </div>

            {/* Recent accent dot — top-left */}
            {isRecentlyUpdated(project.updatedAt) && (
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
              </div>
            )}
          </div>

          {/* Info section — compact single-line metadata */}
          <div className="px-2.5 py-1.5">
            <h3 className="font-medium text-[11px] sm:text-[12px] text-[#E7E7E9] line-clamp-2 leading-tight">
              {project.name}
            </h3>
            <div className="flex items-center gap-1 text-[10px] text-[#9B9B9F]/50 mt-1">
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
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#0E0E10] border-white/[0.04] text-[#E7E7E9]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#E7E7E9]">Delete project?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#9B9B9F]">
              {`"${project.name}" will be permanently deleted. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-transparent border-white/[0.04] text-[#E7E7E9] hover:bg-[#1B1B1F] hover:text-[#E7E7E9]"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                onDelete?.(project.id)
                setIsDeleteDialogOpen(false)
              }}
              className="bg-red-500/90 text-white hover:bg-red-500"
              disabled={isDeleting}
            >
              {isDeleting ? (
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
    </>
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

      const nextScale = Math.max(
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
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-black" style={{ filter: "contrast(1.05) brightness(1.02)" }}>
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
