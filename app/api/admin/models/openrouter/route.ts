import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminRoute } from "@/lib/admin/guards"

const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models"

const openRouterModelSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().optional().nullable(),
    description: z.string().optional().nullable(),
    context_length: z.number().int().positive().optional().nullable(),
    supported_parameters: z.array(z.string()).optional().default([]),
    top_provider: z
      .object({
        context_length: z.number().int().positive().optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .passthrough()

type OpenRouterApiModel = z.infer<typeof openRouterModelSchema>

type OpenRouterAdminModel = {
  id: string
  name: string
  provider: string
  description: string
  contextLength: number
  supportsReasoning: boolean
  isFast: boolean
  isNew: boolean
  isFree: boolean
}

const PROVIDER_LABELS: Record<string, string> = {
  "01-ai": "01.AI",
  ai21: "AI21",
  alibaba: "Alibaba",
  amazon: "Amazon",
  anthropic: "Anthropic",
  baidu: "Baidu",
  bytedance: "ByteDance",
  cohere: "Cohere",
  deepseek: "DeepSeek",
  google: "Google",
  ibm: "IBM",
  inclusionai: "inclusionAI",
  meta: "Meta",
  "meta-llama": "Meta",
  microsoft: "Microsoft",
  minimax: "MiniMax",
  mistralai: "Mistral",
  moonshotai: "Moonshot AI",
  nvidia: "NVIDIA",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  perplexity: "Perplexity",
  qwen: "Qwen",
  rekaai: "Reka",
  xiaomi: "Xiaomi",
  "x-ai": "xAI",
  "z-ai": "Z.ai",
}

function toTitleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function resolveProvider(model: OpenRouterApiModel) {
  const providerFromName = model.name?.includes(":")
    ? model.name.split(":")[0]?.trim()
    : undefined

  if (providerFromName) {
    return providerFromName
  }

  const providerKey = model.id.replace(/^~/, "").split("/")[0] ?? ""
  return PROVIDER_LABELS[providerKey] ?? toTitleCase(providerKey)
}

function resolveContextLength(model: OpenRouterApiModel) {
  return model.context_length ?? model.top_provider?.context_length ?? 128000
}

function resolveReasoningSupport(model: OpenRouterApiModel) {
  const supportedParameters = new Set(model.supported_parameters ?? [])
  return (
    supportedParameters.has("reasoning") ||
    supportedParameters.has("include_reasoning") ||
    supportedParameters.has("reasoning_effort")
  )
}

function resolveFastFlag(model: OpenRouterApiModel) {
  const searchableText = `${model.id} ${model.name ?? ""} ${model.description ?? ""}`.toLowerCase()
  return /\b(fast|flash|lite|mini|nano|turbo|haiku)\b/.test(searchableText)
}

function normalizeModel(model: OpenRouterApiModel): OpenRouterAdminModel {
  return {
    id: model.id,
    name: model.name?.trim() || model.id,
    provider: resolveProvider(model),
    description: model.description?.trim() || "",
    contextLength: resolveContextLength(model),
    supportsReasoning: resolveReasoningSupport(model),
    isFast: resolveFastFlag(model),
    isNew: false,
    isFree: model.id.includes(":free"),
  }
}

export const dynamic = "force-dynamic"

export async function GET() {
  const authResult = await requireAdminRoute("admin:view-models")
  if ("response" in authResult) {
    return authResult.response
  }

  try {
    const response = await fetch(OPENROUTER_MODELS_ENDPOINT, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload || !Array.isArray(payload.data)) {
      return NextResponse.json({ error: "Failed to load OpenRouter models" }, { status: 502 })
    }

    const modelsById = new Map<string, OpenRouterAdminModel>()

    for (const candidate of payload.data) {
      const parsedCandidate = openRouterModelSchema.safeParse(candidate)
      if (!parsedCandidate.success) {
        continue
      }

      const normalizedModel = normalizeModel(parsedCandidate.data)
      if (!modelsById.has(normalizedModel.id)) {
        modelsById.set(normalizedModel.id, normalizedModel)
      }
    }

    const models = Array.from(modelsById.values()).sort((left, right) => {
      return (
        left.provider.localeCompare(right.provider) ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
      )
    })

    return NextResponse.json(
      { models },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  } catch (error) {
    console.error("ADMIN_OPENROUTER_MODELS_GET_ERROR", error)
    return NextResponse.json({ error: "Failed to load OpenRouter models" }, { status: 500 })
  }
}