import "server-only"

import connectDB from "@/lib/db"
import {
  ALL_MODELS,
  buildModelFallbackChain,
  getConfiguredEnabledModelIds,
  getConfiguredDefaultModelId,
  synthesizeAIModelFromId,
  type AIModel,
} from "@/lib/ai-models"
import { createAdminAuditEntry } from "@/lib/admin/audit"
import { AdminModelConfig } from "@/lib/models"
import {
  resolveModelCatalog,
  resolveDefaultModelId,
  sanitizeEnabledModelIds,
  type ModelCatalogEntryInput,
} from "@/lib/admin/model-policy-utils"
import type { UserRole } from "@/lib/admin/rbac"

const ADMIN_MODEL_CONFIG_ID = "global"
const BASE_MODEL_ID_SET = new Set(ALL_MODELS.map((model) => model.id))

export interface AdminModelCatalogEntry extends AIModel {
  enabled: boolean
  isDefault: boolean
  envEnabled: boolean
  isCustom: boolean
}

interface AdminActor {
  id: string
  email?: string | null
  role: UserRole
}

function normalizePersistedModels(
  models?: readonly ModelCatalogEntryInput[] | null,
) {
  let changed = false

  const normalizedModels = (models || []).map((model) => {
    if (typeof model?.isNewModel === "boolean" || typeof model?.isNew !== "boolean") {
      return model
    }

    changed = true
    const { isNew, ...rest } = model
    return {
      ...rest,
      isNewModel: isNew,
    }
  })

  return {
    changed,
    models: normalizedModels,
  }
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
  models: AIModel[]
  enabledModelIds: string[]
  defaultModelId: string
  persistedModelIds: ReadonlySet<string>
}) {
  const enabledSet = new Set(input.enabledModelIds)
  const envEnabledSet = new Set(getConfiguredEnabledModelIds())

  return {
    enabledModelIds: input.enabledModelIds,
    defaultModelId: input.defaultModelId,
    models: input.models.map((model) => ({
      ...model,
      enabled: enabledSet.has(model.id),
      isDefault: model.id === input.defaultModelId,
      envEnabled: envEnabledSet.has(model.id),
      // A model is "custom" only when an admin persisted it via the dashboard.
      // Env-sourced models aren't deletable from the UI because the env var
      // would just re-add them on the next reload.
      isCustom:
        !BASE_MODEL_ID_SET.has(model.id) && input.persistedModelIds.has(model.id),
    })),
  }
}

/**
 * Build a base model list that includes every entry from `ALL_MODELS` plus
 * any env-configured model id that lacks a hardcoded record. This makes the
 * admin catalog automatically reflect models added via `ENABLED_AI_MODELS`.
 */
function mergeEnvSynthesizedModels(
  baseModels: readonly AIModel[],
  envEnabledIds: readonly string[],
): AIModel[] {
  const byId = new Map(baseModels.map((model) => [model.id, model]))

  for (const id of envEnabledIds) {
    if (byId.has(id)) continue
    const synthetic = synthesizeAIModelFromId(id)
    if (synthetic) {
      byId.set(synthetic.id, synthetic)
    }
  }

  return Array.from(byId.values())
}

