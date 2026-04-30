import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getRuntimeDefaultModelId,
  getRuntimeModelFallbackChain,
  isRuntimeModelEnabled,
} from "@/lib/admin/model-policies"
import {
  PROMPT_ENHANCEMENT_SYSTEM_PROMPT,
  buildDeterministicPromptEnhancement,
  buildPromptEnhancementUserPrompt,
  detectPromptEnhancementWarning,
  isLikelyUiPrompt,
  resolvePromptEnhancement,
  type PromptEnhancementContext,
  type PromptEnhancementStrength,
} from "@/lib/prompt-enhancement"
import { requestOpenRouterTextCompletion } from "@/lib/openrouter-text-completion"
import { createRepromptLogger } from "@/lib/utils/reprompt-logger"

const MAX_PROMPT_LENGTH = 10_000
const logger = createRepromptLogger("api-ai-enhance")

interface EnhanceRequestBody {
  prompt: string
  model?: string
  strength?: PromptEnhancementStrength
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-codeui-request-id") || crypto.randomUUID()

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const runtimeDefaultModelId = await getRuntimeDefaultModelId()
    const body = (await request.json()) as EnhanceRequestBody
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
    const model = body.model || runtimeDefaultModelId
    const strength = body.strength || "standard"

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt is too long. Maximum supported length is ${MAX_PROMPT_LENGTH} characters.` },
        { status: 400 },
      )
    }

    if (!(await isRuntimeModelEnabled(model))) {
      return NextResponse.json(
        { error: `Model \"${model}\" is not enabled or does not exist` },
        { status: 400 },
      )
    }

    const context: PromptEnhancementContext = { prompt, strength }
    const warning = detectPromptEnhancementWarning(prompt)
    if (!isLikelyUiPrompt(prompt)) {
      return NextResponse.json({
        enhancedPrompt: prompt,
        warning,
        skipped: true,
      })
    }

    try {
      const completion = await requestOpenRouterTextCompletion({
        requestId,
        requestedModel: model,
        fallbackChain: await getRuntimeModelFallbackChain(model),
        messages: [
          { role: "system", content: PROMPT_ENHANCEMENT_SYSTEM_PROMPT },
          { role: "user", content: buildPromptEnhancementUserPrompt(context) },
        ],
        signal: request.signal,
        temperature: strength === "light" ? 0.2 : strength === "strong" ? 0.45 : 0.3,
        maxTokens: strength === "strong" ? 1_800 : 1_200,
      })

      const result = resolvePromptEnhancement(completion.content, context)

      return NextResponse.json({
        ...result,
        meta: {
          modelUsed: completion.modelUsed,
          fallbackUsed: completion.fallbackUsed,
        },
      })
    } catch (error) {
      logger.warn("Falling back to deterministic prompt enhancement", {
        phase: "route",
        requestId,
        error: error instanceof Error ? error.message : String(error),
      })

      return NextResponse.json({
        enhancedPrompt: buildDeterministicPromptEnhancement(context),
        warning,
      })
    }
  } catch (error) {
    logger.error("Prompt enhancement route failed", {
      phase: "route",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to enhance prompt" }, { status: 500 })
  }
}