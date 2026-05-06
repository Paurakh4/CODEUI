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
import { StatCard } from "@/components/admin/stat-card"
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
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const normalized = bytes / 1024 ** index
  return `${normalized.toFixed(normalized >= 100 || index === 0 ? 0 : 1)} ${units[index]}`
}

export default async function AdminProjectDetailPage({ params }: ProjectDetailPageProps) {
  const session = await requireAdminPage("admin:view-projects")
  const { id } = await params
  const detail = await getAdminProjectDetail(id)

  if (!detail) notFound()

  const canManageProjects = hasAdminPermission({
    role: session.user.role,
    permission: "admin:manage-projects",
    resolvedPermissions: session.user.permissions,
  })
  const readOnlyReason = !canManageProjects
    ? "Your role can review projects but cannot modify or delete them."
    : undefined

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {detail.project.emoji || "🎨"} {detail.project.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Owned by {detail.owner.name} · {detail.owner.email}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={detail.project.isPrivate ? "secondary" : "outline"}>
            {detail.project.isPrivate ? "Private" : "Public"}
          </Badge>
          <Badge variant="secondary">{formatRoleLabel(detail.owner.role)}</Badge>
          <Badge variant="outline">{formatSubscriptionTierLabel(detail.owner.tier)}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          title="Messages"
          value={formatNumber(detail.project.messageCount)}
          icon={MessageSquareText}
        />
        <StatCard
          title="Checkpoints"
          value={formatNumber(detail.project.checkpointCount)}
          description={`${formatNumber(detail.project.versionCount)} legacy versions`}
        />
        <StatCard
          title="Media"
          value={formatNumber(detail.stats.mediaCount)}
          description={formatBytes(detail.stats.storageBytes)}
          icon={Image}
        />
        <StatCard
          title="HTML Size"
          value={formatBytes(detail.project.htmlContentLength)}
          description={`${detail.project.views} views · ${detail.project.likes} likes`}
          icon={FileCode2}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Management</p>
              <h2 className="text-sm font-medium">Metadata and privacy</h2>
            </div>
          </div>
          <div className="mt-5">
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

        <section className="rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Owner Snapshot</p>
              <h2 className="text-sm font-medium">Account context</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground">Owner</p>
              <p className="mt-1 font-medium">{detail.owner.name}</p>
              <p className="text-sm text-muted-foreground">{detail.owner.email}</p>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground">Access</p>
              <p className="mt-1 font-medium">
                {formatRoleLabel(detail.owner.role)} · {detail.owner.accountStatus}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatSubscriptionTierLabel(detail.owner.tier)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground">Media Mix</p>
              <p className="mt-1 font-medium">
                {formatNumber(detail.stats.imageCount)} images ·{" "}
                {formatNumber(detail.stats.videoCount)} videos ·{" "}
                {formatNumber(detail.stats.audioCount)} audio
              </p>
              <p className="text-sm text-muted-foreground">
                Updated {new Date(detail.project.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <MessageSquareText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Conversation</p>
              <h2 className="text-sm font-medium">Recent chat log</h2>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {detail.recentMessages.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No embedded project messages yet.
              </div>
            ) : (
              detail.recentMessages.map((message, index) => (
                <div
                  key={`${message.createdAt.toISOString()}-${index}`}
                  className="rounded-lg border bg-muted/50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <Badge variant="outline" className="text-[10px]">
                      {message.role}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {new Date(message.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm">
                    {message.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <FileCode2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Recovery State</p>
              <h2 className="text-sm font-medium">Recent checkpoints</h2>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {detail.recentCheckpoints.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No checkpoints stored yet.
              </div>
            ) : (
              detail.recentCheckpoints.map((checkpoint) => (
                <div
                  key={checkpoint.id}
                  className="rounded-lg border bg-muted/50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Checkpoint #{checkpoint.seq}</p>
                      <p className="text-xs text-muted-foreground">
                        {checkpoint.kind} · {checkpoint.trigger}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(checkpoint.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {checkpoint.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{checkpoint.description}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <Image className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Media</p>
              <h2 className="text-sm font-medium">Recent uploads</h2>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {detail.recentMedia.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No uploaded media for this project.
              </div>
            ) : (
              detail.recentMedia.map((media) => (
                <div
                  key={media.id}
                  className="rounded-lg border bg-muted/50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{media.originalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {media.kind} · {formatBytes(media.size)}
                      </p>
                    </div>
                    <a
                      href={media.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-foreground transition-colors hover:text-primary"
                    >
                      Open
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Audit</p>
              <h2 className="text-sm font-medium">Recent admin actions</h2>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {detail.recentAuditEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No admin actions have been logged for this project yet.
              </div>
            ) : (
              detail.recentAuditEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg border bg-muted/50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{event.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.actorEmail} · {event.actorRole}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {event.reason ? (
                    <p className="mt-2 text-sm text-muted-foreground">{event.reason}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
