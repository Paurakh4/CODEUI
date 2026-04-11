import "server-only"

import connectDB from "@/lib/db"
import { AdminAuditLog } from "@/lib/models"
import type { AdminAuditQuery } from "@/lib/admin/audit-filters"

export interface AdminAuditEntry {
  id: string
  action: string
  actorEmail: string
  actorRole: string
  permission?: string
  targetType: string
  targetId?: string
  reason?: string
  createdAt: Date
  metadata?: Record<string, unknown>
}

export interface AdminAuditPageData {
  entries: AdminAuditEntry[]
  pagination: {
    page: number
    pageSize: number
    totalEntries: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  summary: {
    filteredEvents: number
    userTargets: number
    projectTargets: number
    modelPolicyTargets: number
  }
  filters: AdminAuditQuery
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function getAdminAuditPageData(
  filters: AdminAuditQuery,
): Promise<AdminAuditPageData> {
  await connectDB()

  const query: Record<string, unknown> = {}

  if (filters.search) {
    const regex = new RegExp(escapeRegex(filters.search), "i")
    query.$or = [
      { action: regex },
      { actorEmail: regex },
      { actorRole: regex },
      { permission: regex },
      { targetType: regex },
      { targetId: regex },
      { reason: regex },
    ]
  }

  if (filters.targetType !== "all") {
    query.targetType = filters.targetType
  }

  const totalEntriesPromise = AdminAuditLog.countDocuments(query)
  const userTargetsPromise = AdminAuditLog.countDocuments({ ...query, targetType: "user" })
  const projectTargetsPromise = AdminAuditLog.countDocuments({ ...query, targetType: "project" })
  const modelPolicyTargetsPromise = AdminAuditLog.countDocuments({
    ...query,
    targetType: "model-policy",
  })

  const offset = (filters.page - 1) * filters.pageSize
  const entries = await AdminAuditLog.find(query)
    .select("action actorEmail actorRole permission targetType targetId reason metadata createdAt")
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(filters.pageSize)
    .lean()

  const [totalEntries, userTargets, projectTargets, modelPolicyTargets] = await Promise.all([
    totalEntriesPromise,
    userTargetsPromise,
    projectTargetsPromise,
    modelPolicyTargetsPromise,
  ])

  const totalPages = Math.max(1, Math.ceil(totalEntries / filters.pageSize))

  return {
    entries: entries.map((entry) => ({
      id: entry._id.toString(),
      action: entry.action,
      actorEmail: entry.actorEmail,
      actorRole: entry.actorRole,
      permission: entry.permission,
      targetType: entry.targetType,
      targetId: entry.targetId,
      reason: entry.reason,
      createdAt: entry.createdAt,
      metadata: entry.metadata as Record<string, unknown> | undefined,
    })),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalEntries,
      totalPages,
      hasPreviousPage: filters.page > 1,
      hasNextPage: filters.page < totalPages,
    },
    summary: {
      filteredEvents: totalEntries,
      userTargets,
      projectTargets,
      modelPolicyTargets,
    },
    filters,
  }
}