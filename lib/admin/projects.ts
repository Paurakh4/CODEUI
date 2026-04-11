import "server-only"

import path from "node:path"
import { rm } from "node:fs/promises"
import connectDB from "@/lib/db"
import { createAdminAuditEntry } from "@/lib/admin/audit"
import {
  resolveAccountStatus,
  resolveUserRole,
  type AccountStatus,
  type UserRole,
} from "@/lib/admin/rbac"
import { AdminAuditLog, Checkpoint, MediaAsset, Project, User } from "@/lib/models"
import { TIERS, type SubscriptionTier } from "@/lib/pricing"
import type { AdminProjectsQuery } from "@/lib/admin/project-filters"

export interface AdminProjectsSummary {
  filteredProjects: number
  publicProjects: number
  privateProjects: number
  suspendedOwnerProjects: number
}

export interface AdminProjectListItem {
  id: string
  name: string
  emoji?: string
  isPrivate: boolean
  checkpointCount: number
  versionCount: number
  messageCount: number
  views: number
  likes: number
  mediaCount: number
  createdAt: Date
  updatedAt: Date
  owner: {
    id?: string
    name: string
    email: string
    role: UserRole
    accountStatus: AccountStatus
    tier: SubscriptionTier
  }
}

export interface AdminProjectsPage {
  projects: AdminProjectListItem[]
  pagination: {
    page: number
    pageSize: number
    totalProjects: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  summary: AdminProjectsSummary
  filters: AdminProjectsQuery
}

export interface AdminProjectDetail {
  project: {
    id: string
    name: string
    emoji?: string
    isPrivate: boolean
    htmlContentLength: number
    checkpointCount: number
    versionCount: number
    messageCount: number
    views: number
    likes: number
    createdAt: Date
    updatedAt: Date
  }
  owner: {
    id?: string
    name: string
    email: string
    role: UserRole
    accountStatus: AccountStatus
    tier: SubscriptionTier
  }
  stats: {
    mediaCount: number
    storageBytes: number
    imageCount: number
    videoCount: number
    audioCount: number
  }
  recentMessages: Array<{
    role: "user" | "assistant"
    content: string
    createdAt: Date
  }>
  recentCheckpoints: Array<{
    id: string
    seq: number
    kind: string
    trigger: string
    description?: string
    createdAt: Date
  }>
  recentMedia: Array<{
    id: string
    kind: string
    originalName: string
    size: number
    url: string
    createdAt: Date
  }>
  recentAuditEvents: Array<{
    id: string
    action: string
    actorEmail: string
    actorRole: string
    reason?: string
    createdAt: Date
  }>
}

export interface AdminProjectUpdateInput {
  name?: string
  emoji?: string
  isPrivate?: boolean
  reason: string
}

interface AdminActor {
  id: string
  email?: string | null
  role: UserRole
}

interface ProjectAggregateRow {
  _id: string
  name: string
  emoji?: string
  isPrivate: boolean
  checkpointCount: number
  views: number
  likes: number
  versionCount: number
  messageCount: number
  createdAt: Date
  updatedAt: Date
  owner?: {
    _id?: { toString(): string }
    name?: string
    email?: string
    role?: string
    accountStatus?: string
    subscription?: {
      tier?: SubscriptionTier
    }
  }
}

export class AdminProjectMutationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "AdminProjectMutationError"
    this.status = status
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildOwnerSummary(owner?: {
  _id?: { toString(): string }
  name?: string
  email?: string
  role?: string
  accountStatus?: string
  subscription?: { tier?: SubscriptionTier }
}) {
  return {
    id: owner?._id?.toString(),
    name: owner?.name || "Unknown user",
    email: owner?.email || "Unknown email",
    role: resolveUserRole(owner?.role, owner?.email),
    accountStatus: resolveAccountStatus(owner?.accountStatus),
    tier: (owner?.subscription?.tier || "free") as SubscriptionTier,
  }
}

function snapshotProjectForAudit(project: {
  _id: string
  name: string
  emoji?: string
  isPrivate: boolean
  checkpointCount?: number
  userId?: { toString(): string }
}) {
  return {
    name: project.name,
    emoji: project.emoji || "",
    isPrivate: Boolean(project.isPrivate),
    checkpointCount: project.checkpointCount ?? 0,
    ownerId: project.userId?.toString(),
  }
}

export async function getAdminProjectsPage(
  filters: AdminProjectsQuery,
): Promise<AdminProjectsPage> {
  await connectDB()

  const searchRegex = filters.search ? new RegExp(escapeRegex(filters.search), "i") : null
  const matchStage: Record<string, unknown> = {}

  if (filters.visibility === "public") {
    matchStage.isPrivate = false
  }

  if (filters.visibility === "private") {
    matchStage.isPrivate = true
  }

  if (filters.ownerRole !== "all") {
    matchStage["owner.role"] = filters.ownerRole
  }

  if (filters.ownerStatus !== "all") {
    matchStage["owner.accountStatus"] = filters.ownerStatus
  }

  if (searchRegex) {
    matchStage.$or = [
      { name: searchRegex },
      { "owner.name": searchRegex },
      { "owner.email": searchRegex },
    ]
  }

  const offset = (filters.page - 1) * filters.pageSize

  const [aggregateResult] = await Project.aggregate<{
    data: ProjectAggregateRow[]
    counts: Array<{ total: number }>
    privacy: Array<{ _id: boolean; count: number }>
    ownerStatuses: Array<{ _id: string | null; count: number }>
  }>([
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $unwind: {
        path: "$owner",
        preserveNullAndEmptyArrays: true,
      },
    },
    { $match: matchStage },
    {
      $facet: {
        data: [
          { $sort: { updatedAt: -1 } },
          { $skip: offset },
          { $limit: filters.pageSize },
          {
            $project: {
              _id: 1,
              name: 1,
              emoji: 1,
              isPrivate: 1,
              checkpointCount: 1,
              views: 1,
              likes: 1,
              createdAt: 1,
              updatedAt: 1,
              versionCount: { $size: { $ifNull: ["$versions", []] } },
              messageCount: { $size: { $ifNull: ["$messages", []] } },
              owner: {
                _id: "$owner._id",
                name: "$owner.name",
                email: "$owner.email",
                role: "$owner.role",
                accountStatus: "$owner.accountStatus",
                subscription: {
                  tier: "$owner.subscription.tier",
                },
              },
            },
          },
        ],
        counts: [{ $count: "total" }],
        privacy: [
          {
            $group: {
              _id: "$isPrivate",
              count: { $sum: 1 },
            },
          },
        ],
        ownerStatuses: [
          {
            $group: {
              _id: "$owner.accountStatus",
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ])

  const rows = aggregateResult?.data || []
  const projectIds = rows.map((row) => row._id)
  const mediaCountRows = projectIds.length
    ? await MediaAsset.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            projectId: { $in: projectIds },
          },
        },
        {
          $group: {
            _id: "$projectId",
            count: { $sum: 1 },
          },
        },
      ])
    : []

  const mediaCountMap = new Map(mediaCountRows.map((row) => [row._id, row.count]))
  const totalProjects = aggregateResult?.counts?.[0]?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalProjects / filters.pageSize))

  const publicProjects =
    aggregateResult?.privacy?.find((row) => row._id === false)?.count ?? 0
  const privateProjects =
    aggregateResult?.privacy?.find((row) => row._id === true)?.count ?? 0
  const suspendedOwnerProjects =
    aggregateResult?.ownerStatuses?.find((row) => row._id === "suspended")?.count ?? 0

  return {
    projects: rows.map((row) => ({
      id: row._id,
      name: row.name,
      emoji: row.emoji,
      isPrivate: Boolean(row.isPrivate),
      checkpointCount: row.checkpointCount ?? 0,
      versionCount: row.versionCount ?? 0,
      messageCount: row.messageCount ?? 0,
      views: row.views ?? 0,
      likes: row.likes ?? 0,
      mediaCount: mediaCountMap.get(row._id) ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      owner: buildOwnerSummary(row.owner),
    })),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalProjects,
      totalPages,
      hasPreviousPage: filters.page > 1,
      hasNextPage: filters.page < totalPages,
    },
    summary: {
      filteredProjects: totalProjects,
      publicProjects,
      privateProjects,
      suspendedOwnerProjects,
    },
    filters,
  }
}

