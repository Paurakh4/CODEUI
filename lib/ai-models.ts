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
  sourceProvider?: "openrouter" | "pxroute" | "custom" | "byok"
  customProviderId?: string
  // Raw model id sent to the upstream API. Only set for custom providers where
  // the catalog id is namespaced (e.g. `custom:opencode-zen:gpt-5.5`).
  upstreamModelId?: string
  description?: string
  contextLength: number
  supportsReasoning?: boolean
  supportsVision?: boolean
  isFast?: boolean
  isNewModel?: boolean
}

export const CODEUI_GOD_MODE_MODEL_ID = "google/gemini-3-flash-preview"

export const DEFAULT_PROMPT_ENHANCE_MODEL_ID = "x-ai/grok-build-0.1"

export const PXROUTE_SOURCE_PROVIDER = "pxroute" as const
export const OPENROUTER_SOURCE_PROVIDER = "openrouter" as const
export const CUSTOM_SOURCE_PROVIDER = "custom" as const
export const BYOK_SOURCE_PROVIDER = "byok" as const

export const PXROUTE_MODEL_IDS = [
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.3-codex",
] as const

export type ModelSourceProvider =
  | typeof OPENROUTER_SOURCE_PROVIDER
  | typeof PXROUTE_SOURCE_PROVIDER
  | typeof CUSTOM_SOURCE_PROVIDER
  | typeof BYOK_SOURCE_PROVIDER

export function resolveModelSourceProvider(model?: Pick<AIModel, "provider" | "sourceProvider"> | null): ModelSourceProvider {
  if (model?.sourceProvider === BYOK_SOURCE_PROVIDER) {
    return BYOK_SOURCE_PROVIDER
  }

  if (model?.sourceProvider === PXROUTE_SOURCE_PROVIDER) {
    return PXROUTE_SOURCE_PROVIDER
  }

  if (model?.sourceProvider === CUSTOM_SOURCE_PROVIDER) {
    return CUSTOM_SOURCE_PROVIDER
  }

  if (model?.sourceProvider === OPENROUTER_SOURCE_PROVIDER) {
    return OPENROUTER_SOURCE_PROVIDER
  }

  return model?.provider === "PxRoute" ? PXROUTE_SOURCE_PROVIDER : OPENROUTER_SOURCE_PROVIDER
}

/**
 * Build a namespaced catalog id for a custom-provider model so models from
 * different providers never collide (e.g. OpenCode Zen and PxRoute both expose
 * `gpt-5.5`).
 */
export function buildCustomModelId(providerId: string, upstreamModelId: string) {
  return `custom:${providerId}:${upstreamModelId}`
}

export function parseCustomModelId(catalogId: string): { providerId: string; upstreamModelId: string } | null {
  const match = /^custom:([^:]+):(.+)$/.exec(catalogId)
  if (!match) return null
  return { providerId: match[1], upstreamModelId: match[2] }
}

/**
 * Build a namespaced catalog id for a BYOK (user-level) provider model.
 * Format: `byok:${providerId}:${upstreamModelId}`
 */
export function buildByokModelId(providerId: string, upstreamModelId: string) {
  return `byok:${providerId}:${upstreamModelId}`
}

export function parseByokModelId(catalogId: string): { providerId: string; upstreamModelId: string } | null {
  const match = /^byok:([^:]+):(.+)$/.exec(catalogId)
  if (!match) return null
  return { providerId: match[1], upstreamModelId: match[2] }
}

export function isByokModelId(catalogId: string): boolean {
  return catalogId.startsWith("byok:")
}

/**
 * Check whether a model supports vision/image input.
 * Resolves from the hardcoded master list first, then falls back to
 * synthesized metadata for env-configured models.
 */
export function isVisionCapableModel(modelId: string): boolean {
  const model = getModelById(modelId)
  return model?.supportsVision === true
}

