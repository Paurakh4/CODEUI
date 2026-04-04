import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildContext } from "@/lib/context-builder"
import connectDB from "@/lib/db"
import { User, UsageLog } from "@/lib/models"
import {
  getCombinedSystemPrompt,
} from "@/lib/prompts/frontend-design"
import { FOLLOW_UP_REPAIR_INSTRUCTION, FOLLOW_UP_SYSTEM_PROMPT } from "@/lib/prompts/reprompt-system"
import {
  isFullDocumentRecoveryMode,
  isPatchRepairRecoveryMode,
  isRecoveryModeActive,
  type RecoveryModeValue,
} from "@/lib/recovery-mode"
import {
  getDefaultModelId,
  getModelById,
  getModelFallbackChain,
  getModelsRecord,
  isModelEnabled,
} from "@/lib/ai-models"
import {
  calculateCreditDeduction,
  getMonthlyCreditsForTier,
  isAdminUser,
  isStaffUser,
  SubscriptionTier,
} from "@/lib/pricing"
import {
  NEW_FILE_END,
  NEW_FILE_START,
  PROJECT_NAME_END,
  PROJECT_NAME_START,
  REPLACE_END,
  SEARCH_START,
  UPDATE_FILE_END,
  UPDATE_FILE_START,
} from "@/lib/constants"
import { detectIncompletePatchBlocks, validateAIResponse } from "@/lib/parsers/stream-parser"
import { estimateTokenCount } from "@/lib/token-counter"
import { getPromptAdaptationGuidance } from "@/lib/prompt-adaptation"
import { createRepromptLogger } from "@/lib/utils/reprompt-logger"

export const AI_MODELS = getModelsRecord()

type ModelId = keyof typeof AI_MODELS

interface Message {
  role: "user" | "assistant" | "system"
  content: string
}

interface ConversationHistoryItem {
  role: "user" | "assistant"
  content: string
}

interface RequestBody {
  prompt: string
  currentHtml?: string
  selectedElement?: string
  model?: ModelId
  isFollowUp?: boolean
  recoveryMode?: RecoveryModeValue
  enhancedPrompts?: boolean
  primaryColor?: string
  secondaryColor?: string
  theme?: "light" | "dark"
  conversationHistory?: ConversationHistoryItem[]
  isRecoveryRequest?: boolean
}

interface CreditContext {
  userId: string
  creditDeduction: { fromMonthly: number; fromTopup: number }
  billable: boolean
  refunded: boolean
}

interface UpstreamRequestResult {
  response: Response | null
  modelUsed: string
  fatalStatus: number | null
}

interface StreamMetaEvent {
  requestId: string
  requestedModel: string
  modelUsed?: string
  fallbackUsed?: boolean
  modelsUsed?: string[]
  outputThresholdTokens?: number
  outputThresholdChars?: number
  thresholdReached?: boolean
  continuationCount?: number
  totalParts?: number
  totalContentLength?: number
}

type StreamProgressStage = "preparing" | "generating" | "continuing" | "finalizing"

interface StreamProgressEvent {
  stage: StreamProgressStage
  message: string
  partNumber: number
  continuationCount: number
  totalContentLength: number
  thresholdReached?: boolean
}

interface StreamOpenRouterOptions {
  response: Response
  thresholdChars: number
  onContent: (content: string) => void
  onThinking: (thinking: string) => void
  signal?: AbortSignal
}

interface StreamOpenRouterResult {
  contentLength: number
  thresholdReached: boolean
  completedNaturally: boolean
}

const FULL_DOCUMENT_RECOVERY_FLAG = "FULL_DOCUMENT_RECOVERY_MODE"
const MAX_PROMPT_LENGTH = 10_000
const UPSTREAM_MAX_TOKENS = 16_000
const DEFAULT_CONTINUATION_THRESHOLD_TOKENS = 8_000
const DEFAULT_MAX_CONTINUATIONS = 3
const DEFAULT_CONTINUATION_CONTEXT_BUFFER_TOKENS = 4_000
const DEFAULT_UPSTREAM_READ_TIMEOUT_MS = 45_000
const logger = createRepromptLogger("api-ai-route")

