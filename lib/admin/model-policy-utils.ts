import { ALL_MODELS, CODEUI_GOD_MODE_MODEL_ID } from "@/lib/ai-models"

const KNOWN_MODEL_IDS = new Set(ALL_MODELS.map((model) => model.id))

export function sanitizeEnabledModelIds(
  candidateIds?: readonly string[] | null,
  fallbackIds?: readonly string[] | null,
) {
  const normalized = (candidateIds || [])
    .map((modelId) => modelId.trim())
    .filter((modelId) => modelId.length > 0 && KNOWN_MODEL_IDS.has(modelId))

  if (normalized.length > 0) {
    return Array.from(new Set(normalized))
  }

  const fallback = (fallbackIds || [])
    .map((modelId) => modelId.trim())
    .filter((modelId) => modelId.length > 0 && KNOWN_MODEL_IDS.has(modelId))

  if (fallback.length > 0) {
    return Array.from(new Set(fallback))
  }

  return ALL_MODELS.map((model) => model.id)
}

export function resolveDefaultModelId(
  candidateDefaultModelId: string | null | undefined,
  enabledModelIds: readonly string[],
) {
  const enabledSet = new Set(enabledModelIds)
  const normalizedCandidate = candidateDefaultModelId?.trim()

  if (normalizedCandidate && enabledSet.has(normalizedCandidate)) {
    return normalizedCandidate
  }

  if (enabledSet.has(CODEUI_GOD_MODE_MODEL_ID)) {
    return CODEUI_GOD_MODE_MODEL_ID
  }

  return enabledModelIds[0] || CODEUI_GOD_MODE_MODEL_ID
}