import Link from "next/link"
import { AlertTriangle, CreditCard, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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

  if (filters.search) {
    params.set("q", filters.search)
  }

  if (filters.tier !== "all") {
    params.set("tier", filters.tier)
  }

  if (filters.accountStatus !== "all") {
    params.set("status", filters.accountStatus)
  }

  if (filters.linkStatus !== "all") {
    params.set("link", filters.linkStatus)
  }

  if (filters.pageSize !== 25) {
    params.set("pageSize", String(filters.pageSize))
  }

  if (page > 1) {
    params.set("page", String(page))
  }

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
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(10,166,255,0.14),_transparent_38%),linear-gradient(180deg,_rgba(15,17,19,0.98),_rgba(9,10,11,0.98))] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Billing Module</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Stripe health, subscription state, and recovery controls.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#C3C7CB] sm:text-base">
              Review linked Stripe accounts, renewal timing, top-up balances, and price configuration. Use resync only when stored subscription state needs reconciliation.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Linked Accounts</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(data.summary.linkedAccounts)}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Renewing Soon</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(data.summary.pendingRenewals7d)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Filtered Accounts</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(data.summary.filteredAccounts)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Paid Accounts</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(data.summary.paidAccounts)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Top-up Credits</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(data.summary.totalTopupCredits)}</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Page Size</p>
          <p className="mt-3 text-3xl font-semibold text-white">{data.pagination.pageSize}</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Health</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Stripe configuration</h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Server Issues</p>
              <div className="mt-3 space-y-2 text-sm text-[#D6D8DA]">
                {data.pricingHealth.serverIssues.length === 0 ? (
                  <p className="text-emerald-200">No Stripe server issues detected.</p>
                ) : (
                  data.pricingHealth.serverIssues.map((issue) => <p key={issue}>{issue}</p>)
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Webhook Issues</p>
              <div className="mt-3 space-y-2 text-sm text-[#D6D8DA]">
                {data.pricingHealth.webhookIssues.length === 0 ? (
                  <p className="text-emerald-200">No Stripe webhook issues detected.</p>
                ) : (
                  data.pricingHealth.webhookIssues.map((issue) => <p key={issue}>{issue}</p>)
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Prices</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Configured checkout targets</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {data.pricingHealth.subscriptionPrices.map((price) => (
              <article key={price.key} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{price.label}</p>
                  <Badge className={price.configured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/10"}>
                    {price.configured ? "Configured" : "Missing"}
                  </Badge>
                </div>
                <p className="mt-2 break-all text-xs text-[#A6A6A6]">{price.priceId || "No price id"}</p>
              </article>
            ))}
            {data.pricingHealth.topupPrices.map((price) => (
              <article key={price.key} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">Top-up {price.label}</p>
                  <Badge className={price.configured ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/10"}>
                    {price.configured ? "Configured" : "Missing"}
                  </Badge>
                </div>
                <p className="mt-2 break-all text-xs text-[#A6A6A6]">{price.priceId || "No price id"}</p>
              </article>
            ))}
          </div>
        </div>
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
                defaultValue={data.filters.search}
                placeholder="Search customer name or email"
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] pl-10 pr-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]"
              />
            </div>
          </label>

          <label className="space-y-2 text-sm text-[#D6D8DA]">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Tier</span>
            <select name="tier" defaultValue={data.filters.tier} className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]">
              <option value="all">All tiers</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="proplus">Pro Plus</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-[#D6D8DA]">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Status</span>
            <select name="status" defaultValue={data.filters.accountStatus} className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-[#D6D8DA]">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Stripe Link</span>
            <select name="link" defaultValue={data.filters.linkStatus} className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]">
              <option value="all">All</option>
              <option value="linked">Linked</option>
              <option value="unlinked">Unlinked</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-[#D6D8DA]">
            <span className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Page Size</span>
            <select name="pageSize" defaultValue={String(data.filters.pageSize)} className="h-10 w-full rounded-xl border border-white/10 bg-[#0B0C0D] px-3 text-sm text-white outline-none transition-colors focus:border-[#0AA6FF]">
              {ADMIN_BILLING_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-3 xl:justify-end">
            <button type="submit" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0AA6FF] px-4 text-sm font-medium text-white transition-colors hover:bg-[#0AA6FF]/90">
              Apply
            </button>
            <Link href="/admin/billing" className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-[#D6D8DA] transition-colors hover:bg-white/[0.03]">
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Accounts</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Billing-linked customers</h2>
          </div>
          <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">{formatNumber(data.pagination.totalAccounts)} matched</Badge>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/8">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-white/8 hover:bg-transparent">
                <TableHead className="px-4 text-[#A6A6A6]">Customer</TableHead>
                <TableHead className="text-[#A6A6A6]">Subscription</TableHead>
                <TableHead className="text-[#A6A6A6]">Stripe</TableHead>
                <TableHead className="text-[#A6A6A6]">Credits</TableHead>
                <TableHead className="text-[#A6A6A6]">Renewal</TableHead>
                <TableHead className="text-right text-[#A6A6A6]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.accounts.length === 0 ? (
                <TableRow className="border-white/8">
                  <TableCell colSpan={6} className="px-4 py-12 text-center text-sm text-[#A6A6A6]">No accounts matched the current billing filters.</TableCell>
                </TableRow>
              ) : (
                data.accounts.map((account) => (
                  <TableRow key={account.id} className="border-white/8 hover:bg-white/[0.02]">
                    <TableCell className="px-4 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{account.name}</p>
                        <p className="mt-1 truncate text-sm text-[#A6A6A6]">{account.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{account.subscription.tierName}</p>
                        <div className="mt-1 flex items-center gap-2">
                          {account.accountStatus === "suspended" ? (
                            <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/10">Suspended</Badge>
                          ) : null}
                          {account.subscription.stripeSubscriptionId ? (
                            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/10">Linked</Badge>
                          ) : (
                            <Badge variant="outline" className="border-white/10 text-[#A6A6A6]">Unlinked</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[220px] space-y-1 text-xs text-[#A6A6A6]">
                        <p className="truncate">Customer: {account.subscription.stripeCustomerId || "-"}</p>
                        <p className="truncate">Subscription: {account.subscription.stripeSubscriptionId || "-"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{formatNumber(account.monthlyCredits + account.topupCredits)}</p>
                        <p className="mt-1 text-xs text-[#A6A6A6]">{formatNumber(account.monthlyCredits)} monthly · {formatNumber(account.topupCredits)} top-up</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#A6A6A6]">
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

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[#A6A6A6]">Page {data.pagination.page} of {data.pagination.totalPages}</div>
          <div className="flex items-center gap-3">
            <Link
              href={buildBillingHref(data.filters, Math.max(1, data.pagination.page - 1))}
              aria-disabled={!data.pagination.hasPreviousPage}
              className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors ${data.pagination.hasPreviousPage ? "border border-white/10 text-[#D6D8DA] hover:bg-white/[0.03]" : "cursor-not-allowed border border-white/5 text-[#6D7175]"}`}
            >
              Previous
            </Link>
            <Link
              href={buildBillingHref(data.filters, data.pagination.page + 1)}
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