// All available models (master list)
const ALL_MODELS: AIModel[] = [
  {
    id: "deepseek/deepseek-chat",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    sourceProvider: OPENROUTER_SOURCE_PROVIDER,
    description: "Powerful general-purpose model",
    contextLength: 64000,
    isFast: true,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    sourceProvider: OPENROUTER_SOURCE_PROVIDER,
    description: "Lightweight Claude for fast, low-cost tasks",
    contextLength: 200000,
    supportsVision: true,
    isFast: true,
    isNewModel: true,
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    sourceProvider: OPENROUTER_SOURCE_PROVIDER,
    description: "Advanced reasoning model",
    contextLength: 64000,
    supportsReasoning: true,
  },
  {
    id: "moonshotai/kimi-k2:free",
    name: "Kimi K2",
    provider: "Moonshot AI",
    sourceProvider: OPENROUTER_SOURCE_PROVIDER,
    description: "Free Kimi K2 model",
    contextLength: 128000,
    supportsVision: true,
  },
  {
    id: "moonshotai/kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    provider: "Moonshot AI",
    sourceProvider: OPENROUTER_SOURCE_PROVIDER,
    description: "Reasoning-enhanced Kimi",
    contextLength: 128000,
    supportsVision: true,
    supportsReasoning: true,
  },
  {
    id: "z-ai/glm-4.7",
    name: "GLM 4.7",
    provider: "Zhipu",
    sourceProvider: OPENROUTER_SOURCE_PROVIDER,
    description: "GLM 4.7",
    contextLength: 128000,
    supportsVision: true,
  },
  {
    id: "mistralai/devstral-2512:free",
    name: "Devstral",
    provider: "Mistral",
    sourceProvider: OPENROUTER_SOURCE_PROVIDER,
    description: "Devstral 2512 (free)",
    contextLength: 64000,
    isFast: true,
  },
  {
    id: CODEUI_GOD_MODE_MODEL_ID,
    name: "Gemini 3 Flash Preview",
    provider: "Google",
    sourceProvider: OPENROUTER_SOURCE_PROVIDER,
    description: "Latest Gemini model preview",
    contextLength: 2000000,
    supportsVision: true,
    isFast: true,
    isNewModel: true,
  },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash Lite Preview",
    provider: "Google",
    sourceProvider: OPENROUTER_SOURCE_PROVIDER,
    description: "Fast and lightweight Gemini 3.1 preview model",
    contextLength: 1000000,
    supportsVision: true,
    isFast: true,
    isNewModel: true,
  },
  {
    id: "claude-opus-4-8",
    name: "Claude Opus 4.8",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Latest flagship Claude via PxRoute",
    contextLength: 200000,
    supportsVision: true,
    supportsReasoning: true,
    isNewModel: true,
  },
  {
    id: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Previous flagship Claude via PxRoute",
    contextLength: 200000,
    supportsVision: true,
    supportsReasoning: true,
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Older flagship Claude via PxRoute",
    contextLength: 200000,
    supportsVision: true,
    supportsReasoning: true,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Balanced PxRoute default for speed, quality, and cost",
    contextLength: 200000,
    supportsVision: true,
    supportsReasoning: true,
    isFast: true,
    isNewModel: true,
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Fast and cheap PxRoute Claude model for high-volume work",
    contextLength: 200000,
    supportsVision: true,
    isFast: true,
  },
  {
    id: "gpt-5.5",
    name: "GPT-5.5",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Latest GPT model via PxRoute for strong general reasoning",
    contextLength: 400000,
    supportsVision: true,
    supportsReasoning: true,
    isNewModel: true,
  },
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Stable GPT flagship via PxRoute",
    contextLength: 400000,
    supportsVision: true,
    supportsReasoning: true,
  },
  {
    id: "gpt-5.3-codex",
    name: "GPT-5.3 Codex",
    provider: "PxRoute",
    sourceProvider: PXROUTE_SOURCE_PROVIDER,
    description: "Code-specialized GPT model via PxRoute",
    contextLength: 400000,
    supportsVision: true,
    supportsReasoning: true,
  },
]

function getServerEnvValue(name: string): string | undefined {
  return typeof window === "undefined" ? process.env[name] : undefined
}

/**
 * Default context length used for env-configured models when no metadata is
 * available. Picked to be a reasonable middle ground for modern LLMs.
 */
const ENV_MODEL_DEFAULT_CONTEXT_LENGTH = 128_000