function parsePositiveInteger(value: string | undefined, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

const CONTINUATION_THRESHOLD_TOKENS = parsePositiveInteger(
  process.env.CODEUI_CONTINUATION_THRESHOLD_TOKENS,
  DEFAULT_CONTINUATION_THRESHOLD_TOKENS,
  1_500,
  UPSTREAM_MAX_TOKENS,
)

const MAX_CONTINUATIONS = parsePositiveInteger(
  process.env.CODEUI_MAX_CONTINUATIONS,
  DEFAULT_MAX_CONTINUATIONS,
  1,
  6,
)

const CONTINUATION_CONTEXT_BUFFER_TOKENS = parsePositiveInteger(
  process.env.CODEUI_CONTINUATION_CONTEXT_BUFFER_TOKENS,
  DEFAULT_CONTINUATION_CONTEXT_BUFFER_TOKENS,
  1_000,
  12_000,
)

const UPSTREAM_READ_TIMEOUT_MS = parsePositiveInteger(
  process.env.CODEUI_UPSTREAM_READ_TIMEOUT_MS,
  DEFAULT_UPSTREAM_READ_TIMEOUT_MS,
  5_000,
  120_000,
)

function hasCompleteHtmlDocument(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) {
    return false
  }

  const hasRoot = trimmed.includes("<!DOCTYPE") || trimmed.includes("<html")
  return hasRoot && trimmed.includes("</html>")
}

function hasStructuredPatchMarkers(content: string): boolean {
  return (
    content.includes(SEARCH_START) ||
    content.includes(UPDATE_FILE_START) ||
    content.includes(NEW_FILE_START) ||
    content.includes(PROJECT_NAME_START)
  )
}

function endsWithStructuredBoundary(content: string): boolean {
  const trimmed = content.trim()
  return (
    trimmed.endsWith(REPLACE_END) ||
    trimmed.endsWith(UPDATE_FILE_END) ||
    trimmed.endsWith(NEW_FILE_END) ||
    trimmed.endsWith(PROJECT_NAME_END)
  )
}

function shouldContinueGeneration(options: {
  aggregateContent: string
  thresholdReached: boolean
  continuationCount: number
  isFollowUp: boolean
}): boolean {
  const { aggregateContent, thresholdReached, continuationCount, isFollowUp } = options

  if (!thresholdReached || continuationCount >= MAX_CONTINUATIONS) {
    return false
  }

  if (hasCompleteHtmlDocument(aggregateContent)) {
    return false
  }

  const incompletePatchCount = detectIncompletePatchBlocks(aggregateContent)
  if (incompletePatchCount > 0) {
    return true
  }

  const validation = validateAIResponse(aggregateContent)
  if (!validation.valid) {
    return true
  }

  if (!isFollowUp) {
    return true
  }

  if (!hasStructuredPatchMarkers(aggregateContent)) {
    return true
  }

  return !endsWithStructuredBoundary(aggregateContent)
}

function buildContinuationPrompt(originalPrompt: string, partNumber: number): string {
  return [
    `Continue the previous response from exactly where it stopped. This is continuation part ${partNumber}.`,
    "Do not restart the answer, do not repeat previous content, and do not add narration.",
    "Preserve the exact response format already in progress.",
    "Do not simplify the UI or omit requested features to save space.",
    "Maintain full prompt fidelity and continue implementing the complete requested scope.",
    "If you were returning SEARCH/REPLACE blocks, continue with SEARCH/REPLACE blocks only.",
    "If you were returning a full HTML document, continue the same document until it is complete and properly closed.",
    "Output only the continuation content.",
    `Original request: ${originalPrompt}`,
  ].join("\n")
}

function extractOpenRouterDelta(rawData: string): { done: boolean; content?: string; reasoning?: string } {
  if (rawData === "[DONE]") {
    return { done: true }
  }

  try {
    const parsed = JSON.parse(rawData)
    return {
      done: false,
      content: parsed.choices?.[0]?.delta?.content,
      reasoning: parsed.choices?.[0]?.delta?.reasoning,
    }
  } catch {
    return { done: false }
  }
}

function createAbortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError")
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