export async function getAdminProjectDetail(
  projectId: string,
): Promise<AdminProjectDetail | null> {
  await connectDB()

  const project = await Project.findById(projectId).lean()
  if (!project) {
    return null
  }

  const owner = await User.findById(project.userId)
    .select("name email role accountStatus subscription.tier")
    .lean()

  const [mediaStatsRows, recentMedia, recentCheckpoints, recentAuditEvents] = await Promise.all([
    MediaAsset.aggregate<{
      _id: string
      count: number
      size: number
    }>([
      {
        $match: {
          projectId,
        },
      },
      {
        $group: {
          _id: "$kind",
          count: { $sum: 1 },
          size: { $sum: "$size" },
        },
      },
    ]),
    MediaAsset.find({ projectId })
      .select("kind originalName size url createdAt")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    Checkpoint.find({ projectId })
      .select("seq kind trigger description createdAt")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    AdminAuditLog.find({ targetType: "project", targetId: projectId })
      .select("action actorEmail actorRole reason createdAt")
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
  ])

  const storageBytes = mediaStatsRows.reduce((sum, row) => sum + (row.size ?? 0), 0)
  const imageCount = mediaStatsRows.find((row) => row._id === "image")?.count ?? 0
  const videoCount = mediaStatsRows.find((row) => row._id === "video")?.count ?? 0
  const audioCount = mediaStatsRows.find((row) => row._id === "audio")?.count ?? 0
  const mediaCount = mediaStatsRows.reduce((sum, row) => sum + (row.count ?? 0), 0)
  const recentMessages = (project.messages || []).slice(-8).reverse()

  return {
    project: {
      id: project._id.toString(),
      name: project.name,
      emoji: project.emoji,
      isPrivate: Boolean(project.isPrivate),
      htmlContentLength: project.htmlContent?.length ?? 0,
      checkpointCount: project.checkpointCount ?? 0,
      versionCount: project.versions?.length ?? 0,
      messageCount: project.messages?.length ?? 0,
      views: project.views ?? 0,
      likes: project.likes ?? 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    owner: buildOwnerSummary(owner || undefined),
    stats: {
      mediaCount,
      storageBytes,
      imageCount,
      videoCount,
      audioCount,
    },
    recentMessages: recentMessages.map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    })),
    recentCheckpoints: recentCheckpoints.map((checkpoint) => ({
      id: checkpoint._id.toString(),
      seq: checkpoint.seq,
      kind: checkpoint.kind,
      trigger: checkpoint.trigger,
      description: checkpoint.description,
      createdAt: checkpoint.createdAt,
    })),
    recentMedia: recentMedia.map((media) => ({
      id: media._id.toString(),
      kind: media.kind,
      originalName: media.originalName,
      size: media.size,
      url: media.url,
      createdAt: media.createdAt,
    })),
    recentAuditEvents: recentAuditEvents.map((entry) => ({
      id: entry._id.toString(),
      action: entry.action,
      actorEmail: entry.actorEmail,
      actorRole: entry.actorRole,
      reason: entry.reason,
      createdAt: entry.createdAt,
    })),
  }
}

