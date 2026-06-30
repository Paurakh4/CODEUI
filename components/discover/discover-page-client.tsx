"use client"

import * as React from "react"
import Link from "next/link"
import { Search, Loader2, Eye, Heart, ArrowUpRight, Sparkles, TrendingUp, Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import { PublicProjectPreview } from "@/components/discover/public-project-preview"
import { type DiscoverSortOption } from "@/lib/discover-projects"

interface DiscoverProject {
  id: string
  name: string
  emoji?: string
  htmlContent?: string
  views: number
  likes: number
  ownerName: string
  ownerImage?: string | null
  featured?: boolean
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

const TAB_OPTIONS = [
  { value: "newest" as const, label: "Newest", icon: Sparkles },
  { value: "most-liked" as const, label: "Trending", icon: Flame },
  { value: "most-viewed" as const, label: "Popular", icon: TrendingUp },
  { value: "updated" as const, label: "Updated", icon: ArrowUpRight },
]

const CATEGORY_CHIPS = ["All", "Landing", "Dashboard", "Portfolio", "SaaS", "Marketing", "Components"]

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatRelativeDate(date: string): string {
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay === 1) return "1d ago"
  if (diffDay < 30) return `${diffDay}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

function deriveTags(name: string): string[] {
  const lower = name.toLowerCase()
  const tags: string[] = []
  const tagMap: Record<string, string> = {
    dashboard: "Dashboard",
    landing: "Landing",
    portfolio: "Portfolio",
    saas: "SaaS",
    marketing: "Marketing",
    ecommerce: "E-commerce",
    "e-commerce": "E-commerce",
    component: "Components",
    app: "App",
    admin: "Admin",
    blog: "Blog",
    store: "Store",
    agency: "Agency",
    startup: "Startup",
    product: "Product",
  }
  for (const [keyword, tag] of Object.entries(tagMap)) {
    if (lower.includes(keyword) && !tags.includes(tag)) {
      tags.push(tag)
    }
  }
  if (tags.length === 0) tags.push("Project")
  return tags.slice(0, 3)
}

function Avatar({ name, image, size = "sm" }: { name: string; image?: string | null; size?: "sm" | "md" }) {
  const dimensions = size === "md" ? "h-7 w-7 text-[10px]" : "h-5 w-5 text-[9px]"
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className={cn("rounded-full object-cover", dimensions)}
      />
    )
  }
  return (
    <div className={cn(
      "rounded-full bg-gradient-to-br from-[#1B1B1F] to-[#0E0E10] flex items-center justify-center font-medium text-[#9B9B9F] border border-white/[0.06]",
      dimensions,
    )}>
      {getInitials(name)}
    </div>
  )
}

export function DiscoverPageClient() {
  const [projects, setProjects] = React.useState<DiscoverProject[]>([])
  const [search, setSearch] = React.useState("")
  const [sort, setSort] = React.useState<DiscoverSortOption>("newest")
  const [page, setPage] = React.useState(1)
  const [category, setCategory] = React.useState("All")
  const [pagination, setPagination] = React.useState<DiscoverResponse["pagination"] | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    let isDisposed = false
    const query = new URLSearchParams({
      page: String(page),
      sort,
      ...(search.trim() ? { search: search.trim() } : {}),
    })

    const loadProjects = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetch(`/api/discover/projects?${query.toString()}`)

        if (isDisposed) return

        if (!response.ok) throw new Error("Failed to load public projects")

        const data = (await response.json()) as DiscoverResponse

        if (isDisposed) return

        setProjects(data.projects)
        setPagination(data.pagination)
      } catch (error) {
        if (!isDisposed) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load public projects")
        }
      } finally {
        if (!isDisposed) {
          setIsLoading(false)
        }
      }
    }

    void loadProjects()

    return () => {
      isDisposed = true
    }
  }, [page, search, sort])

  const featuredProject = React.useMemo(() => {
    if (isLoading || !projects.length) return null
    return projects.find((p) => p.featured) || projects.reduce((best, p) => (p.likes > best.likes ? p : best), projects[0])
  }, [projects, isLoading])

  const gridProjects = React.useMemo(() => {
    if (!projects.length) return []
    let result = projects
    if (featuredProject && category === "All" && !search.trim() && page === 1) {
      result = projects.filter((p) => p.id !== featuredProject.id)
    }
    if (category !== "All") {
      result = result.filter((p) =>
        deriveTags(p.name).some((tag) => tag.toLowerCase() === category.toLowerCase()),
      )
    }
    return result
  }, [projects, featuredProject, category, search, page])

  const showFeatured = featuredProject && category === "All" && !search.trim() && page === 1

  return (
    <main className="min-h-screen bg-[#0A0A0B] text-[#E7E7E9]">
      <div className="grain-overlay" />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#E7E7E9]">
            Discover
          </h1>
          <p className="text-sm text-[#9B9B9F]">
            Explore what the community is building.
          </p>
        </div>

        {/* Toolbar — search + tabs in one unified bar */}
        <div className="mt-6 sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-white/[0.04]">
          <div className="flex flex-col gap-3">
            {/* Search row */}
            <div className="relative w-full md:max-w-[50%]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B70]" />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search projects, creators, or tags..."
                className="h-10 w-full rounded-lg border border-white/[0.06] bg-[#0E0E10] pl-10 pr-4 text-sm text-[#E7E7E9] placeholder:text-[#6B6B70] outline-none focus-visible:border-white/[0.12] transition-colors"
              />
            </div>

            {/* Tabs + categories row */}
            <div className="flex flex-wrap items-center gap-5">
              {/* Sort tabs */}
              <div className="flex items-center gap-1 rounded-lg bg-[#0E0E10] border border-white/[0.04] p-0.5">
                {TAB_OPTIONS.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.value}
                      onClick={() => {
                        setSort(tab.value)
                        setPage(1)
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        sort === tab.value
                          ? "bg-white/[0.08] text-[#E7E7E9]"
                          : "text-[#6B6B70] hover:text-[#9B9B9F]",
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              {/* Category chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {CATEGORY_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => {
                      setCategory(chip)
                      setPage(1)
                    }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                      category === chip
                        ? "bg-white/[0.08] text-[#E7E7E9] border border-white/[0.08]"
                        : "text-[#6B6B70]/60 hover:text-[#9B9B9F] border border-transparent hover:border-white/[0.04]",
                    )}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Result count */}
        <div className="mt-6 text-xs text-[#6B6B70]">
          {isLoading ? "Loading..." : `Showing ${showFeatured ? gridProjects.length + 1 : gridProjects.length} project${(showFeatured ? gridProjects.length + 1 : gridProjects.length) === 1 ? "" : "s"}`}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="mt-8 flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#6B6B70]" />
          </div>
        ) : errorMessage ? (
          <div className="mt-8 rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-400">
            {errorMessage}
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0E0E10] border border-white/[0.04] mb-4">
              <Search className="h-5 w-5 text-[#6B6B70]" />
            </div>
            <h2 className="text-sm font-semibold text-[#E7E7E9]">No projects found</h2>
            <p className="mt-1.5 text-xs text-[#6B6B70]">
              Try a different search term or check back after more projects are shared publicly.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {/* Featured hero */}
            {showFeatured && featuredProject && (
              <FeaturedcCard project={featuredProject} />
            )}

            {/* Grid */}
            {gridProjects.length > 0 && (
              <>
                {showFeatured && (
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-xs font-medium text-[#9B9B9F]">
                      Explore more
                    </h2>
                    <div className="h-px flex-1 bg-white/[0.04]" />
                  </div>
                )}
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {gridProjects.map((project, i) => (
                    <DiscoverCard
                      key={project.id}
                      project={project}
                      index={i}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-between border-t border-white/[0.04] pt-6">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={!pagination.hasPreviousPage}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[#0E0E10] px-4 py-2 text-xs font-medium text-[#9B9B9F] hover:text-[#E7E7E9] hover:border-white/[0.10] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-[#6B6B70]">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={!pagination.hasNextPage}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-[#0E0E10] px-4 py-2 text-xs font-medium text-[#9B9B9F] hover:text-[#E7E7E9] hover:border-white/[0.10] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

function deriveDescription(project: DiscoverProject): string {
  const tags = deriveTags(project.name)
  const tagStr = tags.slice(0, 2).join(" / ")
  return `A ${tagStr.toLowerCase()} project by ${project.ownerName}.`
}

function FeaturedcCard({ project }: { project: DiscoverProject }) {
  const tags = deriveTags(project.name)

  return (
    <Link
      href={`/discover/${project.id}`}
      className="group block overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E0E10] transition-colors duration-[160ms] ease-[cubic-bezier(.2,.8,.2,1)] hover:border-white/[0.12]"
    >
      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        {/* Preview */}
        <div className="relative aspect-video lg:aspect-[16/10] bg-black overflow-hidden">
          {project.htmlContent?.trim() ? (
            <PublicProjectPreview
              htmlContent={project.htmlContent}
              title={`${project.name} preview`}
              className="absolute inset-0 overflow-hidden bg-black"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1B1B1F] via-[#141416] to-[#0E0E10]">
              <span className="text-6xl opacity-30">{project.emoji || "🎨"}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none transition-opacity duration-[160ms] group-hover:from-black/10" />
          {/* Featured badge — quiet */}
          <div className="absolute top-3 left-3">
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#9B9B9F]/70">Featured</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col p-6 lg:p-7">
          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/[0.04] border border-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[#9B9B9F]"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-[#E7E7E9] leading-tight">{project.name}</h2>

          {/* Creator */}
          <div className="mt-3 flex items-center gap-2 group/creator">
            <div className="transition-opacity group-hover/creator:opacity-80">
              <Avatar name={project.ownerName} image={project.ownerImage} size="md" />
            </div>
            <span className="text-sm text-[#9B9B9F] group-hover/creator:text-[#E7E7E9] transition-colors">{project.ownerName}</span>
          </div>

          {/* Description */}
          <p className="mt-4 text-xs leading-relaxed text-[#6B6B70]">
            {deriveDescription(project)}
          </p>

          {/* Stats */}
          <div className="mt-5 flex items-center gap-4 text-xs text-[#6B6B70]">
            <span className="inline-flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5" />
              {formatCount(project.likes)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              {formatCount(project.views)}
            </span>
            <span>Published {formatRelativeDate(project.createdAt)}</span>
          </div>

          {/* Separator + CTA */}
          <div className="mt-auto pt-6">
            <div className="h-px bg-white/[0.04] mb-4" />
            <div className="flex items-center gap-1.5 text-sm font-medium text-[#9B9B9F] group-hover:text-[#E7E7E9] transition-colors">
              Open project
              <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

function DiscoverCard({ project, index }: { project: DiscoverProject; index: number }) {
  const tags = deriveTags(project.name)
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <Link
      href={`/discover/${project.id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group block animate-in fade-in slide-in-from-bottom-1 duration-300"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms`, animationFillMode: "backwards" }}
    >
      <div className="relative rounded-xl border border-white/[0.05] bg-[#0E0E10] overflow-hidden transition-colors duration-[140ms] ease-[cubic-bezier(.2,.8,.2,1)] hover:border-white/[0.10]">
        {/* Preview — 16:9 */}
        <div className="relative aspect-video bg-black overflow-hidden">
          {project.htmlContent?.trim() ? (
            <PublicProjectPreview
              htmlContent={project.htmlContent}
              title={`${project.name} preview`}
              className="absolute inset-0 overflow-hidden bg-black"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1B1B1F] via-[#141416] to-[#0E0E10]">
              <span className="text-4xl opacity-30">{project.emoji || "🎨"}</span>
            </div>
          )}

          {/* Hover brightness */}
          <div
            className={cn(
              "absolute inset-0 bg-black/30 transition-opacity duration-[160ms]",
              isHovered ? "opacity-100" : "opacity-0",
            )}
          />

          {/* Open CTA on hover */}
          <div
            className={cn(
              "absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-white/[0.08] backdrop-blur-sm border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-[#E7E7E9] transition-all duration-[160ms]",
              isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1",
            )}
          >
            Open
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>

          {/* Featured badge — quiet */}
          {project.featured && (
            <div className="absolute top-2.5 left-2.5">
              <span className="text-[8px] font-medium uppercase tracking-[0.12em] text-[#9B9B9F]/60">Trending</span>
            </div>
          )}

          {/* Liked badge */}
          {project.viewerHasLiked && (
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-white/[0.08] backdrop-blur-sm border border-white/[0.08] px-2 py-0.5">
              <Heart className="h-2.5 w-2.5 fill-current text-[#E7E7E9]" />
            </div>
          )}
        </div>

        {/* Info section */}
        <div className="p-3.5">
          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/[0.03] border border-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-[#6B6B70]"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-[#E7E7E9] line-clamp-1 leading-tight">
            {project.name}
          </h3>

          {/* Creator */}
          <div className="mt-2 flex items-center gap-1.5 group/creator">
            <div className="transition-opacity group-hover/creator:opacity-80">
              <Avatar name={project.ownerName} image={project.ownerImage} />
            </div>
            <span className="text-[11px] text-[#9B9B9F] group-hover/creator:text-[#E7E7E9] truncate transition-colors">{project.ownerName}</span>
          </div>

          {/* Stats */}
          <div className="mt-3 flex items-center gap-3 text-[10px] text-[#6B6B70]">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {formatCount(project.likes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatCount(project.views)}
            </span>
            <span className="ml-auto text-[#6B6B70]/70">{formatRelativeDate(project.updatedAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
