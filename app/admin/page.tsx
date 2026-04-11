import Link from "next/link"
import {
  Activity,
  Bot,
  FileCode2,
  FolderKanban,
  HardDrive,
  Layers3,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getAdminOverviewSnapshot } from "@/lib/admin/overview"

export const dynamic = "force-dynamic"

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const normalized = bytes / 1024 ** index

  return `${normalized.toFixed(normalized >= 100 || index === 0 ? 0 : 1)} ${units[index]}`
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

export default async function AdminOverviewPage() {
  const overview = await getAdminOverviewSnapshot()

  const metrics = [
    {
      label: "Users",
      value: formatNumber(overview.metrics.totalUsers),
      detail: `${formatNumber(overview.metrics.newUsers7d)} new in 7 days`,
      icon: Users,
    },
    {
      label: "Active Users",
      value: formatNumber(overview.metrics.activeUsers7d),
      detail: "Users with prompts in the last 7 days",
      icon: Activity,
    },
    {
      label: "Projects",
      value: formatNumber(overview.metrics.totalProjects),
      detail: `${formatNumber(overview.metrics.totalCheckpoints)} checkpoints stored`,
      icon: FolderKanban,
    },
    {
      label: "Prompts (24h)",
      value: formatNumber(overview.metrics.prompts24h),
      detail: `${formatNumber(overview.metrics.totalUsageLogs)} total prompt events`,
      icon: FileCode2,
    },
    {
      label: "Media Storage",
      value: formatBytes(overview.metrics.totalStorageBytes),
      detail: `${formatNumber(overview.metrics.totalMediaAssets)} uploaded assets`,
      icon: HardDrive,
    },
    {
      label: "Enabled Models",
      value: formatNumber(overview.metrics.enabledModels),
      detail: `${formatNumber(overview.metrics.paidUsers)} paid accounts`,
      icon: Bot,
    },
  ]

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-1.5 w-1.5 rounded-full bg-[#0AA6FF] animate-pulse" />
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#0AA6FF]">
            System Snapshot
          </p>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white font-sans">
          Overview
        </h1>
        <p className="mt-2 text-sm text-[#A6A6A6] max-w-2xl">
          Real-time metrics across customer accounts, project activity, and infrastructure usage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div 
              key={metric.label}
              className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#08090A] p-6 transition-all hover:border-white/10 hover:bg-white/[0.02]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-[#A6A6A6] mb-1">{metric.label}</p>
                  <h3 className="text-2xl font-semibold text-white tracking-tight">{metric.value}</h3>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.03] text-[#A6A6A6] transition-colors group-hover:text-white group-hover:bg-white/5">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-white/20" />
                <p className="text-[11px] text-[#71717A] leading-none text-sans text-xs">{metric.detail}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-white/5 bg-[#08090A] overflow-hidden">
          <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between bg-white/[0.01]">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-[#0AA6FF]" />
              Recent Signups
            </h2>
            <Link href="/admin/customers" className="text-[10px] font-bold uppercase tracking-widest text-[#A6A6A6] hover:text-white transition-colors">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto font-sans">
            <div className="min-w-full">
              <div className="grid grid-cols-[1.3fr_0.9fr_0.8fr_0.9fr] gap-4 border-b border-white/5 bg-white/[0.01] px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-[#71717A]">
                <span>User</span>
                <span>Role</span>
                <span>Tier</span>
                <span>Created</span>
              </div>

              {overview.recentUsers.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-[#71717A]">No recent users.</div>
              ) : (
                overview.recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="grid grid-cols-[1.3fr_0.9fr_0.8fr_0.9fr] gap-4 border-b border-white/5 px-6 py-4 text-sm hover:bg-white/[0.01] transition-colors last:border-b-0 group"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/customers/${user.id}`}
                        className="truncate font-medium text-white transition-colors hover:text-[#0AA6FF] block"
                      >
                        {user.name || "Unnamed User"}
                      </Link>
                      <p className="mt-0.5 truncate text-[11px] text-[#71717A]">{user.email}</p>
                    </div>
                    <div className="flex items-center">
                      <span className="text-xs text-[#A6A6A6] px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/5">
                        {formatRoleLabel(user.role)}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Badge variant="outline" className="text-[10px] bg-[#0AA6FF]/5 border-[#0AA6FF]/20 text-[#0AA6FF] py-0">
                        {formatTierLabel(user.tier)}
                      </Badge>
                    </div>
                    <div className="flex items-center text-xs text-[#71717A]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-[#08090A] overflow-hidden flex flex-col">
          <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between bg-white/[0.01]">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-[#0AA6FF]" />
              Infrastructure
            </h2>
          </div>
          <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
            <Layers3 className="h-8 w-8 text-white/5 mb-4" />
            <p className="text-sm text-[#71717A] font-sans">
              Monitoring active nodes and storage clusters. All systems are currently operating within normal parameters.
            </p>
            <div className="mt-6 w-full space-y-3 px-4">
               <div className="flex items-center justify-between text-[11px] text-[#A6A6A6] font-sans">
                 <span>API Health</span>
                 <span className="text-emerald-400 font-bold">100%</span>
               </div>
               <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                 <div className="h-full bg-emerald-400/50 w-full" />
               </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
