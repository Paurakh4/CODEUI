import Link from "next/link"
import { Database, ShieldCheck } from "lucide-react"
import { Suspense } from "react"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/admin/empty-state"
import { AutoSubmitSelect } from "@/components/admin/auto-submit-select"
import { LiveSearchInput } from "@/components/admin/live-search-input"
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

function actionColorClass(action: string) {
  const lower = action.toLowerCase()
  if (lower.includes("created")) return "text-emerald-400"
  if (lower.includes("updated") || lower.includes("resync")) return "text-blue-400"
  if (lower.includes("deleted")) return "text-red-400"
  if (lower.includes("suspended")) return "text-amber-400"
  if (lower.includes("activated")) return "text-emerald-400"
  return "text-[#E7E7E9]"
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
        <h1 className="text-2xl font-semibold tracking-tight text-[#E7E7E9]">Audit Log</h1>
        <p className="mt-1 text-sm text-[#9B9B9F]">
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

      <section className="rounded-lg border border-white/[0.04]">
        <div className="border-b border-white/[0.04] px-5 py-4">
          <form method="GET" className="flex flex-wrap items-center gap-3">
            <Suspense fallback={<div className="h-9 w-full max-w-sm rounded-lg border border-white/[0.04] bg-[#0E0E10]" />}>
              <LiveSearchInput
                paramName="q"
                placeholder="Search action, actor email, target, or reason"
                defaultValue={data.filters.search}
                basePath="/admin/audit"
                preserveParams={["targetType", "pageSize"]}
                className="max-w-sm flex-1"
              />
            </Suspense>
            <div className="flex items-center gap-2">
              <AutoSubmitSelect
                name="targetType"
                defaultValue={data.filters.targetType}
                className="h-9 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                <option value="all">All targets</option>
                <option value="user">User</option>
                <option value="project">Project</option>
                <option value="model-policy">Model policy</option>
              </AutoSubmitSelect>
              <AutoSubmitSelect
                name="pageSize"
                defaultValue={String(data.filters.pageSize)}
                className="h-9 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                {ADMIN_AUDIT_PAGE_SIZES.map((size) => (
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
                  <TableCell colSpan={5} className="py-12">
                    <EmptyState icon={ShieldCheck} message="No audit events matched the current filters." />
                  </TableCell>
                </TableRow>
              ) : (
                data.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="py-3">
                      <div>
                        <p className={`text-sm font-medium ${actionColorClass(entry.action)}`}>{entry.action}</p>
                        <p className="text-xs text-[#9B9B9F]">
                          {entry.permission || "No permission tag"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{entry.actorEmail}</p>
                        <p className="text-xs text-[#9B9B9F]">
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
                          <p className="mt-1 max-w-[200px] truncate text-xs text-[#9B9B9F]">
                            {entry.targetId}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px] text-sm text-[#9B9B9F]">
                      {entry.reason || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-[#9B9B9F]">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.04] px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-[#9B9B9F]">
            <Database className="h-3.5 w-3.5" />
            Page {data.pagination.page} of {data.pagination.totalPages}
          </div>
          <div className="flex gap-2">
            <Link
              href={buildAuditHref(data.filters, Math.max(1, data.pagination.page - 1))}
              aria-disabled={!data.pagination.hasPreviousPage}
              className={`inline-flex h-8 items-center justify-center rounded-md border border-white/[0.04] px-3 text-xs font-medium transition-colors ${data.pagination.hasPreviousPage
                ? "text-[#E7E7E9] hover:bg-[#1B1B1F]"
                : "pointer-events-none text-[#9B9B9F]/50"
                }`}
            >
              Previous
            </Link>
            <Link
              href={buildAuditHref(data.filters, data.pagination.page + 1)}
              aria-disabled={!data.pagination.hasNextPage}
              className={`inline-flex h-8 items-center justify-center rounded-md border border-white/[0.04] px-3 text-xs font-medium transition-colors ${data.pagination.hasNextPage
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
