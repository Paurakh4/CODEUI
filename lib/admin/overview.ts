import "server-only"

import connectDB from "@/lib/db"
import { getPublicModelCatalog } from "@/lib/admin/model-policies"
import {
  AdminAuditLog,
  Checkpoint,
  MediaAsset,
  Project,
  UsageLog,
  User,
} from "@/lib/models"
import { resolveAccountStatus, resolveUserRole } from "@/lib/admin/rbac"

export interface AdminOverviewSnapshot {
  metrics: {
    totalUsers: number
    newUsers7d: number
    activeUsers7d: number
    paidUsers: number
    totalProjects: number
    totalMediaAssets: number
    totalCheckpoints: number
    prompts24h: number
    totalUsageLogs: number
    totalStorageBytes: number
    enabledModels: number
    auditLogEntries: number
  }
  subscriptionBreakdown: Record<"free" | "pro" | "proplus", number>
  topModels: Array<{
    modelId: string
    count: number
  }>
  recentUsers: Array<{
    id: string
    name: string
    email: string
    role: string
    accountStatus: string
    tier: string
    createdAt: Date
  }>
  recentProjects: Array<{
    id: string
    name: string
    ownerName: string
    ownerEmail: string
    isPrivate: boolean
    updatedAt: Date
  }>
  recentAuditEvents: Array<{
    id: string
    action: string
    actorEmail: string
    actorRole: string
    targetType: string
    reason?: string
    createdAt: Date
  }>
}

export async function getAdminOverviewSnapshot(): Promise<AdminOverviewSnapshot> {
  await connectDB()
  const publicModelCatalogPromise = getPublicModelCatalog()

  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const twentyFourHoursAgo = new Date(now)
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

  const [
    totalUsers,
    newUsers7d,
    activeUserIds,
    paidUsers,
    totalProjects,
    totalMediaAssets,
    totalCheckpoints,
    prompts24h,
    totalUsageLogs,
    storageRows,
    subscriptionRows,
    topModelRows,
    recentUsersRaw,
    recentProjectsRaw,
    recentAuditRows,
    auditLogEntries,
    publicModelCatalog,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    UsageLog.distinct("userId", { timestamp: { $gte: sevenDaysAgo } }),
    User.countDocuments({ "subscription.tier": { $in: ["pro", "proplus"] } }),
    Project.countDocuments({}),
    MediaAsset.countDocuments({}),
    Checkpoint.countDocuments({}),
    UsageLog.countDocuments({ timestamp: { $gte: twentyFourHoursAgo } }),
    UsageLog.countDocuments({}),
    MediaAsset.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: "$size" } } },
    ]),
    User.aggregate<{ _id: "free" | "pro" | "proplus"; count: number }>([
      {
        $group: {
          _id: "$subscription.tier",
          count: { $sum: 1 },
        },
      },
    ]),
    UsageLog.aggregate<{ _id: string; count: number }>([
      {
        $group: {
          _id: "$aiModel",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    User.find({})
      .select("name email role accountStatus subscription.tier createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Project.find({})
      .select("_id name userId isPrivate updatedAt")
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),
    AdminAuditLog.find({})
      .select("action actorEmail actorRole targetType reason createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    AdminAuditLog.countDocuments({}),
    publicModelCatalogPromise,
  ])

  const subscriptionBreakdown: Record<"free" | "pro" | "proplus", number> = {
    free: 0,
    pro: 0,
    proplus: 0,
  }

  subscriptionRows.forEach((row) => {
    if (row._id in subscriptionBreakdown) {
      subscriptionBreakdown[row._id] = row.count
    }
  })

  const ownerIds = recentProjectsRaw.map((project) => project.userId.toString())
  const owners = await User.find({ _id: { $in: ownerIds } })
    .select("name email")
    .lean()

  const ownerMap = new Map(
    owners.map((owner) => [owner._id.toString(), owner]),
  )

  return {
    metrics: {
      totalUsers,
      newUsers7d,
      activeUsers7d: activeUserIds.length,
      paidUsers,
      totalProjects,
      totalMediaAssets,
      totalCheckpoints,
      prompts24h,
      totalUsageLogs,
      totalStorageBytes: storageRows[0]?.total ?? 0,
      enabledModels: publicModelCatalog.models.length,
      auditLogEntries,
    },
    subscriptionBreakdown,
    topModels: topModelRows.map((row) => ({
      modelId: row._id,
      count: row.count,
    })),
    recentUsers: recentUsersRaw.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: resolveUserRole(user.role, user.email),
      accountStatus: resolveAccountStatus(user.accountStatus),
      tier: user.subscription?.tier || "free",
      createdAt: user.createdAt,
    })),
    recentProjects: recentProjectsRaw.map((project) => {
      const owner = ownerMap.get(project.userId.toString())

      return {
        id: project._id.toString(),
        name: project.name,
        ownerName: owner?.name || "Unknown user",
        ownerEmail: owner?.email || "Unknown email",
        isPrivate: Boolean(project.isPrivate),
        updatedAt: project.updatedAt,
      }
    }),
    recentAuditEvents: recentAuditRows.map((event) => ({
      id: event._id.toString(),
      action: event.action,
      actorEmail: event.actorEmail,
      actorRole: event.actorRole,
      targetType: event.targetType,
      reason: event.reason,
      createdAt: event.createdAt,
    })),
  }
}