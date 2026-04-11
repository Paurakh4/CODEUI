import Link from "next/link"
import { Database, Search } from "lucide-react"
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

  if (filters.search) {
    params.set("q", filters.search)
  }

  if (filters.targetType !== "all") {
    params.set("targetType", filters.targetType)
  }

  if (filters.pageSize !== 25) {
    params.set("pageSize", String(filters.pageSize))
  }

  if (page > 1) {
    params.set("page", String(page))
  }

  const query = params.toString()
  return query ? `/admin/audit?${query}` : "/admin/audit"
}

export default async function AdminAuditPage({ searchParams }: AuditPageProps) {
  await requireAdminPage("admin:view-audit")

  const filters = parseAdminAuditQuery(await searchParams)
  const data = await getAdminAuditPageData(filters)

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(10,166,255,0.14),_transparent_38%),linear-gradient(180deg,_rgba(15,17,19,0.98),_rgba(9,10,11,0.98))] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Audit Module</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Browse admin-side change history.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#C3C7CB] sm:text-base">
              Every guarded customer, project, billing, and model-policy mutation now lands here with actor, permission, target, and reason details.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Filtered Events</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(data.summary.filteredEvents)}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Project Targets</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(data.summary.projectTargets)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">User Targets</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(data.summary.userTargets)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Model Policy Targets</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(data.summary.modelPolicyTargets)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Page Size</p>
          <p className="mt-3 text-3xl font-semibold text-white">{data.pagination.pageSize}</p>
        </article>
      </section>

      <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
        <form method="GET" className="grid gap-4 xl:grid-cols-[1.8fr_repeat(2,0.8fr)_auto] xl:items-end">
          <label className="space-y-2 text-sm text-[#D6D8DA] xl:col-span-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A6A6A6]" />
              <input
                type="search"
                name="q"
                defaultValue={data.filters.search}
                placeholder="Search action, actor email, target, or reason"
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] pl-10 pr-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]"
              />
            </div>
          </label>

          <label className="space-y-2 text-sm text-[#D6D8DA]">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Target Type</span>
            <select
              name="targetType"
              defaultValue={data.filters.targetType}
              className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]"
            >
              <option value="all">All targets</option>
              <option value="user">User</option>
              <option value="project">Project</option>
              <option value="model-policy">Model policy</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-[#D6D8DA]">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Page Size</span>
            <select
              name="pageSize"
              defaultValue={String(data.filters.pageSize)}
              className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]"
            >
              {ADMIN_AUDIT_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-3 xl:justify-end">
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0AA6FF] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0AA6FF]/90">
              Apply
            </button>
            <Link href="/admin/audit" className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-[#D6D8DA] transition-colors hover:bg-white/[0.03]">
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Audit Trail</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Recent events</h2>
          </div>
          <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">{formatNumber(data.pagination.totalEntries)} matched</Badge>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/8">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-white/8 hover:bg-transparent">
                <TableHead className="px-4 text-[#A6A6A6]">Action</TableHead>
                <TableHead className="text-[#A6A6A6]">Actor</TableHead>
                <TableHead className="text-[#A6A6A6]">Target</TableHead>
                <TableHead className="text-[#A6A6A6]">Reason</TableHead>
                <TableHead className="text-[#A6A6A6]">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.length === 0 ? (
                <TableRow className="border-white/8">
                  <TableCell colSpan={5} className="px-4 py-12 text-center text-sm text-[#A6A6A6]">No audit events matched the current filters.</TableCell>
                </TableRow>
              ) : (
                data.entries.map((entry) => (
                  <TableRow key={entry.id} className="border-white/8 hover:bg-white/[0.02]">
                    <TableCell className="px-4 py-4">
                      <div>
                        <p className="font-medium text-white">{entry.action}</p>
                        <p className="mt-1 text-xs text-[#A6A6A6]">{entry.permission || "No permission tag"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{entry.actorEmail}</p>
                        <p className="mt-1 text-xs text-[#A6A6A6]">{formatRoleLabel(entry.actorRole)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">{entry.targetType}</Badge>
                        {entry.targetId ? <p className="mt-2 max-w-[220px] truncate text-xs text-[#A6A6A6]">{entry.targetId}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[320px] text-sm text-[#D6D8DA]">{entry.reason || "-"}</TableCell>
                    <TableCell className="text-[#A6A6A6]">{new Date(entry.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-[#A6A6A6]">
            <Database className="h-4 w-4" />
            Page {data.pagination.page} of {data.pagination.totalPages}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={buildAuditHref(data.filters, Math.max(1, data.pagination.page - 1))}
              aria-disabled={!data.pagination.hasPreviousPage}
              className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors ${data.pagination.hasPreviousPage ? "border border-white/10 text-[#D6D8DA] hover:bg-white/[0.03]" : "cursor-not-allowed border border-white/5 text-[#6D7175]"}`}
            >
              Previous
            </Link>
            <Link
              href={buildAuditHref(data.filters, data.pagination.page + 1)}
              aria-disabled={!data.pagination.hasNextPage}
              className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors ${data.pagination.hasNextPage ? "border border-white/10 text-[#D6D8DA] hover:bg-white/[0.03]" : "cursor-not-allowed border border-white/5 text-[#6D7175]"}`}
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}