export async function updateAdminProjectById(input: {
  projectId: string
  actor: AdminActor
  changes: AdminProjectUpdateInput
}) {
  await connectDB()

  const project = await Project.findById(input.projectId)
  if (!project) {
    throw new AdminProjectMutationError("Project not found", 404)
  }

  const before = snapshotProjectForAudit(project)

  if (input.changes.name !== undefined) {
    project.name = input.changes.name.trim()
  }

  if (input.changes.emoji !== undefined) {
    project.emoji = input.changes.emoji.trim() || "🎨"
  }

  if (input.changes.isPrivate !== undefined) {
    project.isPrivate = input.changes.isPrivate
  }

  await project.save()

  const after = snapshotProjectForAudit(project)

  await createAdminAuditEntry({
    actorUserId: input.actor.id,
    actorEmail: input.actor.email || "unknown@local",
    actorRole: input.actor.role,
    action: "admin.project.updated",
    permission: "admin:manage-projects",
    targetType: "project",
    targetId: project._id.toString(),
    reason: input.changes.reason,
    before,
    after,
    metadata: {
      updatedFields: Object.keys(input.changes).filter((field) => field !== "reason"),
    },
  })

  const detail = await getAdminProjectDetail(project._id.toString())
  if (!detail) {
    throw new AdminProjectMutationError("Updated project could not be reloaded", 500)
  }

  return detail
}

export async function deleteAdminProjectById(input: {
  projectId: string
  actor: AdminActor
  reason: string
}) {
  await connectDB()

  const project = await Project.findById(input.projectId)
  if (!project) {
    throw new AdminProjectMutationError("Project not found", 404)
  }

  const before = snapshotProjectForAudit(project)
  const ownerId = project.userId.toString()
  const storageDir = path.join(process.cwd(), "public", "uploads", ownerId, project._id)

  await Promise.all([
    Project.deleteOne({ _id: project._id }),
    Checkpoint.deleteMany({ projectId: project._id }),
    MediaAsset.deleteMany({ projectId: project._id }),
    rm(storageDir, { recursive: true, force: true }).catch(() => undefined),
  ])

  await createAdminAuditEntry({
    actorUserId: input.actor.id,
    actorEmail: input.actor.email || "unknown@local",
    actorRole: input.actor.role,
    action: "admin.project.deleted",
    permission: "admin:manage-projects",
    targetType: "project",
    targetId: project._id.toString(),
    reason: input.reason,
    before,
    metadata: {
      ownerId,
      storagePath: storageDir,
    },
  })

  return {
    id: project._id.toString(),
    name: project.name,
  }
}

export function formatSubscriptionTierLabel(tier: SubscriptionTier) {
  return TIERS[tier]?.name || "Free"
}