import Link from "next/link"
import { AlertTriangle, CreditCard, Search } from "lucide-react"
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
import { BillingResyncButton } from "@/components/admin/billing-resync-button"
import { requireAdminPage } from "@/lib/admin/guards"
import {
  ADMIN_BILLING_PAGE_SIZES,
  parseAdminBillingQuery,
} from "@/lib/admin/billing-filters"
import { getAdminBillingPageData } from "@/lib/admin/billing"
import { hasAdminPermission } from "@/lib/admin/rbac"

interface BillingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function buildBillingHref(
  filters: ReturnType<typeof parseAdminBillingQuery>,
  page: number,
) {
  const params = new URLSearchParams()
  if (filters.search) params.set("q", filters.search)
  if (filters.tier !== "all") params.set("tier", filters.tier)
  if (filters.accountStatus !== "all") params.set("status", filters.accountStatus)
  if (filters.linkStatus !== "all") params.set("link", filters.linkStatus)
  if (filters.pageSize !== 25) params.set("pageSize", String(filters.pageSize))
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/admin/billing?${query}` : "/admin/billing"
}

export default async function AdminBillingPage({ searchParams }: BillingPageProps) {
  const session = await requireAdminPage("admin:view-billing")
  const filters = parseAdminBillingQuery(await searchParams)
  const data = await getAdminBillingPageData(filters)
  const canManageBilling = hasAdminPermission({
    role: session.user.role,
    permission: "admin:manage-billing",
    resolvedPermissions: session.user.permissions,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#E7E7E9]">Billing</h1>
        <p className="mt-1 text-sm text-[#9B9B9F]">
          Stripe health, subscription state, and recovery controls.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Linked Accounts"
          value={formatNumber(data.summary.linkedAccounts)}
          icon={CreditCard}
        />
        <StatCard
          title="Renewing Soon"
          value={formatNumber(data.summary.pendingRenewals7d)}
          description="Next 7 days"
        />
        <StatCard
          title="Filtered Accounts"
          value={formatNumber(data.summary.filteredAccounts)}
        />
        <StatCard
          title="Paid Accounts"
          value={formatNumber(data.summary.paidAccounts)}
          description={`${formatNumber(data.summary.totalTopupCredits)} top-up credits`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-white/[0.04] p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-[#9B9B9F]" />
            <div>
              <p className="text-xs text-[#9B9B9F]">Health</p>
              <h2 className="text-sm font-medium text-[#E7E7E9]">Stripe configuration</h2>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-4">
              <p className="text-xs text-[#9B9B9F]">Server Issues</p>
              {data.pricingHealth.serverIssues.length === 0 ? (
                <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                  No Stripe server issues detected.
                </p>
              ) : (
                data.pricingHealth.serverIssues.map((issue) => (
                  <p key={issue} className="mt-1 text-sm">
                    {issue}
                  </p>
                ))
              )}
            </div>
            <div className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-4">
              <p className="text-xs text-[#9B9B9F]">Webhook Issues</p>
              {data.pricingHealth.webhookIssues.length === 0 ? (
                <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                  No Stripe webhook issues detected.
                </p>
              ) : (
                data.pricingHealth.webhookIssues.map((issue) => (
                  <p key={issue} className="mt-1 text-sm">
                    {issue}
                  </p>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/[0.04] p-5">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-[#9B9B9F]" />
            <div>
              <p className="text-xs text-[#9B9B9F]">Prices</p>
              <h2 className="text-sm font-medium text-[#E7E7E9]">Configured checkout targets</h2>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.pricingHealth.subscriptionPrices.map((price) => (
              <div key={price.key} className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[#E7E7E9]">{price.label}</p>
                  <Badge
                    className={
                      price.configured
                        ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : "border border-amber-500/20 bg-amber-500/10 text-amber-300"
                    }
                  >
                    {price.configured ? "Configured" : "Missing"}
                  </Badge>
                </div>
                <p className="mt-2 break-all text-xs text-[#9B9B9F]">
                  {price.priceId || "No price id"}
                </p>
              </div>
            ))}
            {data.pricingHealth.topupPrices.map((price) => (
              <div key={price.key} className="rounded-lg border border-white/[0.04] bg-[#1B1B1F] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[#E7E7E9]">Top-up {price.label}</p>
                  <Badge
                    className={
                      price.configured
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }
                  >
                    {price.configured ? "Configured" : "Missing"}
                  </Badge>
                </div>
                <p className="mt-2 break-all text-xs text-[#9B9B9F]">
                  {price.priceId || "No price id"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-white/[0.04]">
        <div className="border-b border-white/[0.04] px-5 py-4">
          <form method="GET" className="grid gap-4 xl:grid-cols-[1.5fr_repeat(4,auto)] xl:items-end">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#9B9B9F]">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9B9B9F]" />
                <input
                  type="search"
                  name="q"
                  defaultValue={data.filters.search}
                  placeholder="Search customer name or email"
                  className="h-9 w-full rounded-lg border border-white/[0.04] bg-[#0E0E10] pl-9 pr-3 text-sm text-[#E7E7E9] placeholder:text-[#9B9B9F]/50 focus:outline-none focus:ring-2 focus:ring-white/10"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#9B9B9F]">Tier</label>
              <select
                name="tier"
                defaultValue={data.filters.tier}
                className="h-9 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                <option value="all">All tiers</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="proplus">Pro Plus</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#9B9B9F]">Status</label>
              <select
                name="status"
                defaultValue={data.filters.accountStatus}
                className="h-9 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#9B9B9F]">Stripe Link</label>
              <select
                name="link"
                defaultValue={data.filters.linkStatus}
                className="h-9 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                <option value="all">All</option>
                <option value="linked">Linked</option>
                <option value="unlinked">Unlinked</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#9B9B9F]">Page Size</label>
              <select
                name="pageSize"
                defaultValue={String(data.filters.pageSize)}
                className="h-9 rounded-lg border border-white/[0.04] bg-[#0E0E10] px-3 text-sm text-[#E7E7E9] focus:outline-none focus:ring-2 focus:ring-white/10"
              >
                {ADMIN_BILLING_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-[#E7E7E9] px-4 text-xs font-medium text-[#0E0E10] transition-colors hover:bg-white"
              >
                Apply
              </button>
              <Link
                href="/admin/billing"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-white/[0.04] px-4 text-xs font-medium text-[#9B9B9F] transition-colors hover:bg-[#1B1B1F] hover:text-[#E7E7E9]"
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
                <TableHead>Customer</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Stripe</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Renewal</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-[#9B9B9F]">
                    No accounts matched the current billing filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#E7E7E9]">
                          {account.name}
                        </p>
                        <p className="truncate text-xs text-[#9B9B9F]">{account.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{account.subscription.tierName}</p>
                        <div className="mt-1 flex items-center gap-2">
                          {account.accountStatus === "suspended" ? (
                            <Badge className="border border-amber-500/20 bg-amber-500/10 text-amber-300">
                              Suspended
                            </Badge>
                          ) : null}
                          {account.subscription.stripeSubscriptionId ? (
                            <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                              Linked
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[#9B9B9F]">
                              Unlinked
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] space-y-0.5 text-xs text-[#9B9B9F]">
                        <p className="truncate">
                          Customer: {account.subscription.stripeCustomerId || "-"}
                        </p>
                        <p className="truncate">
                          Sub: {account.subscription.stripeSubscriptionId || "-"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium tabular-nums text-[#E7E7E9]">
                          {formatNumber(account.monthlyCredits + account.topupCredits)}
                        </p>
                        <p className="text-xs text-[#9B9B9F]">
                          {formatNumber(account.monthlyCredits)} monthly ·{" "}
                          {formatNumber(account.topupCredits)} top-up
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[#9B9B9F]">
                      {account.subscription.currentPeriodEnd
                        ? new Date(account.subscription.currentPeriodEnd).toLocaleDateString()
                        : "Not linked"}
                    </TableCell>
                    <TableCell className="text-right">
                      {account.subscription.stripeSubscriptionId ? (
                        <BillingResyncButton userId={account.id} disabled={!canManageBilling} />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.04] px-5 py-3">
          <p className="text-xs text-[#9B9B9F]">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              href={buildBillingHref(data.filters, Math.max(1, data.pagination.page - 1))}
              aria-disabled={!data.pagination.hasPreviousPage}
              className={`inline-flex h-8 items-center justify-center rounded-md border border-white/[0.04] px-3 text-xs font-medium transition-colors ${
                data.pagination.hasPreviousPage
                  ? "text-[#E7E7E9] hover:bg-[#1B1B1F]"
                  : "pointer-events-none text-[#9B9B9F]/50"
              }`}
            >
              Previous
            </Link>
            <Link
              href={buildBillingHref(data.filters, data.pagination.page + 1)}
              aria-disabled={!data.pagination.hasNextPage}
              className={`inline-flex h-8 items-center justify-center rounded-md border border-white/[0.04] px-3 text-xs font-medium transition-colors ${
                data.pagination.hasNextPage
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