async function readStreamChunkWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  throwIfAborted(signal)

  let timeoutId: NodeJS.Timeout | null = null
  let abortHandler: (() => void) | undefined

  const pendingReads: Array<Promise<ReadableStreamReadResult<Uint8Array>>> = [reader.read()]

  pendingReads.push(
    new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Upstream AI stream timed out after ${UPSTREAM_READ_TIMEOUT_MS}ms`))
      }, UPSTREAM_READ_TIMEOUT_MS)
    }),
  )

  if (signal) {
    pendingReads.push(
      new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
        abortHandler = () => reject(createAbortError())
        signal.addEventListener("abort", abortHandler, { once: true })
      }),
    )
  }

  try {
    return await Promise.race(pendingReads)
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    if (signal && abortHandler) {
      signal.removeEventListener("abort", abortHandler)
    }
  }
}

async function streamOpenRouterResponse({
  response,
  thresholdChars,
  onContent,
  onThinking,
  signal,
}: StreamOpenRouterOptions): Promise<StreamOpenRouterResult> {
  const reader = response.body?.getReader()
  if (!reader) {
    return {
      contentLength: 0,
      thresholdReached: false,
      completedNaturally: true,
    }
  }

  const decoder = new TextDecoder()
  let buffer = ""
  let contentLength = 0
  let thresholdReached = false
  let completedNaturally = true

  const processLine = (line: string): "continue" | "done" | "stop" => {
    if (!line.startsWith("data: ")) {
      return "continue"
    }

    const delta = extractOpenRouterDelta(line.slice(6).trim())

    if (delta.done) {
      return "done"
    }

    if (delta.reasoning) {
      onThinking(delta.reasoning)
    }

    if (delta.content) {
      contentLength += delta.content.length
      onContent(delta.content)

      if (contentLength >= thresholdChars) {
        thresholdReached = true
        completedNaturally = false
        return "stop"
      }
    }

    return "continue"
  }

  while (true) {
    throwIfAborted(signal)

    let nextChunk: ReadableStreamReadResult<Uint8Array>
    try {
      nextChunk = await readStreamChunkWithTimeout(reader, signal)
    } catch (error) {
      await reader.cancel().catch(() => {})
      throw error
    }

    const { done, value } = nextChunk

    if (done) {
      if (buffer.trim()) {
        const trailingLines = buffer.split("\n").filter(Boolean)
        for (const line of trailingLines) {
          const status = processLine(line)
          if (status !== "continue") {
            return { contentLength, thresholdReached, completedNaturally: status === "done" ? true : completedNaturally }
          }
        }
      }

      return { contentLength, thresholdReached, completedNaturally }
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      const status = processLine(line)
      if (status === "done") {
        return { contentLength, thresholdReached, completedNaturally: true }
      }

      if (status === "stop") {
        await reader.cancel().catch(() => {})
        return { contentLength, thresholdReached, completedNaturally }
      }
    }
  }
}

function isRecoverableModelFailure(status: number): boolean {
  if (status === 408 || status === 409 || status === 425 || status === 429 || status === 404) {
    return true
  }

  return status >= 500
}

function buildEnhancedPromptPrefix(settings: {
  enhancedPrompts?: boolean
  primaryColor?: string
  secondaryColor?: string
  theme?: "light" | "dark"
}) {
  if (!settings.enhancedPrompts) {
    return ""
  }

  const preferredTheme = settings.theme || "dark"
  const preferredPrimary = settings.primaryColor || "blue"
  const preferredSecondary = settings.secondaryColor || "slate"

  return [
    "ENHANCED PROMPT MODE: ENABLED",
    "",
    "Apply these additional generation requirements:",
    `- Preferred theme direction: ${preferredTheme}.`,
    `- Preferred primary color family: ${preferredPrimary}.`,
    `- Preferred secondary color family: ${preferredSecondary}.`,
    "- Expand the user's request into a detailed UX structure with clear sections and polished interaction states.",
    "- Keep output production-ready and responsive.",
    "",
  ].join("\n")
}

function normalizeConversationHistory(
  conversationHistory: ConversationHistoryItem[] | undefined,
  maxTokens: number,
): Message[] {
  if (!conversationHistory?.length || maxTokens <= 0) {
    return []
  }

  const normalized = conversationHistory
    .filter((item): item is ConversationHistoryItem => {
      return (
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0
      )
    })
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }))

  const result: Message[] = []
  let usedTokens = 0

  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const item = normalized[index]
    const itemTokens = estimateTokenCount(item.content)
    if (usedTokens + itemTokens > maxTokens) {
      break
    }

    result.unshift(item)
    usedTokens += itemTokens
  }

  return result
}

async function refundCreditsIfNeeded(creditContext: CreditContext | null, reason: string) {
  if (!creditContext || !creditContext.billable || creditContext.refunded) {
    return
  }

  creditContext.refunded = true
  await User.findByIdAndUpdate(creditContext.userId, {
    $inc: {
      monthlyCredits: creditContext.creditDeduction.fromMonthly,
      topupCredits: creditContext.creditDeduction.fromTopup,
      totalCreditsUsed: -1,
      credits: creditContext.creditDeduction.fromMonthly + creditContext.creditDeduction.fromTopup,
      creditsUsedThisMonth: -1,
    },
  })

  logger.warn("Refunded credits for failed AI request", {
    phase: "billing",
    userId: creditContext.userId,
    reason,
    monthlyRefund: creditContext.creditDeduction.fromMonthly,
    topupRefund: creditContext.creditDeduction.fromTopup,
  })
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-codeui-request-id") || crypto.randomUUID()
  const requestSignal = req.signal

  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: RequestBody = await req.json()
    const {
      prompt,
      currentHtml,
      selectedElement,
      model = getDefaultModelId(),
      isFollowUp = false,
      recoveryMode,
      enhancedPrompts = false,
      primaryColor,
      secondaryColor,
      theme,
      conversationHistory,
      isRecoveryRequest,
    } = body

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt is too long. Maximum supported length is ${MAX_PROMPT_LENGTH} characters.` },
        { status: 400 },
      )
    }

    if (!isModelEnabled(model)) {
      return NextResponse.json(
        { error: `Model \"${model}\" is not enabled or does not exist` },
        { status: 400 },
      )
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY
    if (!openRouterApiKey) {
      return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 500 })
    }

    const isFullDocumentRecovery =
      isFollowUp &&
      (isFullDocumentRecoveryMode(recoveryMode) ||
        (typeof prompt === "string" && prompt.includes(FULL_DOCUMENT_RECOVERY_FLAG)))
    const isPatchRepairRecovery = isFollowUp && isPatchRepairRecoveryMode(recoveryMode)

    const recoveryHeader = req.headers.get("x-codeui-recovery") === "1"
    const shouldChargeCredits = !(isRecoveryRequest || recoveryHeader || isRecoveryModeActive(recoveryMode) || isFullDocumentRecovery)
    const sanitizedPrompt = prompt.replace(FULL_DOCUMENT_RECOVERY_FLAG, "").trim()

    let creditContext: CreditContext | null = null

    try {
      await connectDB()
      const userId = session.user.id
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      const user = await User.findById(userId)
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      const userEmail = user.email || session.user.email || ""
      const now = new Date()
      if (user.creditsResetDate && now >= user.creditsResetDate) {
        const tier = (user.subscription?.tier || "free") as SubscriptionTier
        const monthlyCredits = getMonthlyCreditsForTier(tier)
        const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)

        await User.findByIdAndUpdate(userId, {
          $set: {
            monthlyCredits,
            creditsResetDate: nextResetDate,
          },
        })
        user.monthlyCredits = monthlyCredits
        user.creditsResetDate = nextResetDate
      }

      if (shouldChargeCredits) {
        if (isAdminUser(userEmail) || isStaffUser(userEmail)) {
          creditContext = {
            userId,
            creditDeduction: { fromMonthly: 1, fromTopup: 0 },
            billable: false,
            refunded: false,
          }

          await User.findByIdAndUpdate(userId, {
            $inc: { totalCreditsUsed: 1 },
          })
        } else {
          const totalCredits = (user.monthlyCredits || 0) + (user.topupCredits || 0)
          if (totalCredits <= 0) {
            return NextResponse.json(
              {
                error: "No credits remaining. Please upgrade your plan or purchase a top-up.",
                creditsRemaining: 0,
                tier: user.subscription?.tier || "free",
              },
              { status: 403 },
            )
          }

          const creditDeduction = calculateCreditDeduction(
            user.monthlyCredits || 0,
            user.topupCredits || 0,
            1,
          )

          await User.findByIdAndUpdate(userId, {
            $inc: {
              monthlyCredits: -creditDeduction.fromMonthly,
              topupCredits: -creditDeduction.fromTopup,
              totalCreditsUsed: 1,
              credits: -(creditDeduction.fromMonthly + creditDeduction.fromTopup),
              creditsUsedThisMonth: 1,
            },
          })

          creditContext = {
            userId,
            creditDeduction,
            billable: true,
            refunded: false,
          }
        }
      }

      await UsageLog.create({
        userId: user._id,
        userEmail: user.email,
        promptType: isFollowUp ? "followup" : "initial",
        aiModel: model,
        creditsCost: shouldChargeCredits ? 1 : 0,
        creditsFromMonthly: shouldChargeCredits ? creditContext?.creditDeduction.fromMonthly || 0 : 0,
        creditsFromTopup: shouldChargeCredits ? creditContext?.creditDeduction.fromTopup || 0 : 0,
        promptLength: prompt.length,
        timestamp: new Date(),
      })
    } catch (dbError) {
      logger.error("Credit check error", {
        phase: "billing",
        requestId,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      })
      return NextResponse.json({ error: "Credit system error. Please try again." }, { status: 500 })
    }

    const systemPrompt = isFullDocumentRecovery || !isFollowUp
      ? getCombinedSystemPrompt()
      : FOLLOW_UP_SYSTEM_PROMPT

    const modelContextWindow = getModelById(model)?.contextLength
    const continuationThresholdTokens = CONTINUATION_THRESHOLD_TOKENS
    const continuationThresholdChars = continuationThresholdTokens * 4
    const conversationBudgetTokens = Math.floor((modelContextWindow ?? 64_000) * 0.15)
    const historyMessages = normalizeConversationHistory(conversationHistory, conversationBudgetTokens)
    const enhancedPromptPrefix = buildEnhancedPromptPrefix({
      enhancedPrompts,
      primaryColor,
      secondaryColor,
      theme,
    })
    const promptAdaptationGuidance = getPromptAdaptationGuidance(sanitizedPrompt || prompt)
    const adaptationPrefix = promptAdaptationGuidance ? `${promptAdaptationGuidance}\n\n` : ""

    const baseMessages: Message[] = [{ role: "system", content: systemPrompt }]
    if (historyMessages.length > 0) {
      baseMessages.push(...historyMessages)
    }

    if (isFollowUp && currentHtml) {
      const context = buildContext({
        currentFile: { name: "index.html", content: currentHtml },
        selectedElement,
        modelContextWindow,
        modelId: model,
        reservedOutputTokens: continuationThresholdTokens + CONTINUATION_CONTEXT_BUFFER_TOKENS,
      })

      const recoveryInstruction = isFullDocumentRecovery
        ? "\n\nRecovery instructions: Return one COMPLETE HTML document that keeps the current design, structure, spacing, colors, and typography unless the user explicitly requested a redesign. Apply only the requested change."
        : isPatchRepairRecovery
          ? `\n\n${FOLLOW_UP_REPAIR_INSTRUCTION.trim()}`
        : ""

      baseMessages.push({
        role: "user",
        content: `${context}\n\n${enhancedPromptPrefix}${adaptationPrefix}User Request: ${sanitizedPrompt || prompt}${recoveryInstruction}`,
      })
    } else {
      baseMessages.push({
        role: "user",
        content: enhancedPromptPrefix
          ? `${enhancedPromptPrefix}${adaptationPrefix}User Request: ${sanitizedPrompt || prompt}`
          : `${adaptationPrefix}User Request: ${sanitizedPrompt || prompt}`,
      })
    }

    const fallbackChain = getModelFallbackChain(model)
    const requestBase = {
      stream: true,
      max_tokens: UPSTREAM_MAX_TOKENS,
      temperature: isFollowUp ? 0.25 : 0.7,
    }

    const openRouterHeaders = {
      Authorization: `Bearer ${openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "CodeUI",
      "X-CodeUI-Request-ID": requestId,
    }

    const requestOpenRouterStream = async (partMessages: Message[]): Promise<UpstreamRequestResult> => {
      let response: Response | null = null
      let modelUsed = model
      let firstFailureStatus: number | null = null

      for (let index = 0; index < fallbackChain.length; index += 1) {
        const candidateModel = fallbackChain[index]

        try {
          const candidateResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: openRouterHeaders,
            signal: requestSignal,
            body: JSON.stringify({
              ...requestBase,
              messages: partMessages,
              model: candidateModel,
            }),
          })

          if (candidateResponse.ok && candidateResponse.body) {
            response = candidateResponse
            modelUsed = candidateModel
            break
          }

          let failureDetails = "AI service error"
          try {
            failureDetails = await candidateResponse.text()
          } catch {
            failureDetails = "Unable to read upstream error body"
          }

          if (firstFailureStatus === null) {
            firstFailureStatus = candidateResponse.status
          }

          logger.warn("OpenRouter model attempt failed", {
            phase: "upstream",
            requestId,
            candidateModel,
            status: candidateResponse.status,
            detail: failureDetails.slice(0, 300),
          })

          const hasMoreCandidates = index < fallbackChain.length - 1
          if (!hasMoreCandidates || !isRecoverableModelFailure(candidateResponse.status)) {
            return {
              response: null,
              modelUsed,
              fatalStatus: candidateResponse.status,
            }
          }
        } catch (fetchError) {
          if (isAbortError(fetchError)) {
            throw fetchError
          }

          logger.warn("OpenRouter network error on model attempt", {
            phase: "upstream",
            requestId,
            candidateModel,
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          })
        }
      }

      return {
        response,
        modelUsed,
        fatalStatus: firstFailureStatus,
      }
    }

    const initialUpstreamRequest = await requestOpenRouterStream(baseMessages)

    if (!initialUpstreamRequest.response || !initialUpstreamRequest.response.body) {
      await refundCreditsIfNeeded(creditContext, "all-models-failed")
      return NextResponse.json(
        {
          error: "AI service unavailable after fallback attempts",
          fallbackAttempted: fallbackChain.length > 1,
        },
        {
          status:
            initialUpstreamRequest.fatalStatus && initialUpstreamRequest.fatalStatus >= 500
              ? 503
              : initialUpstreamRequest.fatalStatus || 503,
        },
      )
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let aggregatedContent = ""
        let totalEmittedContentLength = 0
        let continuationCount = 0
        let totalParts = 0
        let requestAborted = requestSignal.aborted
        const modelsUsed = new Set<string>()
        let lastModelUsed = initialUpstreamRequest.modelUsed

        const closeController = () => {
          try {
            controller.close()
          } catch {
            // Ignore double-close errors during abort/teardown.
          }
        }

        const handleAbort = () => {
          requestAborted = true
          logger.info("Client disconnected from AI stream", {
            phase: "stream",
            requestId,
          })
        }

        requestSignal.addEventListener("abort", handleAbort, { once: true })

        const emitEvent = (type: string, data: unknown) => {
          if (requestAborted) {
            return
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`))
        }

        const maybeRefundForEmptyStream = async (reason: string) => {
          if (totalEmittedContentLength === 0) {
            await refundCreditsIfNeeded(creditContext, reason)
          }
        }

        const emitMeta = () => {
          const payload: StreamMetaEvent = {
            requestId,
            requestedModel: model,
            modelUsed: lastModelUsed,
            fallbackUsed: Array.from(modelsUsed).some((usedModel) => usedModel !== model),
            modelsUsed: Array.from(modelsUsed),
            outputThresholdTokens: continuationThresholdTokens,
            outputThresholdChars: continuationThresholdChars,
            thresholdReached: continuationCount > 0,
            continuationCount,
            totalParts,
            totalContentLength: totalEmittedContentLength,
          }

          emitEvent("meta", payload)
        }

        const emitProgress = (progress: StreamProgressEvent) => {
          emitEvent("progress", progress)
        }

        const buildMessagesForPart = (partNumber: number) => {
          if (partNumber === 1) {
            return baseMessages
          }

          return [
            ...baseMessages,
            {
              role: "assistant" as const,
              content: aggregatedContent,
            },
            {
              role: "user" as const,
              content: buildContinuationPrompt(sanitizedPrompt || prompt, partNumber),
            },
          ]
        }

        let activeResponse: Response | null = initialUpstreamRequest.response
        let activeModelUsed = initialUpstreamRequest.modelUsed

        emitMeta()
        emitProgress({
          stage: "preparing",
          message: "Analyzing request...",
          partNumber: 1,
          continuationCount,
          totalContentLength: 0,
        })

        try {
          while (activeResponse && totalParts < MAX_CONTINUATIONS + 1) {
            throwIfAborted(requestSignal)

            totalParts += 1
            lastModelUsed = activeModelUsed
            modelsUsed.add(activeModelUsed)

            emitMeta()
            emitProgress({
              stage: totalParts === 1 ? "generating" : "continuing",
              message:
                totalParts === 1
                  ? "Generating code..."
                  : `Continuing generation (part ${totalParts})...`,
              partNumber: totalParts,
              continuationCount,
              totalContentLength: totalEmittedContentLength,
              thresholdReached: continuationCount > 0,
            })

            const partResult = await streamOpenRouterResponse({
              response: activeResponse,
              thresholdChars: continuationThresholdChars,
              signal: requestSignal,
              onContent: (content) => {
                aggregatedContent += content
                totalEmittedContentLength += content.length
                emitEvent("content", content)
              },
              onThinking: (thinking) => {
                emitEvent("thinking", thinking)
              },
            })

            if (requestAborted) {
              closeController()
              return
            }

            if (partResult.contentLength === 0 && totalEmittedContentLength === 0) {
              await maybeRefundForEmptyStream("empty-stream")
              emitEvent("error", "Empty or insufficient response from AI")
              closeController()
              return
            }

            const needsContinuation = shouldContinueGeneration({
              aggregateContent: aggregatedContent,
              thresholdReached: partResult.thresholdReached,
              continuationCount,
              isFollowUp,
            })

            if (!needsContinuation) {
              emitMeta()
              emitProgress({
                stage: "finalizing",
                message: "Finalizing editor update...",
                partNumber: totalParts,
                continuationCount,
                totalContentLength: totalEmittedContentLength,
                thresholdReached: continuationCount > 0,
              })
              closeController()
              return
            }

            continuationCount += 1
            emitMeta()
            emitProgress({
              stage: "continuing",
              message: `Preparing continuation part ${continuationCount + 1}...`,
              partNumber: continuationCount + 1,
              continuationCount,
              totalContentLength: totalEmittedContentLength,
              thresholdReached: true,
            })

            const nextUpstreamRequest = await requestOpenRouterStream(buildMessagesForPart(continuationCount + 1))
            if (!nextUpstreamRequest.response || !nextUpstreamRequest.response.body) {
              logger.warn("Continuation request failed", {
                phase: "upstream",
                requestId,
                partNumber: continuationCount + 1,
                fatalStatus: nextUpstreamRequest.fatalStatus,
              })

              emitProgress({
                stage: "finalizing",
                message: "Finalizing partial update after continuation failure...",
                partNumber: totalParts,
                continuationCount,
                totalContentLength: totalEmittedContentLength,
                thresholdReached: true,
              })
              closeController()
              return
            }

            activeResponse = nextUpstreamRequest.response
            activeModelUsed = nextUpstreamRequest.modelUsed
          }

          emitMeta()
          emitProgress({
            stage: "finalizing",
            message: "Finalizing editor update...",
            partNumber: totalParts,
            continuationCount,
            totalContentLength: totalEmittedContentLength,
            thresholdReached: continuationCount > 0,
          })
          closeController()
        } catch (error) {
          if (isAbortError(error) || requestSignal.aborted) {
            closeController()
            return
          }

          logger.error("Stream error", {
            phase: "stream",
            requestId,
            error: error instanceof Error ? error.message : String(error),
          })
          await maybeRefundForEmptyStream("stream-error")
          try {
            emitEvent("error", error instanceof Error ? error.message : "AI stream error")
            closeController()
          } catch {
            controller.error(error)
          }
        } finally {
          requestSignal.removeEventListener("abort", handleAbort)
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-CodeUI-Model-Requested": model,
        "X-CodeUI-Model-Used": initialUpstreamRequest.modelUsed,
        "X-CodeUI-Request-ID": requestId,
      },
    })
  } catch (error) {
    logger.error("AI endpoint error", {
      phase: "route",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: RequestBody = await req.json()
    const modifiedRequest = new NextRequest(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({ ...body, isFollowUp: true }),
    })

    return POST(modifiedRequest)
  } catch (error) {
    logger.error("AI PUT endpoint error", {
      phase: "route",
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