/**
 * Pretty labels for known provider slugs. Falls back to a humanized version
 * of the slug when not listed.
 */
const PROVIDER_LABEL_OVERRIDES: Record<string, string> = {
  "x-ai": "xAI",
  "openai": "OpenAI",
  "google": "Google",
  "deepseek": "DeepSeek",
  "qwen": "Qwen",
  "anthropic": "Anthropic",
  "moonshotai": "Moonshot AI",
  "z-ai": "Zhipu",
  "mistralai": "Mistral",
  "meta-llama": "Meta",
  "cohere": "Cohere",
  "perplexity": "Perplexity",
}

function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/g)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function deriveProviderLabel(providerSlug: string): string {
  const key = providerSlug.toLowerCase()
  return PROVIDER_LABEL_OVERRIDES[key] ?? humanizeSlug(providerSlug)
}

function deriveModelDisplayName(modelSlug: string): string {
  // Strip OpenRouter style suffix tags such as :nitro, :free, :beta and
  // surface them as parenthesized hints so the visible name stays clean.
  const [coreSlug, ...tagParts] = modelSlug.split(":")
  const coreName = humanizeSlug(coreSlug)
  if (tagParts.length === 0) return coreName
  const tagLabel = tagParts.map((tag) => humanizeSlug(tag)).join(" ")
  return `${coreName} (${tagLabel})`
}

/**
 * Build a synthetic AIModel record for an env-configured model id that does
 * not exist in the hardcoded master list. The id is expected to follow the
 * `provider/model` convention used by OpenRouter; if it does not, the entire
 * id is treated as the model slug with provider "Custom".
 */
export function synthesizeAIModelFromId(modelId: string): AIModel | undefined {
  const id = modelId.trim()
  if (!id) return undefined

  const slashIndex = id.indexOf("/")
  const providerSlug = slashIndex > 0 ? id.slice(0, slashIndex) : "custom"
  const modelSlug = slashIndex > 0 ? id.slice(slashIndex + 1) : id

  if (!modelSlug) return undefined

  return {
    id,
    name: deriveModelDisplayName(modelSlug),
    provider: deriveProviderLabel(providerSlug),
    sourceProvider: OPENROUTER_SOURCE_PROVIDER,
    description: "Configured via ENABLED_AI_MODELS",
    contextLength: ENV_MODEL_DEFAULT_CONTEXT_LENGTH,
  }
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

/**
 * Returns the env-configured model id used for Prompt Enhance, if any. The
 * runtime resolver pairs this with admin-configured overrides in
 * `lib/admin/model-policies.ts`.
 */
export function getConfiguredPromptEnhanceModelId(): string | undefined {
  return normalizeConfiguredModelId(getServerEnvValue("PROMPT_ENHANCE_MODEL"))
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
/**
 * Get the list of enabled models based on environment configuration.
 * Models listed in `ENABLED_AI_MODELS` that are not in the hardcoded master
 * list are synthesized so they can flow through downstream catalogs and the
 * model dropdown without a code change.
 */
export function getEnabledModels(): AIModel[] {
  const enabledIds = getConfiguredEnabledModelIds()
  const baseById = new Map(ALL_MODELS.map((model) => [model.id, model]))
  const result: AIModel[] = []
  const seen = new Set<string>()

  for (const id of enabledIds) {
    if (seen.has(id)) continue
    const base = baseById.get(id)
    if (base) {
      result.push(base)
      seen.add(id)
      continue
    }

    const synthetic = synthesizeAIModelFromId(id)
    if (synthetic) {
      result.push(synthetic)
      seen.add(id)
    }
  }

  return result
}

/**
 * Get a specific model by ID. Falls back to synthesizing metadata for ids
 * configured via `ENABLED_AI_MODELS` but not present in the master list.
 */
export function getModelById(id: string): AIModel | undefined {
  const base = ALL_MODELS.find((model) => model.id === id)
  if (base) return base

  const enabledIds = new Set(getConfiguredEnabledModelIds())
  if (enabledIds.has(id)) {
    return synthesizeAIModelFromId(id)
  }

  return undefined
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
