import { BellRing, MessageSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(10,166,255,0.14),_transparent_38%),linear-gradient(180deg,_rgba(15,17,19,0.98),_rgba(9,10,11,0.98))] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Feedback Module</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Live review queue for user-submitted product feedback.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#C3C7CB] sm:text-base">
              New submissions from the in-product feedback modal stream into this console in real time with user identity, timestamps, status tracking, and one-click review actions.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-[360px]">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-[#7FD0FF]">
                <BellRing className="h-4 w-4" />
                <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Unread</p>
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">{initialData.summary.unreadCount}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-[#7FD0FF]">
                <MessageSquare className="h-4 w-4" />
                <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Total Logged</p>
              </div>
              <p className="mt-2 text-2xl font-semibold text-white">{initialData.summary.totalFeedback}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Badge className="border-[#0AA6FF]/30 bg-[#0AA6FF]/10 text-[#7FD0FF] hover:bg-[#0AA6FF]/10">
            Live SSE stream enabled
          </Badge>
          <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">
            {canManageFeedback ? "Can update status" : "Read-only access"}
          </Badge>
        </div>
      </section>

      <AdminFeedbackCenter initialData={initialData} canManageFeedback={canManageFeedback} />
    </div>
  )
}