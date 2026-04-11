import "server-only"

import connectDB from "@/lib/db"
import {
  ALL_MODELS,
  getConfiguredEnabledModelIds,
  type AIModel,
} from "@/lib/ai-models"
import { createAdminAuditEntry } from "@/lib/admin/audit"
import { AdminModelConfig } from "@/lib/models"
import {
  resolveDefaultModelId,
  sanitizeEnabledModelIds,
} from "@/lib/admin/model-policy-utils"
import type { UserRole } from "@/lib/admin/rbac"

const ADMIN_MODEL_CONFIG_ID = "global"

export interface AdminModelCatalogEntry extends AIModel {
  enabled: boolean
  isDefault: boolean
  envEnabled: boolean
}

interface AdminActor {
  id: string
  email?: string | null
  role: UserRole
}

export class AdminModelPolicyMutationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "AdminModelPolicyMutationError"
    this.status = status
  }
}

function buildCatalogSnapshot(input: {
  enabledModelIds: string[]
  defaultModelId: string
}) {
  const enabledSet = new Set(input.enabledModelIds)
  const envEnabledSet = new Set(getConfiguredEnabledModelIds())

  return {
    enabledModelIds: input.enabledModelIds,
    defaultModelId: input.defaultModelId,
    models: ALL_MODELS.map((model) => ({
      ...model,
      enabled: enabledSet.has(model.id),
      isDefault: model.id === input.defaultModelId,
      envEnabled: envEnabledSet.has(model.id),
    })),
  }
}

export async function getAdminModelCatalog() {
  await connectDB()

  const config = await AdminModelConfig.findById(ADMIN_MODEL_CONFIG_ID).lean()
  const enabledModelIds = sanitizeEnabledModelIds(
    config?.enabledModelIds,
    getConfiguredEnabledModelIds(),
  )
  const defaultModelId = resolveDefaultModelId(config?.defaultModelId, enabledModelIds)

  return {
    ...buildCatalogSnapshot({ enabledModelIds, defaultModelId }),
    updatedAt: config?.updatedAt ?? null,
    updatedByEmail: config?.updatedByEmail ?? null,
  }
}

export async function getPublicModelCatalog() {
  const catalog = await getAdminModelCatalog()

  return {
    defaultModelId: catalog.defaultModelId,
    models: catalog.models.filter((model) => model.enabled),
  }
}

export async function isRuntimeModelEnabled(modelId: string) {
  const catalog = await getPublicModelCatalog()
  return catalog.models.some((model) => model.id === modelId)
}

export async function getRuntimeDefaultModelId() {
  const catalog = await getPublicModelCatalog()
  return catalog.defaultModelId
}

export async function getRuntimeModelFallbackChain(primaryModelId?: string) {
  const catalog = await getPublicModelCatalog()
  const enabled = catalog.models

  if (enabled.length === 0) {
    return []
  }

  const byId = new Map(enabled.map((model) => [model.id, model]))
  const resolvedPrimary = primaryModelId && byId.has(primaryModelId)
    ? primaryModelId
    : catalog.defaultModelId
  const chain: string[] = []
  const seen = new Set<string>()

  const pushIfEnabled = (modelId?: string) => {
    if (!modelId || seen.has(modelId) || !byId.has(modelId)) {
      return
    }

    seen.add(modelId)
    chain.push(modelId)
  }

  pushIfEnabled(resolvedPrimary)
  pushIfEnabled(catalog.defaultModelId)

  const primaryProvider = byId.get(resolvedPrimary)?.provider

  enabled
    .filter((model) => model.provider !== primaryProvider)
    .forEach((model) => pushIfEnabled(model.id))

  enabled.forEach((model) => pushIfEnabled(model.id))

  return chain
}

export async function upsertAdminModelPolicy(input: {
  actor: AdminActor
  enabledModelIds: string[]
  defaultModelId: string
  reason: string
}) {
  await connectDB()

  const currentConfig = await AdminModelConfig.findById(ADMIN_MODEL_CONFIG_ID).lean()
  const currentEnabledModelIds = sanitizeEnabledModelIds(
    currentConfig?.enabledModelIds,
    getConfiguredEnabledModelIds(),
  )
  const currentDefaultModelId = resolveDefaultModelId(
    currentConfig?.defaultModelId,
    currentEnabledModelIds,
  )

  const nextEnabledModelIds = sanitizeEnabledModelIds(input.enabledModelIds, currentEnabledModelIds)
  if (nextEnabledModelIds.length === 0) {
    throw new AdminModelPolicyMutationError("At least one model must remain enabled.")
  }

  const nextDefaultModelId = resolveDefaultModelId(input.defaultModelId, nextEnabledModelIds)
  const before = buildCatalogSnapshot({
    enabledModelIds: currentEnabledModelIds,
    defaultModelId: currentDefaultModelId,
  })

  await AdminModelConfig.findByIdAndUpdate(
    ADMIN_MODEL_CONFIG_ID,
    {
      $set: {
        enabledModelIds: nextEnabledModelIds,
        defaultModelId: nextDefaultModelId,
        updatedByUserId: input.actor.id,
        updatedByEmail: input.actor.email || "unknown@local",
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  )

  const after = buildCatalogSnapshot({
    enabledModelIds: nextEnabledModelIds,
    defaultModelId: nextDefaultModelId,
  })

  await createAdminAuditEntry({
    actorUserId: input.actor.id,
    actorEmail: input.actor.email || "unknown@local",
    actorRole: input.actor.role,
    action: "admin.models.updated",
    permission: "admin:manage-models",
    targetType: "model-policy",
    targetId: ADMIN_MODEL_CONFIG_ID,
    reason: input.reason,
    before,
    after,
    metadata: {
      enabledCount: nextEnabledModelIds.length,
      defaultModelId: nextDefaultModelId,
    },
  })

  return getAdminModelCatalog()
}