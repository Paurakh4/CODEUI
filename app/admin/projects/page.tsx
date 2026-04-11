import Link from "next/link"
import { ArrowRight, FolderKanban, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requireAdminPage } from "@/lib/admin/guards"
import {
  ADMIN_PROJECT_PAGE_SIZES,
  parseAdminProjectsQuery,
} from "@/lib/admin/project-filters"
import { getAdminProjectsPage, formatSubscriptionTierLabel } from "@/lib/admin/projects"

interface ProjectsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatRoleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function buildProjectsHref(
  filters: ReturnType<typeof parseAdminProjectsQuery>,
  page: number,
) {
  const params = new URLSearchParams()

  if (filters.search) {
    params.set("q", filters.search)
  }

  if (filters.visibility !== "all") {
    params.set("visibility", filters.visibility)
  }

  if (filters.ownerRole !== "all") {
    params.set("ownerRole", filters.ownerRole)
  }

  if (filters.ownerStatus !== "all") {
    params.set("ownerStatus", filters.ownerStatus)
  }

  if (filters.pageSize !== 25) {
    params.set("pageSize", String(filters.pageSize))
  }

  if (page > 1) {
    params.set("page", String(page))
  }

  const query = params.toString()
  return query ? `/admin/projects?${query}` : "/admin/projects"
}

export default async function AdminProjectsPage({ searchParams }: ProjectsPageProps) {
  await requireAdminPage("admin:view-projects")

  const filters = parseAdminProjectsQuery(await searchParams)
  const result = await getAdminProjectsPage(filters)

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(10,166,255,0.14),_transparent_38%),linear-gradient(180deg,_rgba(15,17,19,0.98),_rgba(9,10,11,0.98))] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Projects Module</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Cross-user project oversight and cleanup.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#C3C7CB] sm:text-base">
              Review workspace ownership, privacy, embedded conversation volume, checkpoints,
              and media footprint before opening a project detail view for moderation changes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Filtered Projects</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatNumber(result.summary.filteredProjects)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Suspended Owners</p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatNumber(result.summary.suspendedOwnerProjects)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Private</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(result.summary.privateProjects)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Public</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(result.summary.publicProjects)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Page Size</p>
          <p className="mt-3 text-3xl font-semibold text-white">{result.pagination.pageSize}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Current Page</p>
          <p className="mt-3 text-3xl font-semibold text-white">{result.pagination.page}</p>
        </article>
      </section>

      <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
        <form method="GET" className="grid gap-4 xl:grid-cols-[1.8fr_repeat(4,0.8fr)_auto] xl:items-end">
          <label className="space-y-2 text-sm text-[#D6D8DA] xl:col-span-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A6A6A6]" />
              <input
                type="search"
                name="q"
                defaultValue={result.filters.search}
                placeholder="Search project name or owner"
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] pl-10 pr-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]"
              />
            </div>
          </label>

          <label className="space-y-2 text-sm text-[#D6D8DA]">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Visibility</span>
            <select
              name="visibility"
              defaultValue={result.filters.visibility}
              className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]"
            >
              <option value="all">All</option>
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-[#D6D8DA]">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Owner Role</span>
            <select
              name="ownerRole"
              defaultValue={result.filters.ownerRole}
              className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]"
            >
              <option value="all">All roles</option>
              <option value="user">User</option>
              <option value="support">Support</option>
              <option value="finance">Finance</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-[#D6D8DA]">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Owner Status</span>
            <select
              name="ownerStatus"
              defaultValue={result.filters.ownerStatus}
              className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-[#D6D8DA]">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Page Size</span>
            <select
              name="pageSize"
              defaultValue={String(result.filters.pageSize)}
              className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]"
            >
              {ADMIN_PROJECT_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-3 xl:justify-end">
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0AA6FF] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0AA6FF]/90"
            >
              Apply
            </button>
            <Link
              href="/admin/projects"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-[#D6D8DA] transition-colors hover:bg-white/[0.03]"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Projects</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Search results</h2>
          </div>
          <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">
            {formatNumber(result.pagination.totalProjects)} matched
          </Badge>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/8">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-white/8 hover:bg-transparent">
                <TableHead className="px-4 text-[#A6A6A6]">Project</TableHead>
                <TableHead className="text-[#A6A6A6]">Owner</TableHead>
                <TableHead className="text-[#A6A6A6]">Visibility</TableHead>
                <TableHead className="text-[#A6A6A6]">State</TableHead>
                <TableHead className="text-[#A6A6A6]">Updated</TableHead>
                <TableHead className="text-right text-[#A6A6A6]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.projects.length === 0 ? (
                <TableRow className="border-white/8">
                  <TableCell colSpan={6} className="px-4 py-12 text-center text-sm text-[#A6A6A6]">
                    No projects matched the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                result.projects.map((project) => (
                  <TableRow key={project.id} className="border-white/8 hover:bg-white/[0.02]">
                    <TableCell className="px-4 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {project.emoji || "🎨"} {project.name}
                        </p>
                        <p className="mt-1 text-xs text-[#A6A6A6]">
                          {formatNumber(project.messageCount)} messages · {formatNumber(project.checkpointCount)} checkpoints · {formatNumber(project.mediaCount)} assets
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{project.owner.name}</p>
                        <p className="mt-1 truncate text-xs text-[#A6A6A6]">{project.owner.email}</p>
                        <p className="mt-1 text-xs text-[#A6A6A6]">
                          {formatRoleLabel(project.owner.role)} · {formatSubscriptionTierLabel(project.owner.tier)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={project.isPrivate ? "border-white/10 text-[#D6D8DA]" : "border-[#0AA6FF]/30 text-[#7FD0FF]"}
                      >
                        {project.isPrivate ? "Private" : "Public"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">
                          {project.views} views
                        </Badge>
                        {project.owner.accountStatus === "suspended" ? (
                          <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/10">
                            Owner suspended
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-[#A6A6A6]">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/projects/${project.id}`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-[#7FD0FF] transition-colors hover:text-white"
                      >
                        Open
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-[#A6A6A6]">
            <FolderKanban className="h-4 w-4" />
            Page {result.pagination.page} of {result.pagination.totalPages}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={buildProjectsHref(result.filters, Math.max(1, result.pagination.page - 1))}
              aria-disabled={!result.pagination.hasPreviousPage}
              className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors ${
                result.pagination.hasPreviousPage
                  ? "border border-white/10 text-[#D6D8DA] hover:bg-white/[0.03]"
                  : "cursor-not-allowed border border-white/5 text-[#6D7175]"
              }`}
            >
              Previous
            </Link>
            <Link
              href={buildProjectsHref(result.filters, result.pagination.page + 1)}
              aria-disabled={!result.pagination.hasNextPage}
              className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors ${
                result.pagination.hasNextPage
                  ? "border border-white/10 text-[#D6D8DA] hover:bg-white/[0.03]"
                  : "cursor-not-allowed border border-white/5 text-[#6D7175]"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}