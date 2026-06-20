import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/admin/stat-card"
import { AdminFeedbackCenter } from "@/components/admin/feedback-center"
import { getAdminFeedbackPageData } from "@/lib/admin/feedback"
import { requireAdminPage } from "@/lib/admin/guards"
import { hasAdminPermission } from "@/lib/admin/rbac"

export const dynamic = "force-dynamic"

export default async function AdminFeedbackPage() {
  const session = await requireAdminPage("admin:view-feedback")
  const initialData = await getAdminFeedbackPageData({
    status: "all",
    page: 1,
    pageSize: 25,
  })
  const canManageFeedback = hasAdminPermission({
    role: session.user.role,
    permission: "admin:manage-feedback",
    resolvedPermissions: session.user.permissions,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#E7E7E9]">Feedback</h1>
        <p className="mt-1 text-sm text-[#9B9B9F]">
          Live review queue for user-submitted product feedback.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Unread" value={initialData.summary.unreadCount} />
        <StatCard title="Read" value={initialData.summary.readCount} />
        <StatCard title="Responded" value={initialData.summary.respondedCount} />
        <StatCard title="Total Logged" value={initialData.summary.totalFeedback} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="border border-white/[0.04] bg-[#1B1B1F] text-[#E7E7E9]">
          <span className="mr-1 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live SSE stream
        </Badge>
        <Badge variant="outline" className="text-[#9B9B9F]">
          {canManageFeedback ? "Can update status" : "Read-only access"}
        </Badge>
      </div>

      <AdminFeedbackCenter initialData={initialData} canManageFeedback={canManageFeedback} />
    </div>
  )
}
