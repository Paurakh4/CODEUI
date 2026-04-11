import Link from "next/link"
import { ArrowRight, Search, Users, SlidersHorizontal } from "lucide-react"
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
import { ADMIN_USER_PAGE_SIZES, parseAdminUsersQuery } from "@/lib/admin/user-filters"
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
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#71717A]" />
              <input 
                type="text" 
                placeholder="Search users..." 
                className="w-full bg-white/[0.03] border border-white/5 rounded-lg py-2 pl-9 pr-4 text-xs text-white placeholder:text-[#4B4B4B] focus:outline-none focus:border-[#0AA6FF]/50 transition-colors"
                defaultValue={result.filters.search}
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] font-bold text-[#A6A6A6] hover:text-white transition-colors uppercase tracking-wider">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </button>
          </div>
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
                <TableRow key={user.id} className="border-white/5 hover:bg-white/[0.01] transition-colors group">
                  <TableCell className="py-4 px-6 text-sans">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-white/[0.03] flex items-center justify-center text-xs font-bold text-[#0AA6FF] border border-white/5 group-hover:border-[#0AA6FF]/20 transition-colors">
                        {user.name?.charAt(0) || "U"}
                      </div>
                      <div>
                        <Link
                          href={`/admin/customers/${user.id}`}
                          className="font-medium text-white hover:text-[#0AA6FF] transition-colors block text-[13px]"
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
                      className="flex h-8 w-8 items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/5 transition-all"
                    >
                      <ArrowRight className="h-4 w-4 text-[#A6A6A6]" />
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
              {/* Pagination buttons would go here */}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
