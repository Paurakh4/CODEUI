"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { ArrowLeft, Eye, Heart, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  createdAt: string
  updatedAt: string
  viewerHasLiked: boolean
}

interface PublicProjectDetailClientProps {
  id: string
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
    const controller = new AbortController()

    const loadProject = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetch(`/api/discover/projects/${id}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(response.status === 404 ? "This public project could not be found." : "Failed to load project")
        }

        const data = (await response.json()) as { project: PublicProject }
        setProject(data.project)
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load project")
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadProject()

    return () => controller.abort()
  }, [id, session?.user?.id])

  React.useEffect(() => {
    if (!project || hasTrackedViewRef.current) {
      return
    }

    hasTrackedViewRef.current = true

    void fetch(`/api/discover/projects/${id}/view`, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to track view")
        }

        const data = (await response.json()) as { views: number }
        setProject((current) => (current ? { ...current, views: data.views } : current))
      })
      .catch((error) => {
        console.error(error)
      })
  }, [id, project])

  const toggleLike = async () => {
    if (!session?.user?.id) {
      showSignIn()
      return
    }

    setIsLikePending(true)

    try {
      const response = await fetch(`/api/discover/projects/${id}/like`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to update like")
      }

      const data = (await response.json()) as { liked: boolean; likes: number }
      setProject((current) =>
        current
          ? {
              ...current,
              likes: data.likes,
              viewerHasLiked: data.liked,
            }
          : current,
      )
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update like")
    } finally {
      setIsLikePending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-zinc-950 dark:bg-black dark:text-white">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (errorMessage || !project) {
    return (
      <main className="min-h-screen bg-white px-6 py-16 text-zinc-950 dark:bg-black dark:text-white">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-500/20 bg-red-500/10 p-8 text-red-300">
          <p className="text-sm">{errorMessage || "This public project could not be loaded."}</p>
          <Link href="/discover" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to discover
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-zinc-950 dark:bg-black dark:text-white">
      <div className="mx-auto max-w-6xl">
        <Link href="/discover" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to discover
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-[#101011]">
            <div className="aspect-[16/10] bg-black">
              {project.htmlContent?.trim() ? (
                <PublicProjectPreview
                  htmlContent={project.htmlContent}
                  title={`${project.name} preview`}
                  className="h-full overflow-hidden bg-black"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-7xl">{project.emoji || "🎨"}</div>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-zinc-200 p-6 dark:border-white/10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Public project</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">{project.name}</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Shared by {project.ownerName}. This page is read-only and updates public engagement metrics without exposing the editor workspace.</p>

            <div className="mt-6 flex flex-wrap gap-4 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5"><Eye className="h-4 w-4" /> {project.views} views</span>
              <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4" /> {project.likes} likes</span>
            </div>

            <div className="mt-8">
              <Button
                type="button"
                onClick={toggleLike}
                disabled={isLikePending}
                className={project.viewerHasLiked ? "bg-[#faff69] text-black hover:bg-[#e1e85b]" : "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"}
              >
                {isLikePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={project.viewerHasLiked ? "fill-current" : ""} />}
                {project.viewerHasLiked ? "Unlike project" : session?.user?.id ? "Like project" : "Sign in to like"}
              </Button>
            </div>

            {errorMessage && (
              <p className="mt-4 text-sm text-red-400">{errorMessage}</p>
            )}

            <div className="mt-8 space-y-3 border-t border-zinc-200 pt-6 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
              <p>Created: {new Date(project.createdAt).toLocaleDateString()}</p>
              <p>Updated: {new Date(project.updatedAt).toLocaleDateString()}</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
