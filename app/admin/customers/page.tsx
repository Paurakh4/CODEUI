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
  if (tier === "proplus") return "Pro Plus"
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
  if (filters.search) params.set("q", filters.search)
  if (filters.role !== "all") params.set("role", filters.role)
  if (filters.accountStatus !== "all") params.set("status", filters.accountStatus)
  if (filters.tier !== "all") params.set("tier", filters.tier)
  if (filters.pageSize !== 25) params.set("pageSize", String(filters.pageSize))
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/admin/customers?${query}` : "/admin/customers"
}

export default async function AdminCustomersPage({ searchParams }: CustomersPageProps) {
  await requireAdminPage("admin:view-customers")
  const filters = parseAdminUsersQuery(await searchParams)
  const result = await getAdminUsersPage(filters)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#E7E7E9]">Customers</h1>
        <p className="mt-1 text-sm text-[#9B9B9F]">
          {formatNumber(result.summary.filteredUsers)} total users
        </p>
      </div>

      <div className="rounded-lg border border-white/[0.04]">
        <div className="border-b border-white/[0.04] px-5 py-3">
          <form method="GET" className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9B9B9F]" />
              <input
                type="search"
                name="q"
                placeholder="Search users..."
                defaultValue={result.filters.search}
                className="h-9 w-full rounded-lg border border-white/[0.04] bg-[#0E0E10] pl-9 pr-3 text-sm text-[#E7E7E9] placeholder:text-[#9B9B9F]/50 focus:outline-none focus:ring-2 focus:ring-white/10"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#E7E7E9] px-3 text-xs font-medium text-[#0E0E10] transition-colors hover:bg-white"
            >
              Search
            </button>
            <Link
              href="/admin/customers"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-white/[0.04] px-3 text-xs font-medium text-[#9B9B9F] transition-colors hover:bg-[#1B1B1F] hover:text-[#E7E7E9]"
            >
              Reset
            </Link>
          </form>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                result.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1B1B1F] text-xs font-medium text-[#9B9B9F]">
                          {user.name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <Link
                            href={`/admin/customers/${user.id}`}
                            className="text-sm font-medium text-[#E7E7E9] hover:text-white"
                          >
                            {user.name || "Unnamed User"}
                          </Link>
                          <p className="text-xs text-[#9B9B9F]">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {formatRoleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {formatTierLabel(user.tier)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs ${
                          user.accountStatus === "active"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            user.accountStatus === "active" ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        {user.accountStatus}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/customers/${user.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[#9B9B9F] transition-colors hover:bg-[#1B1B1F]"
                        aria-label={`View ${user.name || "user"}`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {result.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.04] px-5 py-3">
            <p className="text-xs text-[#9B9B9F]">
              Page {result.pagination.page} of {result.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Link
                href={buildCustomersHref(filters, Math.max(1, result.pagination.page - 1))}
                aria-disabled={!result.pagination.hasPreviousPage}
                className={`inline-flex h-8 items-center justify-center rounded-md border border-white/[0.04] px-3 text-xs font-medium transition-colors ${
                  result.pagination.hasPreviousPage
                    ? "text-[#E7E7E9] hover:bg-[#1B1B1F]"
                    : "pointer-events-none text-[#9B9B9F]/50"
                }`}
              >
                Previous
              </Link>
              <Link
                href={buildCustomersHref(filters, result.pagination.page + 1)}
                aria-disabled={!result.pagination.hasNextPage}
                className={`inline-flex h-8 items-center justify-center rounded-md border border-white/[0.04] px-3 text-xs font-medium transition-colors ${
                  result.pagination.hasNextPage
                    ? "text-[#E7E7E9] hover:bg-[#1B1B1F]"
                    : "pointer-events-none text-[#9B9B9F]/50"
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
