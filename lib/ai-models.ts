/**
 * AI Model Configuration
 * 
 * This file contains the single source of truth for all supported AI models.
 * Models can be enabled/disabled via environment variables.
 */

export interface AIModel {
  id: string
  name: string
  provider: string
  description?: string
  contextLength: number
  supportsReasoning?: boolean
  isFast?: boolean
  isNewModel?: boolean
}

export const CODEUI_GOD_MODE_MODEL_ID = "google/gemini-3-flash-preview"

// All available models (master list)
const ALL_MODELS: AIModel[] = [
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    description: "Powerful general-purpose model",
    contextLength: 64000,
    isFast: true,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    description: "Lightweight Claude for fast, low-cost tasks",
    contextLength: 200000,
    isFast: true,
    isNewModel: true,
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Advanced reasoning model",
    contextLength: 64000,
    supportsReasoning: true,
  },
  {
    id: "moonshotai/kimi-k2:free",
    name: "Kimi K2",
    provider: "Moonshot AI",
    description: "Free Kimi K2 model",
    contextLength: 128000,
  },
  {
    id: "moonshotai/kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    provider: "Moonshot AI",
    description: "Reasoning-enhanced Kimi",
    contextLength: 128000,
    supportsReasoning: true,
  },
  {
    id: "z-ai/glm-4.7",
    name: "GLM 4.7",
    provider: "Zhipu",
    description: "GLM 4.7",
    contextLength: 128000,
  },
  {
    id: "mistralai/devstral-2512:free",
    name: "Devstral",
    provider: "Mistral",
    description: "Devstral 2512 (free)",
    contextLength: 64000,
    isFast: true,
  },
  {
    id: CODEUI_GOD_MODE_MODEL_ID,
    name: "Gemini 3 Flash Preview",
    provider: "Google",
    description: "Latest Gemini model preview",
    contextLength: 2000000,
    isFast: true,
    isNewModel: true,
  },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite Preview",
    provider: "Google",
    description: "Fast and lightweight Gemini 3.1 preview model",
    contextLength: 1000000,
    isFast: true,
    isNewModel: true,
  },
]

function getServerEnvValue(name: string): string | undefined {
  return typeof window === "undefined" ? process.env[name] : undefined
}

function normalizeConfiguredModelId(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : undefined
}

function parseConfiguredModelIdList(value: string | null | undefined): string[] {
  return (value || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
}

export function getConfiguredDefaultModelId(): string | undefined {
  return normalizeConfiguredModelId(getServerEnvValue("DEFAULT_AI_MODEL"))
}

export function getConfiguredFallbackModelIds(): string[] {
  return parseConfiguredModelIdList(getServerEnvValue("FALLBACK_AI_MODELS"))
}

export function buildModelFallbackChain({
  enabledModels,
  defaultModelId,
  primaryModelId,
  configuredFallbackModelIds = getConfiguredFallbackModelIds(),
}: {
  enabledModels: ReadonlyArray<Pick<AIModel, "id" | "provider">>
  defaultModelId?: string
  primaryModelId?: string
  configuredFallbackModelIds?: readonly string[]
}) {
  const byId = new Map(enabledModels.map((model) => [model.id, model]))
  const resolvedPrimary =
    primaryModelId && byId.has(primaryModelId)
      ? primaryModelId
      : defaultModelId && byId.has(defaultModelId)
        ? defaultModelId
        : enabledModels[0]?.id

  const chain: string[] = []
  const seen = new Set<string>()

  const pushIfEnabled = (id?: string) => {
    if (!id || seen.has(id) || !byId.has(id)) {
      return
    }

    seen.add(id)
    chain.push(id)
  }

  pushIfEnabled(resolvedPrimary)
  pushIfEnabled(defaultModelId)
  configuredFallbackModelIds.forEach((modelId) => pushIfEnabled(modelId))
  pushIfEnabled(CODEUI_GOD_MODE_MODEL_ID)

  const primaryProvider = resolvedPrimary ? byId.get(resolvedPrimary)?.provider : undefined

  enabledModels
    .filter((model) => model.provider !== primaryProvider)
    .forEach((model) => pushIfEnabled(model.id))

  enabledModels.forEach((model) => pushIfEnabled(model.id))

  return chain
}

/**
 * Get enabled model IDs from environment variable
 * Format: Comma-separated list of model IDs
 * Example: "deepseek/deepseek-chat,deepseek/deepseek-r1,moonshotai/kimi-k2-thinking"
 */
export function getConfiguredEnabledModelIds(): string[] {
  const enabledModelsEnv = getServerEnvValue("ENABLED_AI_MODELS")

  if (!enabledModelsEnv) {
    return ALL_MODELS.map((model) => model.id)
  }

  return parseConfiguredModelIdList(enabledModelsEnv)
}

/**
 * Get the list of enabled models based on environment configuration
 */
export function getEnabledModels(): AIModel[] {
  const enabledIds = new Set(getConfiguredEnabledModelIds())
  return ALL_MODELS.filter(model => enabledIds.has(model.id))
}

/**
 * Get a specific model by ID
 */
export function getModelById(id: string): AIModel | undefined {
  return ALL_MODELS.find(model => model.id === id)
}

/**
 * Check if a model ID is valid and enabled
 */
export function isModelEnabled(id: string): boolean {
  const enabledIds = new Set(getConfiguredEnabledModelIds())
  return enabledIds.has(id)
}

/**
 * Get default model ID
 * Prefers DEFAULT_AI_MODEL when enabled, then Gemini 3 Flash Preview, then first enabled model.
 */
export function getDefaultModelId(): string {
  const enabled = getEnabledModels()
  const configuredDefaultModelId = getConfiguredDefaultModelId()

  if (configuredDefaultModelId && enabled.some((model) => model.id === configuredDefaultModelId)) {
    return configuredDefaultModelId
  }

  const preferred = enabled.find((model) => model.id === CODEUI_GOD_MODE_MODEL_ID)
  if (preferred) {
    return preferred.id
  }

  return enabled.length > 0 ? enabled[0].id : CODEUI_GOD_MODE_MODEL_ID
}

/**
 * Build an ordered fallback chain for generation-time failover.
 * Priority:
 * 1) Requested/enforced primary model (if enabled)
 * 2) Default model
 * 3) FALLBACK_AI_MODELS entries in env order
 * 4) Gemini 3 Flash Preview model
 * 5) Remaining enabled models (prefer different providers first)
 */
export function getModelFallbackChain(primaryModelId?: string): string[] {
  const enabled = getEnabledModels()

  if (enabled.length === 0) {
    return [CODEUI_GOD_MODE_MODEL_ID]
  }

  return buildModelFallbackChain({
    enabledModels: enabled,
    defaultModelId: getDefaultModelId(),
    primaryModelId,
  })
}

/**
 * Server-side only: Get models as a record for API validation
 */
export function getModelsRecord(): Record<string, Omit<AIModel, 'id'>> {
  const enabled = getEnabledModels()
  const record: Record<string, Omit<AIModel, 'id'>> = {}
  
  enabled.forEach(model => {
    const { id, ...rest } = model
    record[id] = rest
  })
  
  return record
}

// Export the complete list for reference
export { ALL_MODELS }
