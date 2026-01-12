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
  isNew?: boolean
}

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
    isNew: true,
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
    id: "google/gemini-3-flash-preview",
    name: "CODEUI GOD MODE",
    provider: "Google",
    description: "Latest Gemini model preview",
    contextLength: 2000000,
    isFast: true,
    isNew: true,
  },
]

/**
 * Get enabled model IDs from environment variable
 * Format: Comma-separated list of model IDs
 * Example: "deepseek/deepseek-chat,deepseek/deepseek-r1,moonshotai/kimi-k2-thinking"
 */
function getEnabledModelIds(): string[] {
  // Check if running on server (environment variable available)
  const enabledModelsEnv = typeof window === 'undefined' 
    ? process.env.ENABLED_AI_MODELS 
    : undefined

  if (!enabledModelsEnv) {
    // If not set, enable all models by default
    return ALL_MODELS.map(m => m.id)
  }

  return enabledModelsEnv
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0)
}

/**
 * Get the list of enabled models based on environment configuration
 */
export function getEnabledModels(): AIModel[] {
  const enabledIds = new Set(getEnabledModelIds())
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
  const enabledIds = new Set(getEnabledModelIds())
  return enabledIds.has(id)
}

/**
 * Get default model ID
 * Uses the first enabled model or falls back to DeepSeek V3
 */
export function getDefaultModelId(): string {
  const enabled = getEnabledModels()
  return enabled.length > 0 ? enabled[0].id : "deepseek/deepseek-chat"
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
