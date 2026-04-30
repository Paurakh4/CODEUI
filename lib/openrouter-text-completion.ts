import { createRepromptLogger } from "@/lib/utils/reprompt-logger"

export interface OpenRouterTextMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface OpenRouterTextCompletionOptions {
  requestId: string
  requestedModel: string
  fallbackChain: string[]
  messages: OpenRouterTextMessage[]
  signal?: AbortSignal
  temperature?: number
  maxTokens?: number
  responseFormat?: Record<string, unknown>
}

export interface OpenRouterTextCompletionResult {
  content: string
  modelUsed: string
  fallbackUsed: boolean
}

const logger = createRepromptLogger("openrouter-text-completion")

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim()
  }

  if (!Array.isArray(content)) {
    return ""
  }

  return content
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return ""
      }

      const record = entry as Record<string, unknown>
      return typeof record.text === "string" ? record.text : ""
    })
    .join("")
    .trim()
}

export async function requestOpenRouterTextCompletion({
  requestId,
  requestedModel,
  fallbackChain,
  messages,
  signal,
  temperature = 0.35,
  maxTokens = 1_200,
  responseFormat,
}: OpenRouterTextCompletionOptions): Promise<OpenRouterTextCompletionResult> {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY
  if (!openRouterApiKey) {
    throw new Error("OpenRouter API key not configured")
  }

  let lastError = "AI service error"

  for (let index = 0; index < fallbackChain.length; index += 1) {
    const model = fallbackChain[index]

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "CodeUI",
          "X-CodeUI-Request-ID": requestId,
        },
        signal,
        body: JSON.stringify({
          stream: false,
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
      })

      if (!response.ok) {
        lastError = await response.text().catch(() => "AI service error")
        logger.warn("Utility completion failed for candidate model", {
          phase: "route",
          requestId,
          requestedModel,
          candidateModel: model,
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