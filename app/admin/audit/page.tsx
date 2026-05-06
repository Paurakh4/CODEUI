import Link from "next/link"
import { Database, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/admin/stat-card"
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
  ADMIN_AUDIT_PAGE_SIZES,
  parseAdminAuditQuery,
} from "@/lib/admin/audit-filters"
import { getAdminAuditPageData } from "@/lib/admin/audit-log"

interface AuditPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatRoleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function buildAuditHref(
  filters: ReturnType<typeof parseAdminAuditQuery>,
  page: number,
) {
  const params = new URLSearchParams()
  if (filters.search) params.set("q", filters.search)
  if (filters.targetType !== "all") params.set("targetType", filters.targetType)
  if (filters.pageSize !== 25) params.set("pageSize", String(filters.pageSize))
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/admin/audit?${query}` : "/admin/audit"
}

export default async function AdminAuditPage({ searchParams }: AuditPageProps) {
  await requireAdminPage("admin:view-audit")
  const filters = parseAdminAuditQuery(await searchParams)
  const data = await getAdminAuditPageData(filters)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin-side change history across customers, projects, billing, and model policy.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Filtered Events"
          value={formatNumber(data.summary.filteredEvents)}
          icon={Database}
        />
        <StatCard title="User Targets" value={formatNumber(data.summary.userTargets)} />
        <StatCard
          title="Project Targets"
          value={formatNumber(data.summary.projectTargets)}
        />
        <StatCard
          title="Model Policy"
          value={formatNumber(data.summary.modelPolicyTargets)}
        />
      </div>

      <section className="rounded-lg border">
        <div className="border-b px-5 py-4">
          <form method="GET" className="grid gap-4 xl:grid-cols-[1.5fr_repeat(2,auto)] xl:items-end">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  name="q"
                  defaultValue={data.filters.search}
                  placeholder="Search action, actor email, target, or reason"
                  className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Target Type</label>
              <select
                name="targetType"
                defaultValue={data.filters.targetType}
                className="h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All targets</option>
                <option value="user">User</option>
                <option value="project">Project</option>
                <option value="model-policy">Model policy</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Page Size</label>
              <select
                name="pageSize"
                defaultValue={String(data.filters.pageSize)}
                className="h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ADMIN_AUDIT_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Apply
              </button>
              <Link
                href="/admin/audit"
                className="inline-flex h-9 items-center justify-center rounded-lg border px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                Reset
              </Link>
            </div>
          </form>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    No audit events matched the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="py-3">
                      <div>
                        <p className="text-sm font-medium">{entry.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.permission || "No permission tag"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{entry.actorEmail}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRoleLabel(entry.actorRole)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="outline" className="text-[10px]">
                          {entry.targetType}
                        </Badge>
                        {entry.targetId ? (
                          <p className="mt-1 max-w-[200px] truncate text-xs text-muted-foreground">
                            {entry.targetId}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                      {entry.reason || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            Page {data.pagination.page} of {data.pagination.totalPages}
          </div>
          <div className="flex gap-2">
            <Link
              href={buildAuditHref(data.filters, Math.max(1, data.pagination.page - 1))}
              aria-disabled={!data.pagination.hasPreviousPage}
              className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors ${
                data.pagination.hasPreviousPage
                  ? "text-foreground hover:bg-accent"
                  : "pointer-events-none text-muted-foreground/50"
              }`}
            >
              Previous
            </Link>
            <Link
              href={buildAuditHref(data.filters, data.pagination.page + 1)}
              aria-disabled={!data.pagination.hasNextPage}
              className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors ${
                data.pagination.hasNextPage
                  ? "text-foreground hover:bg-accent"
                  : "pointer-events-none text-muted-foreground/50"
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
