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
      label: "TOTAL USERS",
      value: formatNumber(overview.metrics.totalUsers),
      detail: `${formatNumber(overview.metrics.newUsers7d)} new in 7 days`,
      icon: Users,
      color: "#0AA6FF",
    },
    {
      label: "MAU",
      value: formatNumber(overview.metrics.activeUsers7d),
      detail: "Active in the last 7 days",
      icon: Activity,
      color: "#10B981",
    },
    {
      label: "TOTAL PROJECTS",
      value: formatNumber(overview.metrics.totalProjects),
      detail: `${formatNumber(overview.metrics.totalCheckpoints)} versions`,
      icon: FolderKanban,
      color: "#F59E0B",
    },
    {
      label: "PROMPTS (24H)",
      value: formatNumber(overview.metrics.prompts24h),
      detail: `${formatNumber(overview.metrics.totalUsageLogs)} total events`,
      icon: FileCode2,
      color: "#8B5CF6",
    },
    {
      label: "STORAGE",
      value: formatBytes(overview.metrics.totalStorageBytes),
      detail: `${formatNumber(overview.metrics.totalMediaAssets)} assets`,
      icon: HardDrive,
      color: "#EC4899",
    },
    {
      label: "MODELS",
      value: formatNumber(overview.metrics.enabledModels),
      detail: `${formatNumber(overview.metrics.paidUsers)} premium accounts`,
      icon: Bot,
      color: "#3B82F6",
    },
  ]

  return (
    <div className="flex flex-col h-full gap-8 animate-in fade-in duration-700">
      <div className="flex items-end justify-between border-b border-white/5 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#A6A6A6]">
              Real-time Analytics
            </p>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-2">
            System Overview 
          </h1>
          <p className="text-sm text-[#71717A] max-w-xl">
            Global metrics for CodeUI infrastructure. Operational status is nominal across all availability zones.
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-widest mb-1">Last Update</p>
            <p className="text-xs font-medium text-white">Just now • Auto-sync active</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div
              key={metric.label}
              className="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#08090B] p-5 transition-all hover:bg-white/[0.02]"
            >
              <div 
                className="absolute top-0 right-0 p-4 opacity-10 transition-opacity group-hover:opacity-20"
                style={{ color: metric.color }}
              >
                <Icon className="h-12 w-12" />
              </div>
              
              <div className="relative">
                <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-widest mb-1">{metric.label}</p>
                <div className="flex items-baseline gap-1">
                  <h3 className="text-2xl font-semibold text-white tracking-tight">{metric.value}</h3>
                </div>
                <p className="mt-3 text-[11px] text-[#A6A6A6] font-medium leading-none line-clamp-1">{metric.detail}</p>
              </div>

              <div className="absolute bottom-0 left-0 h-1 w-full bg-white/5 overflow-hidden">
                <div 
                  className="h-full group-hover:animate-shimmer" 
                  style={{ 
                    backgroundColor: metric.color, 
                    width: "30%", 
                    opacity: 0.5 
                  }} 
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_0.5fr] min-h-[500px] flex-1">
        <section className="flex flex-col rounded-3xl border border-white/5 bg-[#08090B]/50 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="px-8 py-6 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Users className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold tracking-wide text-white">
                RECENT ACCOUNTS
              </h2>
            </div>
            <Link 
              href="/admin/customers" 
              className="group flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#A6A6A6] transition-colors hover:text-white"
            >
              System Index 
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#08090B] border-b border-white/5">
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-[#71717A]">User Profile</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-[#71717A]">Access Matrix</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-[#71717A]">Provisioning</th>
                  <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-[#71717A]">Registry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {overview.recentUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-sm text-[#71717A] italic">No active records detected.</td>
                  </tr>
                ) : (
                  overview.recentUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="group transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-8 py-5">
                        <div className="flex flex-col min-w-0">
                          <Link
                            href={`/admin/customers/${user.id}`}
                            className="font-medium text-white transition-colors hover:text-[#0AA6FF] truncate"
                          >
                            {user.name || "Anonymous Operation"}
                          </Link>
                          <span className="text-[11px] text-[#71717A] truncate mt-0.5">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-white/10 bg-white/5 text-[#A6A6A6]">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] font-bold px-2 py-0 rounded border-blue-500/20 bg-blue-500/5 text-blue-400`}
                        >
                          {formatTierLabel(user.tier)}
                        </Badge>
                      </td>
                      <td className="px-8 py-5 text-[11px] text-[#71717A] font-mono">
                        {new Date(user.createdAt).toISOString().split('T')[0]}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="rounded-3xl border border-white/5 bg-[#08090B]/50 p-6 flex flex-col items-center text-center">
            <div className="p-4 rounded-2xl bg-white/[0.02] mb-4">
              <Activity className="h-6 w-6 text-[#10B981]" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-2">INFRASTRUCTURE</h3>
            <p className="text-[12px] text-[#71717A] leading-relaxed">
              All systems are currently operating within normal parameters. CDN nodes are synchronized.
            </p>
            
            <div className="mt-8 w-full space-y-5">
               <div className="space-y-2">
                 <div className="flex justify-between text-[10px] font-bold text-[#71717A] tracking-wider uppercase">
                   <span>Core Engine</span>
                   <span className="text-emerald-400">99.9%</span>
                 </div>
                 <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 w-[99%]" />
                 </div>
               </div>
               
               <div className="space-y-2">
                 <div className="flex justify-between text-[10px] font-bold text-[#71717A] tracking-wider uppercase">
                   <span>API Layer</span>
                   <span className="text-emerald-400">Online</span>
                 </div>
                 <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 w-[94%]" />
                 </div>
               </div>

               <div className="space-y-2">
                 <div className="flex justify-between text-[10px] font-bold text-[#71717A] tracking-wider uppercase">
                   <span>Storage CDN</span>
                   <span className="text-white">Active</span>
                 </div>
                 <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                   <div className="h-full bg-blue-500 w-[100%]" />
                 </div>
               </div>
            </div>
          </div>

          <div className="flex-1 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center p-8 text-center bg-white/[0.01]">
            <Layers3 className="h-10 w-10 text-white/5 mb-4" />
            <p className="text-xs font-medium text-[#71717A] uppercase tracking-widest">
              Deployment Queue
            </p>
            <p className="mt-2 text-[11px] text-[#52525B]">
              No pending deployments in the stack.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
