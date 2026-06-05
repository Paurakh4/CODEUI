import {
  ALL_MODELS,
  CODEUI_GOD_MODE_MODEL_ID,
  resolveModelSourceProvider,
  type AIModel,
  type ModelSourceProvider,
} from "@/lib/ai-models"

export interface ModelCatalogEntryInput {
  id?: string | null
  name?: string | null
  provider?: string | null
  sourceProvider?: ModelSourceProvider | null
  description?: string | null
  contextLength?: number | null
  supportsReasoning?: boolean | null
  isFast?: boolean | null
  isNewModel?: boolean | null
  isNew?: boolean | null
}

function resolveNewBadgeFlag(candidate: ModelCatalogEntryInput, baseModel?: AIModel) {
  if (typeof candidate.isNewModel === "boolean") {
    return candidate.isNewModel
  }

  if (typeof candidate.isNew === "boolean") {
    return candidate.isNew
  }

  return baseModel?.isNewModel
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : undefined
}

function normalizeContextLength(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined
  }

  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : undefined
}

export function resolveModelCatalog(
  candidateModels?: readonly ModelCatalogEntryInput[] | null,
  baseModels: readonly AIModel[] = ALL_MODELS,
) {
  const baseById = new Map(baseModels.map((model) => [model.id, model]))
  const candidateById = new Map<string, AIModel>()

  for (const candidate of candidateModels || []) {
    const id = normalizeText(candidate.id)
    if (!id) {
      continue
    }

    const baseModel = baseById.get(id)
    const name = normalizeText(candidate.name) ?? baseModel?.name
    const provider = normalizeText(candidate.provider) ?? baseModel?.provider
    const sourceProvider = candidate.sourceProvider ?? baseModel?.sourceProvider
    const contextLength = normalizeContextLength(candidate.contextLength) ?? baseModel?.contextLength

    if (!name || !provider || !contextLength) {
      continue
    }

    const description = normalizeText(candidate.description) ?? baseModel?.description
    candidateById.set(id, {
      id,
      name,
      provider,
      sourceProvider: resolveModelSourceProvider({ provider, sourceProvider }),
      description,
      contextLength,
      supportsReasoning:
        typeof candidate.supportsReasoning === "boolean"
          ? candidate.supportsReasoning
          : baseModel?.supportsReasoning,
      isFast:
        typeof candidate.isFast === "boolean"
          ? candidate.isFast
          : baseModel?.isFast,
      isNewModel: resolveNewBadgeFlag(candidate, baseModel),
    })
  }

  const baseIds = new Set(baseModels.map((model) => model.id))
  const resolvedBaseModels = baseModels.map((model) => candidateById.get(model.id) ?? model)
  const customModels = Array.from(candidateById.values()).filter((model) => !baseIds.has(model.id))

  return [...resolvedBaseModels, ...customModels]
}

export function sanitizeEnabledModelIds(
  candidateIds?: readonly string[] | null,
  fallbackIds?: readonly string[] | null,
  knownModelIds: readonly string[] = ALL_MODELS.map((model) => model.id),
) {
  const knownModelIdSet = new Set(knownModelIds)
  const normalized = (candidateIds || [])
    .map((modelId) => modelId.trim())
    .filter((modelId) => modelId.length > 0 && knownModelIdSet.has(modelId))

  if (normalized.length > 0) {
    return Array.from(new Set(normalized))
  }

  const fallback = (fallbackIds || [])
    .map((modelId) => modelId.trim())
    .filter((modelId) => modelId.length > 0 && knownModelIdSet.has(modelId))

  if (fallback.length > 0) {
    return Array.from(new Set(fallback))
  }

  return Array.from(new Set(knownModelIds.map((modelId) => modelId.trim()).filter((modelId) => modelId.length > 0)))
}

export function resolveDefaultModelId(
  candidateDefaultModelId: string | null | undefined,
  enabledModelIds: readonly string[],
  fallbackDefaultModelId?: string | null,
) {
  const enabledSet = new Set(enabledModelIds)
  const normalizedCandidate = candidateDefaultModelId?.trim()
  const normalizedFallbackCandidate = fallbackDefaultModelId?.trim()

  if (normalizedCandidate && enabledSet.has(normalizedCandidate)) {
    return normalizedCandidate
  }

  if (normalizedFallbackCandidate && enabledSet.has(normalizedFallbackCandidate)) {
    return normalizedFallbackCandidate
  }

  if (enabledSet.has(CODEUI_GOD_MODE_MODEL_ID)) {
    return CODEUI_GOD_MODE_MODEL_ID
  }

  return enabledModelIds[0] || CODEUI_GOD_MODE_MODEL_ID
}
