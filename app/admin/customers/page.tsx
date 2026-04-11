import Link from "next/link"
import { ArrowRight, Search } from "lucide-react"
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
import { parseAdminUsersQuery } from "@/lib/admin/user-filters"
import { getAdminUsersPage } from "@/lib/admin/users"

interface CustomersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function formatRoleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function formatTierLabel(tier: string) {
  if (tier === "proplus") {
    return "Pro Plus"
  }
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function buildCustomersHref(
  filters: ReturnType<typeof parseAdminUsersQuery>,
  page: number,
) {
  const params = new URLSearchParams()

  if (filters.search) {
    params.set("q", filters.search)
  }

  if (filters.role !== "all") {
    params.set("role", filters.role)
  }

  if (filters.accountStatus !== "all") {
    params.set("status", filters.accountStatus)
  }

  if (filters.tier !== "all") {
    params.set("tier", filters.tier)
  }

  if (filters.pageSize !== 25) {
    params.set("pageSize", String(filters.pageSize))
  }

  if (page > 1) {
    params.set("page", String(page))
  }

  const query = params.toString()
  return query ? `/admin/customers?${query}` : "/admin/customers"
}

export default async function AdminCustomersPage({ searchParams }: CustomersPageProps) {
  await requireAdminPage("admin:view-customers")

  const filters = parseAdminUsersQuery(await searchParams)
  const result = await getAdminUsersPage(filters)

  return (
    <div className="space-y-10 font-sans">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-1.5 w-1.5 rounded-full bg-[#0AA6FF]" />
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#0AA6FF]">
              Customers Module
            </p>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Manage Users
          </h1>
          <p className="mt-2 text-sm text-[#A6A6A6] max-w-2xl">
            Directory of customer accounts. Search, filter, and manage access levels or subscription states.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/5 bg-[#08090A] px-4 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#A6A6A6] mb-0.5">Total Filtered</p>
            <p className="text-lg font-semibold text-white leading-none">
              {formatNumber(result.summary.filteredUsers)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#08090A] overflow-hidden">
        <div className="border-b border-white/5 px-6 py-4 bg-white/[0.01]">
          <form method="GET" className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#71717A]" />
              <input
                type="search"
                name="q"
                placeholder="Search users..."
                className="w-full rounded-lg border border-white/5 bg-white/[0.03] py-2 pl-9 pr-4 text-xs text-white placeholder:text-[#4B4B4B] focus:border-[#0AA6FF]/50 focus:outline-none"
                defaultValue={result.filters.search}
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-white/[0.03] px-3 text-[11px] font-bold uppercase tracking-wider text-[#D6D8DA] hover:bg-white/[0.06]"
            >
              Search
            </button>
            <Link
              href="/admin/customers"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/5 px-3 text-[11px] font-bold uppercase tracking-wider text-[#A6A6A6] hover:bg-white/[0.03]"
            >
              Reset
            </Link>
          </form>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-white/[0.01]">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[10px] uppercase tracking-widest font-bold text-[#71717A] h-12 px-6">User</TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-bold text-[#71717A] h-12 px-6">Role</TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-bold text-[#71717A] h-12 px-6">Tier</TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest font-bold text-[#71717A] h-12 px-6">Status</TableHead>
                <TableHead className="w-10 h-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.users.map((user) => (
                <TableRow key={user.id} className="border-white/5 hover:bg-white/[0.01]">
                  <TableCell className="py-4 px-6 text-sans">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-xs font-bold text-[#0AA6FF]">
                        {user.name?.charAt(0) || "U"}
                      </div>
                      <div>
                        <Link
                          href={`/admin/customers/${user.id}`}
                          className="block text-[13px] font-medium text-white hover:text-[#0AA6FF]"
                        >
                          {user.name || "Unnamed User"}
                        </Link>
                        <p className="text-[11px] text-[#71717A] mt-0.5">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6">
                    <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/5 text-[10px] font-bold uppercase tracking-wider text-[#A6A6A6]">
                      {formatRoleLabel(user.role)}
                    </div>
                  </TableCell>
                  <TableCell className="px-6">
                    <Badge variant="outline" className="text-[10px] bg-[#0AA6FF]/5 border-[#0AA6FF]/20 text-[#0AA6FF] font-bold uppercase tracking-wider py-0">
                      {formatTierLabel(user.tier)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6">
                    <div className="flex items-center gap-2">
                       <div className={`h-1.5 w-1.5 rounded-full ${user.accountStatus === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                       <span className="text-[11px] font-medium text-[#D1D5DB] capitalize">{user.accountStatus}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6">
                    <Link
                      href={`/admin/customers/${user.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[#A6A6A6] hover:bg-white/5"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {result.pagination.totalPages > 1 && (
          <div className="border-t border-white/5 px-6 py-4 flex items-center justify-between bg-white/[0.01]">
            <p className="text-[11px] text-[#71717A] font-medium">
              Page {result.pagination.page} of {result.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Link
                href={buildCustomersHref(filters, Math.max(1, result.pagination.page - 1))}
                aria-disabled={!result.pagination.hasPreviousPage}
                className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-[11px] font-bold uppercase tracking-wider ${
                  result.pagination.hasPreviousPage
                    ? "border border-white/5 text-[#D6D8DA] hover:bg-white/[0.03]"
                    : "cursor-not-allowed border border-white/5 text-[#6D7175]"
                }`}
              >
                Previous
              </Link>
              <Link
                href={buildCustomersHref(filters, result.pagination.page + 1)}
                aria-disabled={!result.pagination.hasNextPage}
                className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-[11px] font-bold uppercase tracking-wider ${
                  result.pagination.hasNextPage
                    ? "border border-white/5 text-[#D6D8DA] hover:bg-white/[0.03]"
                    : "cursor-not-allowed border border-white/5 text-[#6D7175]"
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
