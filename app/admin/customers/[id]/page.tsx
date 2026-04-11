import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Bot, CreditCard, FolderKanban, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { CustomerManagementForm } from "@/components/admin/customer-management-form"
import { requireAdminPage } from "@/lib/admin/guards"
import { hasAdminPermission, USER_ROLES } from "@/lib/admin/rbac"
import { getAdminUserDetail } from "@/lib/admin/users"

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>
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

export default async function AdminCustomerDetailPage({ params }: CustomerDetailPageProps) {
  const session = await requireAdminPage("admin:view-customers")
  const { id } = await params
  const detail = await getAdminUserDetail(id)

  if (!detail) {
    notFound()
  }

  const canManageUsers = hasAdminPermission({
    role: session.user.role,
    permission: "admin:manage-users",
    resolvedPermissions: session.user.permissions,
  })
  const isSelf = session.user.id === detail.customer.id
  const isOwnerTarget = detail.customer.role === "owner"
  const readOnlyReason = !canManageUsers
    ? "Your role can view customer data but cannot modify accounts."
    : isSelf
      ? "Self-management is blocked in this first slice to avoid locking out the current admin session."
      : isOwnerTarget && session.user.role !== "owner"
        ? "Only an owner can modify an owner account."
        : undefined

  const availableRoles =
    session.user.role === "owner"
      ? USER_ROLES
      : USER_ROLES.filter((role) => role !== "owner")

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(10,166,255,0.14),_transparent_38%),linear-gradient(180deg,_rgba(15,17,19,0.98),_rgba(9,10,11,0.98))] p-6 sm:p-8">
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-2 text-sm text-[#A6A6A6] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Link>

        <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">
              Customer Detail
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {detail.customer.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#C3C7CB] sm:text-base">
              {detail.customer.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-[#0AA6FF]/30 bg-[#0AA6FF]/10 text-[#7FD0FF] hover:bg-[#0AA6FF]/10">
              {formatRoleLabel(detail.customer.role)}
            </Badge>
            <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">
              {formatTierLabel(detail.customer.subscription.tier)}
            </Badge>
            <Badge
              className={
                detail.customer.accountStatus === "active"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/10"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/10"
              }
            >
              {formatRoleLabel(detail.customer.accountStatus)}
            </Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Available Credits</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {formatNumber(detail.customer.credits.availableCredits)}
          </p>
          <p className="mt-2 text-sm text-[#A6A6A6]">
            {formatNumber(detail.customer.credits.monthlyCredits)} monthly · {formatNumber(detail.customer.credits.topupCredits)} top-up
          </p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Projects</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {formatNumber(detail.stats.projectCount)}
          </p>
          <p className="mt-2 text-sm text-[#A6A6A6]">
            {formatNumber(detail.stats.publicProjectCount)} public projects
          </p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Prompts</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {formatNumber(detail.stats.totalPrompts)}
          </p>
          <p className="mt-2 text-sm text-[#A6A6A6]">
            {formatNumber(detail.stats.prompts7d)} in the last 7 days
          </p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Credit Reset</p>
          <p className="mt-3 text-xl font-semibold text-white">
            {new Date(detail.customer.creditsResetDate).toLocaleDateString()}
          </p>
          <p className="mt-2 text-sm text-[#A6A6A6]">
            Last active {detail.stats.lastActiveAt ? new Date(detail.stats.lastActiveAt).toLocaleDateString() : "never"}
          </p>
        </article>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">
                Management
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
                Role, status, tier, and credits
              </h2>
            </div>
          </div>

          <div className="mt-6">
            <CustomerManagementForm
              userId={detail.customer.id}
              initialRole={detail.customer.role}
              initialAccountStatus={detail.customer.accountStatus}
              initialSubscriptionTier={detail.customer.subscription.tier}
              initialMonthlyCredits={detail.customer.credits.monthlyCredits}
              initialTopupCredits={detail.customer.credits.topupCredits}
              initialAdminNotes={detail.customer.adminNotes}
              availableRoles={availableRoles}
              readOnly={Boolean(readOnlyReason)}
              readOnlyReason={readOnlyReason}
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">
                Account Snapshot
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
                Subscription and preferences
              </h2>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm text-[#D6D8DA]">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Subscription</p>
              <p className="mt-2 font-medium text-white">{detail.customer.subscription.tierName}</p>
              <p className="mt-1 text-[#A6A6A6]">
                {formatNumber(detail.customer.subscription.monthlyAllowance)} monthly allowance
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Default Model</p>
              <p className="mt-2 font-medium text-white">{detail.customer.preferences.defaultModel || "Not set"}</p>
              <p className="mt-1 text-[#A6A6A6]">
                Enhanced prompts {detail.customer.preferences.enhancedPrompts ? "enabled" : "disabled"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Privacy</p>
              <p className="mt-2 font-medium text-white">
                {detail.customer.preferences.privateProjectsByDefault ? "Private projects by default" : "Public projects allowed by default"}
              </p>
              <p className="mt-1 text-[#A6A6A6]">
                Marketing emails {detail.customer.preferences.marketingEmails ? "on" : "off"} · Product updates {detail.customer.preferences.productUpdates ? "on" : "off"}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Projects</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Recent workspaces</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {detail.recentProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-sm text-[#A6A6A6]">
                No projects yet.
              </div>
            ) : (
              detail.recentProjects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {project.emoji || "🎨"} {project.name}
                      </p>
                      <p className="mt-1 text-sm text-[#A6A6A6]">
                        Updated {new Date(project.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">
                      {project.isPrivate ? "Private" : "Public"}
                    </Badge>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Usage</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Recent prompts and model mix</h2>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {detail.topModels.length === 0 ? (
                <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">No usage yet</Badge>
              ) : (
                detail.topModels.map((model) => (
                  <Badge key={model.modelId} className="border-[#0AA6FF]/30 bg-[#0AA6FF]/10 text-[#7FD0FF] hover:bg-[#0AA6FF]/10">
                    {model.modelId} · {formatNumber(model.count)}
                  </Badge>
                ))
              )}
            </div>

            <div className="space-y-3">
              {detail.recentUsage.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-sm text-[#A6A6A6]">
                  No prompt history yet.
                </div>
              ) : (
                detail.recentUsage.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{entry.aiModel}</p>
                        <p className="mt-1 text-sm text-[#A6A6A6]">
                          {formatRoleLabel(entry.promptType)} · {entry.creditsCost} credit
                        </p>
                      </div>
                      <p className="text-sm text-[#A6A6A6]">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}