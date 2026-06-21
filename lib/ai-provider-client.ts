import {
  OPENROUTER_SOURCE_PROVIDER,
  PXROUTE_SOURCE_PROVIDER,
  CUSTOM_SOURCE_PROVIDER,
  resolveModelSourceProvider,
  type AIModel,
  type ModelSourceProvider,
} from "@/lib/ai-models"
import { createRepromptLogger } from "@/lib/utils/reprompt-logger"

export type AIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

export interface AITextMessage {
  role: "system" | "user" | "assistant"
  content: string | AIContentPart[]
}

export interface AITextCompletionOptions {
  requestId: string
  requestedModel: string
  fallbackChain: string[]
  modelsById?: ReadonlyMap<string, Pick<AIModel, "provider" | "sourceProvider">>
  messages: AITextMessage[]
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
  responseFormat?: Record<string, unknown>
}

export interface AITextCompletionResult {
  content: string
  modelUsed: string
  fallbackUsed: boolean
}

export interface AIProviderRequestConfig {
  endpoint: string
  apiKey: string
  headers: Record<string, string>
  sourceProvider: ModelSourceProvider
  readTimeoutMs: number
  // Raw model id to send in the upstream request body. For openrouter/pxroute
  // this equals the catalog id; for custom providers it is the unnamespaced id.
  upstreamModelId: string
}

const logger = createRepromptLogger("ai-provider-client")
const OPENROUTER_CHAT_COMPLETIONS_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
const PXROUTE_CHAT_COMPLETIONS_ENDPOINT = "https://api.midrelay.com/v1/chat/completions"
const DEFAULT_OPENROUTER_READ_TIMEOUT_MS = 90_000
const DEFAULT_PXROUTE_READ_TIMEOUT_MS = 15_000

