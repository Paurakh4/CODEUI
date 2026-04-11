import "server-only"

import type { AdminPermission, UserRole } from "@/lib/admin/rbac"
import { AdminAuditLog } from "@/lib/models"

interface CreateAdminAuditEntryInput {
  actorUserId: string
  actorEmail: string
  actorRole: UserRole
  action: string
  permission?: AdminPermission
  targetType: string
  targetId?: string
  reason?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export async function createAdminAuditEntry(input: CreateAdminAuditEntryInput) {
  return AdminAuditLog.create({
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    actorRole: input.actorRole,
    action: input.action,
    permission: input.permission,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    before: input.before,
    after: input.after,
    metadata: input.metadata,
  })
}