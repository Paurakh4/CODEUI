import Link from "next/link"
import { ArrowRight, FolderKanban, FolderKanban as FolderIcon } from "lucide-react"
import { Suspense } from "react"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/admin/empty-state"
import { StatCard } from "@/components/admin/stat-card"
import { AutoSubmitSelect } from "@/components/admin/auto-submit-select"
import { LiveSearchInput } from "@/components/admin/live-search-input"
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
  if (filters.search) params.set("q", filters.search)
  if (filters.visibility !== "all") params.set("visibility", filters.visibility)
  if (filters.ownerRole !== "all") params.set("ownerRole", filters.ownerRole)
  if (filters.ownerStatus !== "all") params.set("ownerStatus", filters.ownerStatus)
  if (filters.pageSize !== 25) params.set("pageSize", String(filters.pageSize))
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/admin/projects?${query}` : "/admin/projects"
}

export default async function AdminProjectsPage({ searchParams }: ProjectsPageProps) {
  await requireAdminPage("admin:view-projects")
  const filters = parseAdminProjectsQuery(await searchParams)
  const result = await getAdminProjectsPage(filters)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#E7E7E9]">Projects</h1>
        <p className="mt-1 text-sm text-[#9B9B9F]">
          Cross-user project oversight and cleanup.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Filtered" value={formatNumber(result.summary.filteredProjects)} icon={FolderKanban} />
        <StatCard
          title="Suspended Owners"
          value={formatNumber(result.summary.suspendedOwnerProjects)}
        />
        <StatCard title="Private" value={formatNumber(result.summary.privateProjects)} />
        <StatCard title="Public" value={formatNumber(result.summary.publicProjects)} />
      </div>

      <section className="rounded-lg border border-white/[0.04]">
        <div className="border-b border-white/[0.04] px-5 py-4">
          <form method="GET" className="flex flex-wrap items-center gap-3">
            <Suspense fallback={<div className="h-9 w-full max-w-sm rounded-lg border border-white/[0.04] bg-[#0E0E10]" />}>
              <LiveSearchInput
                paramName="q"
                placeholder="Search project name or owner"
                defaultValue={result.filters.search}
                basePath="/admin/projects"
                preserveParams={["visibility", "ownerRole", "ownerStatus", "pageSize"]}
                className="max-w-sm flex-1"
              />
            </Suspense>
            <div className="flex items-center gap-2">
              <AutoSubmitSelect
                name="visibility"
                defaultValue={result.filters.visibility}
                className="h-9 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                <option value="all">All</option>
                <option value="private">Private</option>
                <option value="public">Public</option>
              </AutoSubmitSelect>
              <AutoSubmitSelect
                name="ownerRole"
                defaultValue={result.filters.ownerRole}
                className="h-9 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                <option value="all">All roles</option>
                <option value="user">User</option>
                <option value="support">Support</option>
                <option value="finance">Finance</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </AutoSubmitSelect>
              <AutoSubmitSelect
                name="ownerStatus"
                defaultValue={result.filters.ownerStatus}
                className="h-9 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </AutoSubmitSelect>
              <AutoSubmitSelect
                name="pageSize"
                defaultValue={String(result.filters.pageSize)}
                className="h-9 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                {ADMIN_PROJECT_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </AutoSubmitSelect>
            </div>
          </form>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12">
                    <EmptyState icon={FolderIcon} message="No projects matched the current filters." />
                  </TableCell>
                </TableRow>
              ) : (
                result.projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#E7E7E9]">
                          {project.emoji || "🎨"} {project.name}
                        </p>
                        <p className="text-xs text-[#9B9B9F]">
                          {formatNumber(project.messageCount)} messages ·{" "}
                          {formatNumber(project.checkpointCount)} checkpoints ·{" "}
                          {formatNumber(project.mediaCount)} assets
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#E7E7E9]">
                          {project.owner.name}
                        </p>
                        <p className="truncate text-xs text-[#9B9B9F]">
                          {project.owner.email}
                        </p>
                        <p className="text-xs text-[#9B9B9F]">
                          {formatRoleLabel(project.owner.role)} ·{" "}
                          {formatSubscriptionTierLabel(project.owner.tier)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={project.isPrivate ? "secondary" : "outline"}
                        className="text-[10px]"
                      >
                        {project.isPrivate ? "Private" : "Public"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {project.views} views
                        </Badge>
                        {project.owner.accountStatus === "suspended" ? (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">
                            Owner suspended
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[#9B9B9F]">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/projects/${project.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-[#E7E7E9] transition-colors hover:text-white"
                      >
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.04] px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-[#9B9B9F]">
            <FolderKanban className="h-3.5 w-3.5" />
            Page {result.pagination.page} of {result.pagination.totalPages}
          </div>
          <div className="flex gap-2">
            <Link
              href={buildProjectsHref(result.filters, Math.max(1, result.pagination.page - 1))}
              aria-disabled={!result.pagination.hasPreviousPage}
              className={`inline-flex h-8 items-center justify-center rounded-md border border-white/[0.04] px-3 text-xs font-medium transition-colors ${result.pagination.hasPreviousPage
                ? "text-[#E7E7E9] hover:bg-[#1B1B1F]"
                : "pointer-events-none text-[#9B9B9F]/50"
                }`}
            >
              Previous
            </Link>
            <Link
              href={buildProjectsHref(result.filters, result.pagination.page + 1)}
              aria-disabled={!result.pagination.hasNextPage}
              className={`inline-flex h-8 items-center justify-center rounded-md border border-white/[0.04] px-3 text-xs font-medium transition-colors ${result.pagination.hasNextPage
                ? "text-[#E7E7E9] hover:bg-[#1B1B1F]"
                : "pointer-events-none text-[#9B9B9F]/50"
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