function parsePositiveInteger(value: string | undefined, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export function getPxRouteReadTimeoutMs() {
  return parsePositiveInteger(
    process.env.CODEUI_PXROUTE_UPSTREAM_READ_TIMEOUT_MS,
    DEFAULT_PXROUTE_READ_TIMEOUT_MS,
    1_000,
    120_000,
  )
}

export function getOpenRouterReadTimeoutMs(fallback = DEFAULT_OPENROUTER_READ_TIMEOUT_MS) {
  return parsePositiveInteger(
    process.env.CODEUI_UPSTREAM_READ_TIMEOUT_MS,
    fallback,
    5_000,
    120_000,
  )
}

export async function resolveProviderRequestConfig(options: {
  modelId: string
  model?: Pick<AIModel, "provider" | "sourceProvider" | "customProviderId" | "upstreamModelId"> | null
  requestId: string
  openRouterReadTimeoutMs?: number
}): Promise<AIProviderRequestConfig> {
  const sourceProvider = resolveModelSourceProvider(options.model)

  if (sourceProvider === PXROUTE_SOURCE_PROVIDER) {
    const apiKey = process.env.PXROUTE_API_KEY
    if (!apiKey) {
      throw new Error("PxRoute API key not configured")
    }

    return {
      endpoint: PXROUTE_CHAT_COMPLETIONS_ENDPOINT,
      apiKey,
      sourceProvider,
      readTimeoutMs: getPxRouteReadTimeoutMs(),
      upstreamModelId: options.model?.upstreamModelId ?? options.modelId,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-CodeUI-Request-ID": options.requestId,
      },
    }
  }

  if (sourceProvider === CUSTOM_SOURCE_PROVIDER) {
    const customProviderId = options.model?.customProviderId
    if (!customProviderId) {
      throw new Error("Custom provider model is missing a provider reference")
    }

    const provider = await resolveCustomProviderConfig(customProviderId)
    const baseUrl = provider.baseUrl.replace(/\/+$/, "")
    // OpenAI-compatible providers expose chat completions at /chat/completions
    // and the model list at /models. If the admin already included a path
    // segment (e.g. /v1), we just append /chat/completions.
    const endpoint = baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${baseUrl}/chat/completions`

    return {
      endpoint,
      apiKey: provider.apiKey,
      sourceProvider,
      readTimeoutMs: getOpenRouterReadTimeoutMs(),
      upstreamModelId: options.model?.upstreamModelId ?? options.modelId,
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        "X-CodeUI-Request-ID": options.requestId,
      },
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured")
  }

  return {
    endpoint: OPENROUTER_CHAT_COMPLETIONS_ENDPOINT,
    apiKey,
    sourceProvider: OPENROUTER_SOURCE_PROVIDER,
    readTimeoutMs: options.openRouterReadTimeoutMs ?? getOpenRouterReadTimeoutMs(),
    upstreamModelId: options.model?.upstreamModelId ?? options.modelId,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "CodeUI",
      "X-CodeUI-Request-ID": options.requestId,
    },
  }
}

// ponytail: lazy DB lookup, no caching. Ceiling: every completion request hits
// Mongo for the provider config. Upgrade path: in-process TTL cache keyed by
// providerId, invalidated on admin write.
async function resolveCustomProviderConfig(providerId: string) {
  const { getCustomProviderById } = await import("@/lib/admin/custom-providers")
  const provider = await getCustomProviderById(providerId)
  if (!provider) {
    throw new Error(`Custom provider "${providerId}" is no longer configured`)
  }
  return { baseUrl: provider.baseUrl, apiKey: provider.apiKey }
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim()
  }

  if (!Array.isArray(content)) {
    return ""
  }

  return content
    .map((entry) => {
      if (!entry || typeof entry !== "object") return ""
      const record = entry as Record<string, unknown>
      return typeof record.text === "string" ? record.text : ""
    })
    .join("")
    .trim()
}

function createTimeoutSignal(parentSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const abortFromParent = () => controller.abort()
  if (parentSignal?.aborted) {
    controller.abort()
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true })
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId)
      parentSignal?.removeEventListener("abort", abortFromParent)
    },
  }
}

export async function requestAITextCompletion({
  requestId,
  requestedModel,
  fallbackChain,
  modelsById,
  messages,
  signal,
  temperature = 0.35,
  maxTokens = 1_200,
  responseFormat,
}: AITextCompletionOptions): Promise<AITextCompletionResult> {
  let lastError = "AI service error"

  for (let index = 0; index < fallbackChain.length; index += 1) {
    const model = fallbackChain[index]

    try {
      const providerConfig = await resolveProviderRequestConfig({
        modelId: model,
        model: modelsById?.get(model),
        requestId,
      })
      const timeoutSignal = createTimeoutSignal(signal, providerConfig.readTimeoutMs)

      const response = await fetch(providerConfig.endpoint, {
        method: "POST",
        headers: providerConfig.headers,
        signal: timeoutSignal.signal,
        body: JSON.stringify({
          stream: false,
          model: providerConfig.upstreamModelId,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
      }).finally(timeoutSignal.cleanup)

      if (!response.ok) {
        lastError = await response.text().catch(() => "AI service error")
        logger.warn("Utility completion failed for candidate model", {
          phase: "route",
          requestId,
          requestedModel,
          candidateModel: model,
          sourceProvider: providerConfig.sourceProvider,
          status: response.status,
          details: lastError,
        })
        continue
      }

      const payload = await response.json()
      const content = extractTextContent(payload?.choices?.[0]?.message?.content)
      if (!content) {
        lastError = "AI completion returned no content"
        continue
      }

      return {
        content,
        modelUsed: model,
        fallbackUsed: model !== requestedModel,
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error
      }

      lastError = error instanceof Error ? error.message : String(error)
      logger.warn("Utility completion threw for candidate model", {
        phase: "route",
        requestId,
        requestedModel,
        candidateModel: model,
        error: lastError,
      })
    }
  }

  throw new Error(lastError)
}