export async function getAdminModelCatalog() {
  await connectDB()

  const config = await AdminModelConfig.findById(ADMIN_MODEL_CONFIG_ID).lean()
  const normalizedPersistedModels = normalizePersistedModels(config?.models)

  if (config && normalizedPersistedModels.changed) {
    await AdminModelConfig.findByIdAndUpdate(ADMIN_MODEL_CONFIG_ID, {
      $set: {
        models: normalizedPersistedModels.models,
      },
    })
  }

  const envEnabledIds = getConfiguredEnabledModelIds()
  const baseModels = mergeEnvSynthesizedModels(ALL_MODELS, envEnabledIds)
  const models = resolveModelCatalog(normalizedPersistedModels.models, baseModels)
  const knownModelIds = models.map((model) => model.id)

  const persistedModelIds = new Set(
    (normalizedPersistedModels.models || [])
      .map((model) => (typeof model?.id === "string" ? model.id.trim() : ""))
      .filter((id) => id.length > 0),
  )

  const sanitizedAdminEnabledIds = sanitizeEnabledModelIds(
    config?.enabledModelIds,
    envEnabledIds,
    knownModelIds,
  )

  // Env-only models (not part of the hardcoded base list and not persisted by
  // an admin) are auto-enabled so adding an id to ENABLED_AI_MODELS surfaces
  // it instantly in the dashboard and dropdown without an admin save step.
  const envOnlyEnabledIds = envEnabledIds.filter(
    (id) => !BASE_MODEL_ID_SET.has(id) && !persistedModelIds.has(id),
  )
  const enabledModelIds = Array.from(
    new Set([...sanitizedAdminEnabledIds, ...envOnlyEnabledIds]),
  ).filter((id) => knownModelIds.includes(id))

  const defaultModelId = resolveDefaultModelId(
    config?.defaultModelId,
    enabledModelIds,
    getConfiguredDefaultModelId(),
  )

  return {
    ...buildCatalogSnapshot({ models, enabledModelIds, defaultModelId, persistedModelIds }),
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

export async function getRuntimeModelById(modelId: string) {
  const catalog = await getPublicModelCatalog()
  return catalog.models.find((model) => model.id === modelId)
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

  return buildModelFallbackChain({
    enabledModels: enabled,
    defaultModelId: catalog.defaultModelId,
    primaryModelId,
  })
}

export async function upsertAdminModelPolicy(input: {
  actor: AdminActor
  models: ModelCatalogEntryInput[]
  enabledModelIds: string[]
  defaultModelId: string
  reason: string
}) {
  await connectDB()

  const currentConfig = await AdminModelConfig.findById(ADMIN_MODEL_CONFIG_ID).lean()
  const normalizedPersistedModels = normalizePersistedModels(currentConfig?.models)

  if (currentConfig && normalizedPersistedModels.changed) {
    await AdminModelConfig.findByIdAndUpdate(ADMIN_MODEL_CONFIG_ID, {
      $set: {
        models: normalizedPersistedModels.models,
      },
    })
  }

  const envEnabledIds = getConfiguredEnabledModelIds()
  const envEnabledIdSet = new Set(envEnabledIds)
  const baseModels = mergeEnvSynthesizedModels(ALL_MODELS, envEnabledIds)
  const currentModels = resolveModelCatalog(normalizedPersistedModels.models, baseModels)
  const currentEnabledModelIds = sanitizeEnabledModelIds(
    currentConfig?.enabledModelIds,
    envEnabledIds,
    currentModels.map((model) => model.id),
  )
  const currentDefaultModelId = resolveDefaultModelId(
    currentConfig?.defaultModelId,
    currentEnabledModelIds,
    getConfiguredDefaultModelId(),
  )

  const previouslyPersistedIds = new Set(
    (normalizedPersistedModels.models || [])
      .map((model) => (typeof model?.id === "string" ? model.id.trim() : ""))
      .filter((id) => id.length > 0),
  )

  const nextModels = resolveModelCatalog(input.models, baseModels)
  if (nextModels.length === 0) {
    throw new AdminModelPolicyMutationError("At least one model must be configured.")
  }

  // Keep env-only models out of the persisted set so changes to
  // ENABLED_AI_MODELS continue to flow through automatically. Anything an
  // admin already persisted (or any base model the admin edited) is kept.
  const modelsToPersist = nextModels.filter((model) => {
    if (BASE_MODEL_ID_SET.has(model.id)) return true
    if (previouslyPersistedIds.has(model.id)) return true
    return !envEnabledIdSet.has(model.id)
  })

  const nextEnabledModelIds = sanitizeEnabledModelIds(
    input.enabledModelIds,
    currentEnabledModelIds,
    nextModels.map((model) => model.id),
  )
  if (nextEnabledModelIds.length === 0) {
    throw new AdminModelPolicyMutationError("At least one model must remain enabled.")
  }

  const nextDefaultModelId = resolveDefaultModelId(
    input.defaultModelId,
    nextEnabledModelIds,
    getConfiguredDefaultModelId(),
  )

  const before = buildCatalogSnapshot({
    models: currentModels,
    enabledModelIds: currentEnabledModelIds,
    defaultModelId: currentDefaultModelId,
    persistedModelIds: previouslyPersistedIds,
  })

  await AdminModelConfig.findByIdAndUpdate(
    ADMIN_MODEL_CONFIG_ID,
    {
      $set: {
        models: modelsToPersist,
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

  const persistedModelIdsAfterSave = new Set(
    modelsToPersist.map((model) => model.id),
  )
  const after = buildCatalogSnapshot({
    models: nextModels,
    enabledModelIds: nextEnabledModelIds,
    defaultModelId: nextDefaultModelId,
    persistedModelIds: persistedModelIdsAfterSave,
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
      totalModelCount: nextModels.length,
      defaultModelId: nextDefaultModelId,
    },
  })

  return getAdminModelCatalog()
}