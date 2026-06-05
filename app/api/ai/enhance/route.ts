import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getRuntimeModelFallbackChain,
  getRuntimeModelsById,
  getRuntimePromptEnhanceModelId,
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
import { requestAITextCompletion } from "@/lib/ai-provider-client"
import { createRepromptLogger } from "@/lib/utils/reprompt-logger"

const MAX_PROMPT_LENGTH = 10_000
const logger = createRepromptLogger("api-ai-enhance")

interface EnhanceRequestBody {
  prompt: string
  // Accepted for backward compatibility but ignored — Prompt Enhance always
  // uses the model configured in the admin model policy / PROMPT_ENHANCE_MODEL.
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

    const body = (await request.json()) as EnhanceRequestBody
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
    const strength = body.strength || "standard"

    // Always use the admin/env-configured prompt enhance model regardless of
    // the user's currently selected generation model. This keeps Prompt
    // Enhance deterministic and lets admins pin a cheap, fast rewriter.
    const promptEnhanceModelId = await getRuntimePromptEnhanceModelId()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt is too long. Maximum supported length is ${MAX_PROMPT_LENGTH} characters.` },
        { status: 400 },
      )
    }

    if (!(await isRuntimeModelEnabled(promptEnhanceModelId))) {
      logger.warn("Configured Prompt Enhance model is not enabled — falling back to deterministic rewrite", {
        phase: "route",
        requestId,
        promptEnhanceModelId,
      })
      const context: PromptEnhancementContext = { prompt, strength }
      const warning = detectPromptEnhancementWarning(prompt)
      return NextResponse.json({
        enhancedPrompt: buildDeterministicPromptEnhancement(context),
        warning:
          warning ||
          "Prompt Enhance is using a basic fallback because the configured model is not currently enabled.",
      })
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
      const completion = await requestAITextCompletion({
        requestId,
        requestedModel: promptEnhanceModelId,
        fallbackChain: await getRuntimeModelFallbackChain(promptEnhanceModelId),
        modelsById: await getRuntimeModelsById(),
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
        warning:
          warning ||
          "Prompt Enhance is using a basic fallback because the AI service is unavailable.",
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
