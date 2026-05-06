import Link from "next/link"
import { ArrowRight, Bot, FileCode2, FolderKanban, HardDrive, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/admin/stat-card"
import { getAdminOverviewSnapshot } from "@/lib/admin/overview"

export const dynamic = "force-dynamic"

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const normalized = bytes / 1024 ** index
  return `${normalized.toFixed(normalized >= 100 || index === 0 ? 0 : 1)} ${units[index]}`
}

export default async function AdminOverviewPage() {
  const overview = await getAdminOverviewSnapshot()

  const metrics = [
    {
      title: "Total Users",
      value: formatNumber(overview.metrics.totalUsers),
      description: `${formatNumber(overview.metrics.newUsers7d)} new in 7 days`,
      icon: Users,
    },
    {
      title: "Active Users (7d)",
      value: formatNumber(overview.metrics.activeUsers7d),
      description: `${formatNumber(overview.metrics.paidUsers)} premium accounts`,
      icon: Users,
    },
    {
      title: "Total Projects",
      value: formatNumber(overview.metrics.totalProjects),
      description: `${formatNumber(overview.metrics.totalCheckpoints)} versions saved`,
      icon: FolderKanban,
    },
    {
      title: "Prompts (24h)",
      value: formatNumber(overview.metrics.prompts24h),
      description: `${formatNumber(overview.metrics.totalUsageLogs)} total events`,
      icon: FileCode2,
    },
    {
      title: "Storage",
      value: formatBytes(overview.metrics.totalStorageBytes),
      description: `${formatNumber(overview.metrics.totalMediaAssets)} assets`,
      icon: HardDrive,
    },
    {
      title: "Models",
      value: formatNumber(overview.metrics.enabledModels),
      description: `${formatNumber(overview.metrics.auditLogEntries)} audit entries`,
      icon: Bot,
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          System metrics across users, projects, and infrastructure.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <StatCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-sm font-medium">Recent Users</h2>
            <Link
              href="/admin/customers"
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-5 py-3 font-medium text-muted-foreground" scope="col">User</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground" scope="col">Role</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground" scope="col">Status</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground" scope="col">Tier</th>
                  <th className="px-5 py-3 font-medium text-muted-foreground" scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  overview.recentUsers.map((user) => (
                    <tr key={user.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/customers/${user.id}`}
                          className="font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {user.name || "Unnamed"}
                        </Link>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px]">
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs ${
                            user.accountStatus === "active"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              user.accountStatus === "active"
                                ? "bg-emerald-500"
                                : "bg-red-500"
                            }`}
                          />
                          {user.accountStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{user.tier}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section className="rounded-lg border p-5">
            <h2 className="text-sm font-medium">Subscriptions</h2>
            <div className="mt-4 space-y-4">
              {(["free", "pro", "proplus"] as const).map((tier) => {
                const count = overview.subscriptionBreakdown[tier]
                const total = overview.metrics.totalUsers
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={tier} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {tier === "proplus" ? "Pro Plus" : tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatNumber(count)} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/20"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {overview.topModels.length > 0 ? (
            <section className="rounded-lg border p-5">
              <h2 className="text-sm font-medium">Top Models</h2>
              <div className="mt-4 space-y-2">
                {overview.topModels.map((model) => {
                  const max = overview.topModels[0].count
                  const pct = Math.round((model.count / max) * 100)
                  return (
                    <div key={model.modelId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate text-muted-foreground">{model.modelId}</span>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {formatNumber(model.count)}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/20"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
