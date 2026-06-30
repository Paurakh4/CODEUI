"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { ArrowLeft, Eye, Heart, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { PublicProjectPreview } from "@/components/discover/public-project-preview"
import { useAuthDialog } from "@/components/auth-dialog-provider"

interface PublicProject {
  id: string
  name: string
  emoji?: string
  htmlContent?: string
  views: number
  likes: number
  ownerName: string
  ownerImage?: string | null
  createdAt: string
  updatedAt: string
  viewerHasLiked: boolean
}

interface PublicProjectDetailClientProps {
  id: string
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

function Avatar({ name, image }: { name: string; image?: string | null }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt={name} className="h-8 w-8 rounded-full object-cover" />
    )
  }
  return (
    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1B1B1F] to-[#0E0E10] flex items-center justify-center font-medium text-[11px] text-[#9B9B9F] border border-white/[0.06]">
      {getInitials(name)}
    </div>
  )
}

export function PublicProjectDetailClient({ id }: PublicProjectDetailClientProps) {
  const { data: session } = useSession()
  const { showSignIn } = useAuthDialog()
  const [project, setProject] = React.useState<PublicProject | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isLikePending, setIsLikePending] = React.useState(false)
  const hasTrackedViewRef = React.useRef(false)

  React.useEffect(() => {
    let isDisposed = false
    hasTrackedViewRef.current = false

    const loadProject = async () => {
      setIsLoading(true)
      setErrorMessage(null)
      setProject(null)

      try {
        const response = await fetch(`/api/discover/projects/${id}`)

        if (isDisposed) return

        if (!response.ok) {
          throw new Error(response.status === 404 ? "This public project could not be found." : "Failed to load project")
        }

        const data = (await response.json()) as { project: PublicProject }

        if (isDisposed) return

        setProject(data.project)
      } catch (error) {
        if (!isDisposed) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load project")
        }
      } finally {
        if (!isDisposed) {
          setIsLoading(false)
        }
      }
    }

    void loadProject()

    return () => {
      isDisposed = true
    }
  }, [id])

  React.useEffect(() => {
    if (!project || hasTrackedViewRef.current) return

    hasTrackedViewRef.current = true

    void fetch(`/api/discover/projects/${id}/view`, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to track view")
        const data = (await response.json()) as { views: number }
        setProject((current) => (current ? { ...current, views: data.views } : current))
      })
      .catch((error) => console.error(error))
  }, [id, project])

  const toggleLike = async () => {
    if (!session?.user?.id) {
      showSignIn()
      return
    }

    setIsLikePending(true)

    try {
      const response = await fetch(`/api/discover/projects/${id}/like`, { method: "POST" })
      if (!response.ok) throw new Error("Failed to update like")
      const data = (await response.json()) as { liked: boolean; likes: number }
      setProject((current) =>
        current ? { ...current, likes: data.likes, viewerHasLiked: data.liked } : current,
      )
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update like")
    } finally {
      setIsLikePending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B] text-[#E7E7E9]">
        <Loader2 className="h-6 w-6 animate-spin text-[#6B6B70]" />
      </div>
    )
  }

  if (errorMessage || !project) {
    return (
      <main className="min-h-screen bg-[#0A0A0B] px-6 py-16 text-[#E7E7E9]">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-red-400">
          <p className="text-sm">{errorMessage || "This public project could not be loaded."}</p>
          <Link href="/discover" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#9B9B9F] hover:text-[#E7E7E9] transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to discover
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-[#E7E7E9]">
      <div className="grain-overlay" />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-8 sm:py-12">
        <Link
          href="/discover"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#9B9B9F] hover:text-[#E7E7E9] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to discover
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
          {/* Preview */}
          <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0E0E10]">
            <div className="relative aspect-video bg-black">
              {project.htmlContent?.trim() ? (
                <PublicProjectPreview
                  htmlContent={project.htmlContent}
                  title={`${project.name} preview`}
                  className="absolute inset-0 overflow-hidden bg-black"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-6xl opacity-30">
                  {project.emoji || "🎨"}
                </div>
              )}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="flex flex-col gap-6 rounded-xl border border-white/[0.06] bg-[#0E0E10] p-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#E7E7E9] leading-tight">{project.name}</h1>

              <div className="mt-4 flex items-center gap-2">
                <Avatar name={project.ownerName} image={project.ownerImage} />
                <span className="text-sm text-[#9B9B9F]">{project.ownerName}</span>
              </div>
            </div>

            <p className="text-xs text-[#6B6B70] leading-relaxed">
              This page is read-only and updates public engagement metrics without exposing the editor workspace.
            </p>

            {/* Stats */}
            <div className="flex items-center gap-5 text-sm">
              <span className="inline-flex items-center gap-1.5 text-[#9B9B9F]">
                <Eye className="h-4 w-4 text-[#6B6B70]" />
                {formatCount(project.views)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#9B9B9F]">
                <Heart className="h-4 w-4 text-[#6B6B70]" />
                {formatCount(project.likes)}
              </span>
            </div>

            {/* Like button */}
            <button
              type="button"
              onClick={toggleLike}
              disabled={isLikePending}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50",
                project.viewerHasLiked
                  ? "bg-white/[0.08] text-[#E7E7E9] border border-white/[0.08] hover:bg-white/[0.12]"
                  : "bg-white/[0.04] text-[#9B9B9F] border border-white/[0.06] hover:bg-white/[0.08] hover:text-[#E7E7E9]",
              )}
            >
              {isLikePending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Heart className={cn("h-4 w-4", project.viewerHasLiked && "fill-current")} />
              )}
              {project.viewerHasLiked ? "Unlike" : session?.user?.id ? "Like project" : "Sign in to like"}
            </button>

            {errorMessage && (
              <p className="text-xs text-red-400">{errorMessage}</p>
            )}

            {/* Meta */}
            <div className="mt-auto space-y-2 border-t border-white/[0.04] pt-5 text-xs text-[#6B6B70]">
              <div className="flex justify-between">
                <span>Created</span>
                <span className="text-[#9B9B9F]">{new Date(project.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <div className="flex justify-between">
                <span>Updated</span>
                <span className="text-[#9B9B9F]">{new Date(project.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
