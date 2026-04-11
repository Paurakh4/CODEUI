import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  FileCode2,
  FolderKanban,
  Image,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ProjectManagementForm } from "@/components/admin/project-management-form"
import { requireAdminPage } from "@/lib/admin/guards"
import { hasAdminPermission } from "@/lib/admin/rbac"
import { formatSubscriptionTierLabel, getAdminProjectDetail } from "@/lib/admin/projects"

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>
}

function formatRoleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

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

export default async function AdminProjectDetailPage({ params }: ProjectDetailPageProps) {
  const session = await requireAdminPage("admin:view-projects")
  const { id } = await params
  const detail = await getAdminProjectDetail(id)

  if (!detail) {
    notFound()
  }

  const canManageProjects = hasAdminPermission({
    role: session.user.role,
    permission: "admin:manage-projects",
    resolvedPermissions: session.user.permissions,
  })
  const readOnlyReason = !canManageProjects
    ? "Your role can review projects but cannot modify or delete them."
    : undefined

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(10,166,255,0.14),_transparent_38%),linear-gradient(180deg,_rgba(15,17,19,0.98),_rgba(9,10,11,0.98))] p-6 sm:p-8">
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-2 text-sm text-[#A6A6A6] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>

        <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Project Detail</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {detail.project.emoji || "🎨"} {detail.project.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#C3C7CB] sm:text-base">
              Owned by {detail.owner.name} · {detail.owner.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">
              {detail.project.isPrivate ? "Private" : "Public"}
            </Badge>
            <Badge className="border-[#0AA6FF]/30 bg-[#0AA6FF]/10 text-[#7FD0FF] hover:bg-[#0AA6FF]/10">
              {formatRoleLabel(detail.owner.role)}
            </Badge>
            <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">
              {formatSubscriptionTierLabel(detail.owner.tier)}
            </Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Messages</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(detail.project.messageCount)}</p>
          <p className="mt-2 text-sm text-[#A6A6A6]">Embedded conversation entries</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Checkpoints</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(detail.project.checkpointCount)}</p>
          <p className="mt-2 text-sm text-[#A6A6A6]">{formatNumber(detail.project.versionCount)} legacy versions</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Media</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(detail.stats.mediaCount)}</p>
          <p className="mt-2 text-sm text-[#A6A6A6]">{formatBytes(detail.stats.storageBytes)} stored</p>
        </article>
        <article className="rounded-[24px] border border-white/8 bg-[#0F1113] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">HTML Size</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatBytes(detail.project.htmlContentLength)}</p>
          <p className="mt-2 text-sm text-[#A6A6A6]">{detail.project.views} views · {detail.project.likes} likes</p>
        </article>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Management</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
                Metadata and privacy
              </h2>
            </div>
          </div>

          <div className="mt-6">
            <ProjectManagementForm
              projectId={detail.project.id}
              initialName={detail.project.name}
              initialEmoji={detail.project.emoji}
              initialIsPrivate={detail.project.isPrivate}
              readOnly={Boolean(readOnlyReason)}
              readOnlyReason={readOnlyReason}
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Owner Snapshot</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Account context</h2>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm text-[#D6D8DA]">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Owner</p>
              <p className="mt-2 font-medium text-white">{detail.owner.name}</p>
              <p className="mt-1 text-[#A6A6A6]">{detail.owner.email}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Access</p>
              <p className="mt-2 font-medium text-white">
                {formatRoleLabel(detail.owner.role)} · {formatRoleLabel(detail.owner.accountStatus)}
              </p>
              <p className="mt-1 text-[#A6A6A6]">{formatSubscriptionTierLabel(detail.owner.tier)}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#A6A6A6]">Media Mix</p>
              <p className="mt-2 font-medium text-white">
                {formatNumber(detail.stats.imageCount)} images · {formatNumber(detail.stats.videoCount)} videos · {formatNumber(detail.stats.audioCount)} audio
              </p>
              <p className="mt-1 text-[#A6A6A6]">Updated {new Date(detail.project.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Conversation</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Recent chat log</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {detail.recentMessages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-sm text-[#A6A6A6]">
                No embedded project messages yet.
              </div>
            ) : (
              detail.recentMessages.map((message, index) => (
                <article key={`${message.createdAt.toISOString()}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <Badge variant="outline" className="border-white/10 text-[#D6D8DA]">
                      {formatRoleLabel(message.role)}
                    </Badge>
                    <p className="text-xs text-[#A6A6A6]">{new Date(message.createdAt).toLocaleString()}</p>
                  </div>
                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-[#D6D8DA]">{message.content}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
              <FileCode2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Recovery State</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Recent checkpoints</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {detail.recentCheckpoints.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-sm text-[#A6A6A6]">
                No checkpoints stored yet.
              </div>
            ) : (
              detail.recentCheckpoints.map((checkpoint) => (
                <article key={checkpoint.id} className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">Checkpoint #{checkpoint.seq}</p>
                      <p className="mt-1 text-sm text-[#A6A6A6]">
                        {formatRoleLabel(checkpoint.kind)} · {checkpoint.trigger}
                      </p>
                    </div>
                    <p className="text-xs text-[#A6A6A6]">{new Date(checkpoint.createdAt).toLocaleString()}</p>
                  </div>
                  {checkpoint.description ? (
                    <p className="mt-3 text-sm text-[#D6D8DA]">{checkpoint.description}</p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
              <Image className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Media</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Recent uploads</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {detail.recentMedia.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-sm text-[#A6A6A6]">
                No uploaded media for this project.
              </div>
            ) : (
              detail.recentMedia.map((media) => (
                <article key={media.id} className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{media.originalName}</p>
                      <p className="mt-1 text-sm text-[#A6A6A6]">
                        {formatRoleLabel(media.kind)} · {formatBytes(media.size)}
                      </p>
                    </div>
                    <a href={media.url} target="_blank" rel="noreferrer" className="text-sm text-[#7FD0FF] hover:text-white">
                      Open
                    </a>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/8 bg-[#0F1113] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#7FD0FF]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#A6A6A6]">Audit</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Recent admin actions</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {detail.recentAuditEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-sm text-[#A6A6A6]">
                No admin actions have been logged for this project yet.
              </div>
            ) : (
              detail.recentAuditEvents.map((event) => (
                <article key={event.id} className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">{event.action}</p>
                      <p className="mt-1 text-sm text-[#A6A6A6]">
                        {event.actorEmail} · {formatRoleLabel(event.actorRole)}
                      </p>
                    </div>
                    <p className="text-xs text-[#A6A6A6]">{new Date(event.createdAt).toLocaleString()}</p>
                  </div>
                  {event.reason ? <p className="mt-3 text-sm text-[#D6D8DA]">{event.reason}</p> : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}