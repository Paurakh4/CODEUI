"use client"

import * as React from "react"
import Link from "next/link"
import { Search, Loader2, Eye, Heart, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PublicProjectPreview } from "@/components/discover/public-project-preview"
import { DISCOVER_SORT_OPTIONS, type DiscoverSortOption } from "@/lib/discover-projects"

interface DiscoverProject {
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

interface DiscoverResponse {
  projects: DiscoverProject[]
  pagination: {
    page: number
    pageSize: number
    totalProjects: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
}

const SORT_LABELS: Record<DiscoverSortOption, string> = {
  newest: "Newest",
  updated: "Recently updated",
  "most-viewed": "Most viewed",
  "most-liked": "Most liked",
}

export function DiscoverPageClient() {
  const [projects, setProjects] = React.useState<DiscoverProject[]>([])
  const [search, setSearch] = React.useState("")
  const [sort, setSort] = React.useState<DiscoverSortOption>("newest")
  const [page, setPage] = React.useState(1)
  const [pagination, setPagination] = React.useState<DiscoverResponse["pagination"] | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({
      page: String(page),
      sort,
      ...(search.trim() ? { search: search.trim() } : {}),
    })

    const loadProjects = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetch(`/api/discover/projects?${query.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error("Failed to load public projects")
        }

        const data = (await response.json()) as DiscoverResponse
        setProjects(data.projects)
        setPagination(data.pagination)
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load public projects")
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadProjects()

    return () => controller.abort()
  }, [page, search, sort])

  const totalProjects = pagination?.totalProjects ?? 0

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-zinc-950 dark:bg-black dark:text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 border-b border-zinc-200 pb-8 dark:border-white/10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              Public Discover
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Browse public CodeUI projects</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Explore public builds from the community, review live previews, and open any project in a dedicated read-only detail view.
            </p>
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
            Open your dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search public projects"
              className="h-11 w-full rounded-md border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none ring-0 focus:border-zinc-950 dark:border-white/10 dark:bg-[#111111] dark:focus:border-[#faff69]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {DISCOVER_SORT_OPTIONS.map((sortOption) => (
              <Button
                key={sortOption}
                type="button"
                variant={sort === sortOption ? "default" : "outline"}
                onClick={() => {
                  setSort(sortOption)
                  setPage(1)
                }}
                className={sort === sortOption ? "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-[#faff69] dark:text-black" : ""}
              >
                {SORT_LABELS[sortOption]}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          {totalProjects} public project{totalProjects === 1 ? "" : "s"}
        </div>

        {isLoading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : errorMessage ? (
          <div className="mt-8 rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
            {errorMessage}
          </div>
        ) : projects.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/discover/${project.id}`}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 transition-colors hover:border-zinc-950 dark:border-white/10 dark:bg-[#0f0f10] dark:hover:border-[#faff69]/60"
              >
                <div className="relative aspect-video bg-black">
                  {project.htmlContent?.trim() ? (
                    <PublicProjectPreview
                      htmlContent={project.htmlContent}
                      title={`${project.name} preview`}
                      className="absolute inset-0 overflow-hidden bg-black"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-5xl">
                      {project.emoji || "🎨"}
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">{project.name}</h2>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">by {project.ownerName}</p>
                    </div>
                    {project.viewerHasLiked && (
                      <span className="rounded-full bg-[#faff69]/15 px-2 py-1 text-[11px] font-semibold text-[#a6ad34] dark:text-[#faff69]">
                        Liked
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1.5"><Eye className="h-4 w-4" /> {project.views}</span>
                    <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4" /> {project.likes}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-lg border border-zinc-200 p-12 text-center dark:border-white/10">
            <h2 className="text-xl font-bold">No public projects found</h2>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Try a different search term or check back after more projects are shared publicly.
            </p>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-10 flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-white/10">
            <Button
              type="button"
              variant="outline"
              disabled={!pagination.hasPreviousPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
