import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Bot, CreditCard, FolderKanban, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/admin/stat-card"
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
  if (tier === "proplus") return "Pro Plus"
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

export default async function AdminCustomerDetailPage({ params }: CustomerDetailPageProps) {
  const session = await requireAdminPage("admin:view-customers")
  const { id } = await params
  const detail = await getAdminUserDetail(id)

  if (!detail) notFound()

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
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{detail.customer.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{detail.customer.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{formatRoleLabel(detail.customer.role)}</Badge>
          <Badge variant="outline">{formatTierLabel(detail.customer.subscription.tier)}</Badge>
          <Badge
            className={
              detail.customer.accountStatus === "active"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            }
          >
            {detail.customer.accountStatus}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="Available Credits"
          value={formatNumber(detail.customer.credits.availableCredits)}
          description={`${formatNumber(detail.customer.credits.monthlyCredits)} monthly · ${formatNumber(detail.customer.credits.topupCredits)} top-up`}
          icon={CreditCard}
        />
        <StatCard
          title="Projects"
          value={formatNumber(detail.stats.projectCount)}
          description={`${formatNumber(detail.stats.publicProjectCount)} public`}
          icon={FolderKanban}
        />
        <StatCard
          title="Prompts"
          value={formatNumber(detail.stats.totalPrompts)}
          description={`${formatNumber(detail.stats.prompts7d)} in 7 days`}
          icon={Bot}
        />
        <StatCard
          title="Credit Reset"
          value={new Date(detail.customer.creditsResetDate).toLocaleDateString()}
          description={`Last active ${detail.stats.lastActiveAt ? new Date(detail.stats.lastActiveAt).toLocaleDateString() : "never"}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Management</p>
              <h2 className="text-sm font-medium">Role, status, tier, and credits</h2>
            </div>
          </div>
          <div className="mt-5">
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

        <section className="rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Account Snapshot</p>
              <h2 className="text-sm font-medium">Subscription and preferences</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground">Subscription</p>
              <p className="mt-1 font-medium">{detail.customer.subscription.tierName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatNumber(detail.customer.subscription.monthlyAllowance)} monthly allowance
              </p>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground">Default Model</p>
              <p className="mt-1 font-medium">
                {detail.customer.preferences.defaultModel || "Not set"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground">Privacy</p>
              <p className="mt-1 font-medium">
                {detail.customer.preferences.privateProjectsByDefault
                  ? "Private projects by default"
                  : "Public projects allowed by default"}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Marketing {detail.customer.preferences.marketingEmails ? "on" : "off"} · Updates{" "}
                {detail.customer.preferences.productUpdates ? "on" : "off"}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Projects</p>
              <h2 className="text-sm font-medium">Recent workspaces</h2>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {detail.recentProjects.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No projects yet.
              </div>
            ) : (
              detail.recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-lg border bg-muted/50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {project.emoji || "🎨"} {project.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(project.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {project.isPrivate ? "Private" : "Public"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Usage</p>
              <h2 className="text-sm font-medium">Recent prompts and model mix</h2>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {detail.topModels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {detail.topModels.map((model) => (
                  <Badge key={model.modelId} variant="secondary" className="text-[10px]">
                    {model.modelId} · {formatNumber(model.count)}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="space-y-2">
              {detail.recentUsage.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  No prompt history yet.
                </div>
              ) : (
                detail.recentUsage.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border bg-muted/50 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{entry.aiModel}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.promptType} · {entry.creditsCost} credit
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
