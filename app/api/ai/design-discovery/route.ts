import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getRuntimeDefaultModelId,
  getRuntimeModelFallbackChain,
  getRuntimeModelsById,
  isRuntimeModelEnabled,
} from "@/lib/admin/model-policies"
import {
  analyzeDesignDiscoveryNeeds,
  buildDeterministicDesignDiscoveryResult,
  normalizeDesignDiscoveryResult,
} from "@/lib/design-discovery"
import { requestAITextCompletion } from "@/lib/ai-provider-client"
import { createRepromptLogger } from "@/lib/utils/reprompt-logger"

const MAX_PROMPT_LENGTH = 10_000
const logger = createRepromptLogger("api-ai-design-discovery")

const DESIGN_DISCOVERY_SYSTEM_PROMPT = [
  "You are a senior product designer deciding whether a UI prompt needs a short discovery pass before generation.",
  "Only ask questions when high-impact design context is missing.",
  "Allowed focus areas are platform, style, audience, color, and density.",
  "Do not ask technical or implementation questions.",
  "Return strict JSON only using this shape:",
  '{"needsClarification":boolean,"reasoning":"string","questions":[{"id":"string","focusArea":"platform|style|audience|color|density","question":"string","description":"string","options":[{"id":"string","label":"string","description":"string"}],"customAnswerPlaceholder":"string","allowSkip":true}]}'
].join(" ")

interface DesignDiscoveryRequestBody {
  prompt: string
  model?: string
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/u, "").trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("No JSON object found in AI response")
    }

    return JSON.parse(trimmed.slice(start, end + 1))
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-codeui-request-id") || crypto.randomUUID()

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const runtimeDefaultModelId = await getRuntimeDefaultModelId()
    const body = (await request.json()) as DesignDiscoveryRequestBody
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
    const model = body.model || runtimeDefaultModelId

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

    const assessment = analyzeDesignDiscoveryNeeds(prompt)
    if (!assessment.needsClarification) {
      return NextResponse.json({
        needsClarification: false,
        reasoning: "The prompt already defines the platform, style direction, and audience clearly enough to generate immediately.",
        questions: [],
      })
    }

    try {
      const completion = await requestAITextCompletion({
        requestId,
        requestedModel: model,
        fallbackChain: await getRuntimeModelFallbackChain(model),
        modelsById: await getRuntimeModelsById(),
        messages: [
          { role: "system", content: DESIGN_DISCOVERY_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              "Evaluate this UI prompt and decide whether a short design discovery session is needed.",
              "Ask only missing high-impact design questions.",
              "Skip technical implementation details.",
              "",
              "Prompt:",
              prompt,
            ].join("\n"),
          },
        ],
        signal: request.signal,
        temperature: 0.2,
        maxTokens: 1_100,
        responseFormat: { type: "json_object" },
      })

      return NextResponse.json(normalizeDesignDiscoveryResult(parseJsonObject(completion.content), prompt))
    } catch (error) {
      logger.warn("Falling back to deterministic design discovery", {
        phase: "route",
        requestId,
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json(buildDeterministicDesignDiscoveryResult(prompt))
    }
  } catch (error) {
    logger.error("Design discovery route failed", {
      phase: "route",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Failed to evaluate prompt detail" }, { status: 500 })
  }
}
