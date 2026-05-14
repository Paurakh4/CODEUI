import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getRuntimeDefaultModelId,
  getRuntimeModelFallbackChain,
  isRuntimeModelEnabled,
} from "@/lib/admin/model-policies"
import { requestOpenRouterTextCompletion } from "@/lib/openrouter-text-completion"
import { createRepromptLogger } from "@/lib/utils/reprompt-logger"

const MAX_PROMPT_LENGTH = 10_000
const MAX_HTML_CONTEXT_LENGTH = 20_000

const GENERATION_SUMMARY_SYSTEM_PROMPT = [
  "You are CodeUI speaking directly to the user immediately after successfully finishing a UI generation.",
  "Write a natural assistant reply in first person.",
  "Use no more than two sentences and keep it under 80 words total.",
  "Say what you built or updated and highlight the most important visual or interaction choices grounded in the finished UI.",
  "Do not use labels like 'Generated:' or 'UI design:'.",
  "Do not mention HTML, code, implementation steps, or that you were given a prompt or snapshot.",
  "Return plain text only with no bullets, headings, markdown, or quotation marks.",
].join("\n")

const logger = createRepromptLogger("api-ai-generation-summary")

interface GenerationSummaryRequestBody {
  prompt: string
  html: string
  model?: string
  isFollowUp?: boolean
}

function buildHtmlSnapshot(html: string): string {
  const normalized = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (normalized.length <= MAX_HTML_CONTEXT_LENGTH) {
    return normalized
  }

  return `${normalized.slice(0, MAX_HTML_CONTEXT_LENGTH)}...`
}

function normalizeAssistantMessage(content: string): string {
  return content
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function buildGenerationSummaryUserPrompt({
  prompt,
  html,
  isFollowUp,
}: {
  prompt: string
  html: string
  isFollowUp: boolean
}): string {
  return [
    `Original user request: ${prompt}`,
    `Completion type: ${isFollowUp ? "follow-up update to an existing UI" : "new UI generation"}`,
    "Finished UI snapshot:",
    buildHtmlSnapshot(html),
    "Write the short assistant reply to send back to the user now.",
  ].join("\n\n")
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-codeui-request-id") || crypto.randomUUID()

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const runtimeDefaultModelId = await getRuntimeDefaultModelId()
    const body = (await request.json()) as GenerationSummaryRequestBody
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
    const html = typeof body.html === "string" ? body.html.trim() : ""
    const model = body.model || runtimeDefaultModelId
    const isFollowUp = body.isFollowUp === true

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    if (!html) {
      return NextResponse.json({ error: "HTML is required" }, { status: 400 })
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

    const completion = await requestOpenRouterTextCompletion({
      requestId,
      requestedModel: model,
      fallbackChain: await getRuntimeModelFallbackChain(model),
      messages: [
        { role: "system", content: GENERATION_SUMMARY_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildGenerationSummaryUserPrompt({
            prompt,
            html,
            isFollowUp,
          }),
        },
      ],
      signal: request.signal,
      temperature: 0.35,
      maxTokens: 180,
    })

    const assistantMessage = normalizeAssistantMessage(completion.content)
    if (!assistantMessage) {
      return NextResponse.json({ error: "AI summary returned no content" }, { status: 502 })
    }

    return NextResponse.json({
      assistantMessage,
      meta: {
        modelUsed: completion.modelUsed,
        fallbackUsed: completion.fallbackUsed,
      },
    })
  } catch (error) {
    logger.error("Generation summary route failed", {
      phase: "route",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json({ error: "Failed to generate assistant message" }, { status: 500 })
  }
}