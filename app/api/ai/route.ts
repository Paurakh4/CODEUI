import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildContext } from "@/lib/context-builder"
import connectDB from "@/lib/db"
import { User, UsageLog } from "@/lib/models"
import {
  getCombinedSystemPrompt,
} from "@/lib/prompts/frontend-design"
import { FOLLOW_UP_REPAIR_INSTRUCTION, FOLLOW_UP_SYSTEM_PROMPT, SURGICAL_EDIT_SYSTEM_PROMPT, SURGICAL_EDIT_REPAIR_INSTRUCTION, COPY_CONSISTENCY_INSTRUCTION, COLOR_EXHAUSTIVENESS_INSTRUCTION, HARDENED_PRESERVATION_INSTRUCTION } from "@/lib/prompts/reprompt-system"
import {
  isFullDocumentRecoveryMode,
  isRecoveryModeActive,
  type RecoveryModeValue,
} from "@/lib/recovery-mode"
import {
  getModelById,
  isVisionCapableModel,
  isByokModelId,
} from "@/lib/ai-models"
import {
  getRuntimeDefaultModelIdForUser,
  getRuntimeModelByIdForUser,
  getRuntimeModelFallbackChainForUser,
  getRuntimeModelsByIdForUser,
  isRuntimeModelEnabledForUser,
} from "@/lib/admin/model-policies"
import {
  calculateCreditDeduction,
  getMonthlyCreditsForTier,
  SubscriptionTier,
} from "@/lib/pricing"
import { isInternalUserRole, resolveUserRole } from "@/lib/admin/rbac"
import {
  NEW_FILE_END,
  PROJECT_NAME_END,
  REPLACE_END,
  UPDATE_FILE_END,
} from "@/lib/constants"
import { detectIncompletePatchBlocks, validateAIResponse } from "@/lib/parsers/stream-parser"
import {
  hasCompleteHtmlDocument,
  hasStructuredPatchMarkers,
} from "@/lib/reprompting/atomic-follow-up"
import {
  finalizeFollowUpResponse,
} from "@/lib/reprompting/follow-up-finalizer"
import { estimateTokenCount } from "@/lib/token-counter"
import { getPromptAdaptationGuidance } from "@/lib/prompt-adaptation"
import { classifyRepromptIntent } from "@/lib/reprompting/intent-classifier"
import { isStyleOnlyPrompt, checkContentPreservation } from "@/lib/reprompting/content-preservation"
import { extractHexConstraints, buildHexConstraintBlock, checkHexConstraintsInOutput } from "@/lib/reprompting/hex-constraints"
import { assessPageHealth, buildPageHealthWarning, isVaguePrompt } from "@/lib/reprompting/page-health-check"
import { normalizePromptIntent } from "@/lib/reprompting/prompt-normalizer"
import { splitMultiPartPrompt, shouldSplitPrompt } from "@/lib/reprompting/prompt-splitter"
import { serializeDesignTokensForPrompt, type DesignTokens } from "@/lib/design-tokens"
import { sanitizeConflictMarkers } from "@/lib/reprompting/conflict-marker-sanitizer"
import { resolveProviderRequestConfig } from "@/lib/ai-provider-client"
import { createRepromptLogger } from "@/lib/utils/reprompt-logger"

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

interface Message {
  role: "user" | "assistant" | "system"
  content: string | ContentPart[]
}

interface ConversationHistoryItem {
  role: "user" | "assistant"
  content: string
}

interface RequestBody {
  prompt: string
  currentHtml?: string
  selectedElement?: string
  model?: string
  isFollowUp?: boolean
  recoveryMode?: RecoveryModeValue
  primaryColor?: string
  secondaryColor?: string
  theme?: "light" | "dark"
  conversationHistory?: ConversationHistoryItem[]
  isRecoveryRequest?: boolean
  images?: string[]
  designTokens?: DesignTokens
  restoreCandidates?: string[]
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
  readTimeoutMs: number
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
  readTimeoutMs: number
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
const MAX_HIDDEN_FOLLOW_UP_RETRIES = 1
const DEFAULT_CONTINUATION_CONTEXT_BUFFER_TOKENS = 4_000
const DEFAULT_UPSTREAM_READ_TIMEOUT_MS = 90_000
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
  readTimeoutMs: number,
  signal?: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  throwIfAborted(signal)

  let timeoutId: NodeJS.Timeout | null = null
  let abortHandler: (() => void) | undefined

  const pendingReads: Array<Promise<ReadableStreamReadResult<Uint8Array>>> = [reader.read()]

  pendingReads.push(
    new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Upstream AI stream timed out after ${readTimeoutMs}ms`))
      }, readTimeoutMs)
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
  readTimeoutMs,
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
      nextChunk = await readStreamChunkWithTimeout(reader, readTimeoutMs, signal)
    } catch (error) {
      await reader.cancel().catch(() => { })
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
        await reader.cancel().catch(() => { })
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

    const userId = session.user.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const runtimeDefaultModelId = await getRuntimeDefaultModelIdForUser(userId)

    const body: RequestBody = await req.json()
    const {
      prompt,
      currentHtml,
      selectedElement,
      model = runtimeDefaultModelId,
      isFollowUp = false,
      recoveryMode,
      primaryColor,
      secondaryColor,
      theme,
      conversationHistory,
      isRecoveryRequest,
      images,
      designTokens,
      restoreCandidates,
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

    const isByokModel = isByokModelId(model)

    if (!(await isRuntimeModelEnabledForUser(userId, model))) {
      return NextResponse.json(
        { error: `Model \"${model}\" is not enabled or does not exist` },
        { status: 400 },
      )
    }

    // Server-side guard: images require a vision-capable model
    const hasImages = Array.isArray(images) && images.length > 0
    if (hasImages && !isVisionCapableModel(model)) {
      return NextResponse.json(
        { error: "Selected model does not support image input. Pick a vision-capable model." },
        { status: 400 },
      )
    }

    const isFullDocumentRecovery =
      isFollowUp &&
      (isFullDocumentRecoveryMode(recoveryMode) ||
        (typeof prompt === "string" && prompt.includes(FULL_DOCUMENT_RECOVERY_FLAG)))

    const recoveryHeader = req.headers.get("x-codeui-recovery") === "1"
    const shouldChargeCredits = !isByokModel && !(isRecoveryRequest || recoveryHeader || isRecoveryModeActive(recoveryMode) || isFullDocumentRecovery)
    const sanitizedPrompt = prompt.replace(FULL_DOCUMENT_RECOVERY_FLAG, "").trim()

    let creditContext: CreditContext | null = null

    try {
      await connectDB()
      const user = await User.findById(userId)
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      const userEmail = user.email || session.user.email || ""
      const effectiveRole = resolveUserRole(user.role, userEmail)
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
        if (isInternalUserRole(effectiveRole)) {
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

    // ── Intent classification for follow-up prompts ──
    // `text` and `color` intents are candidates for surgical SEARCH/REPLACE
    // mode, which is much faster than full-document regeneration.
    const repromptIntent = isFollowUp && currentHtml
      ? classifyRepromptIntent(prompt)
      : null
    // ── Surgical mode is now the DEFAULT for ALL follow-up reprompts ──
    // Every model receives SURGICAL_EDIT_SYSTEM_PROMPT (SEARCH/REPLACE) first.
    // If a model returns full HTML instead, the finalizer applies it as a
    // fallback and logs a diffCompliant warning.
    const surgicalMode = repromptIntent !== null &&
      !isRecoveryModeActive(recoveryMode)

    // ── No-op detection for follow-up prompts ──
    // Before spending credits on an upstream call, check if the current
    // HTML already satisfies the request. Heuristic fast-path first, then
    // a lightweight LLM check if uncertain.
    if (isFollowUp && currentHtml && !isRecoveryModeActive(recoveryMode)) {
      const { heuristicAlreadySatisfied } = await import("@/lib/reprompting/noop-check")
      const heuristicResult = heuristicAlreadySatisfied(prompt, currentHtml)
      if (heuristicResult === true) {
        await refundCreditsIfNeeded(creditContext, "no-op (heuristic)")
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: "noop",
              data: { reason: "The page already matches your request — no changes needed." },
            })}\n\n`))
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", data: {} })}\n\n`))
            controller.close()
          },
        })
        return new NextResponse(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        })
      }
    }

    const systemPrompt = surgicalMode
      ? SURGICAL_EDIT_SYSTEM_PROMPT
      : isFollowUp
        ? FOLLOW_UP_SYSTEM_PROMPT
        : getCombinedSystemPrompt()

    const modelContextWindow = (await getRuntimeModelByIdForUser(userId, model))?.contextLength ?? getModelById(model)?.contextLength
    const continuationThresholdTokens = CONTINUATION_THRESHOLD_TOKENS
    const continuationThresholdChars = continuationThresholdTokens * 4
    const conversationBudgetTokens = Math.floor((modelContextWindow ?? 64_000) * 0.15)
    const historyMessages = normalizeConversationHistory(conversationHistory, conversationBudgetTokens)
    const requestPrompt = sanitizedPrompt || prompt
    const promptAdaptationGuidance = getPromptAdaptationGuidance(requestPrompt)
    const adaptationPrefix = promptAdaptationGuidance ? `${promptAdaptationGuidance}\n\n` : ""

    // ── Prompt normalization (Bug #9) ──
    const normalizedIntent = normalizePromptIntent(requestPrompt)
    const effectivePrompt = isFollowUp ? normalizedIntent.structured : requestPrompt

    // ── Hex color hard constraints (Bug #4) ──
    const hexConstraints = extractHexConstraints(requestPrompt)
    const hexConstraintBlock = hexConstraints.length > 0 ? buildHexConstraintBlock(hexConstraints) : ""

    // ── Page health check (Bug #6) ──
    const pageHealthIssues = isFollowUp && currentHtml ? assessPageHealth(currentHtml) : []
    const isVague = isVaguePrompt(requestPrompt) || repromptIntent?.kind === "vague"
    const shouldInjectHealthWarning = pageHealthIssues.length > 0 && (isVague || pageHealthIssues.some((i) => i.severity === "critical"))
    const healthWarning = shouldInjectHealthWarning ? buildPageHealthWarning(pageHealthIssues) : ""

    // ── Design tokens injection (Bug #8) ──
    const designTokensBlock = designTokens ? serializeDesignTokensForPrompt(designTokens) : ""

    // ── Restore reference injection (Bug #3) ──
    let restoreReferenceBlock = ""
    if (repromptIntent?.kind === "restore" && restoreCandidates?.length) {
      const bestCandidate = restoreCandidates[0]
      if (bestCandidate && bestCandidate.trim().length > 100) {
        restoreReferenceBlock = [
          "RESTORE REFERENCE — a previous version of this page contained the following content.",
          "Use this as reference to restore the requested text/names/prices verbatim:",
          "```html",
          bestCandidate.slice(0, 8_000),
          "```",
          "",
        ].join("\n")
      }
    }

    // Append copy-consistency guidance when the intent is a text change.
    const copyConsistencySuffix = repromptIntent?.kind === "text"
      ? `\n\n${COPY_CONSISTENCY_INSTRUCTION.trim()}`
      : ""

    // Append accent-exhaustiveness guidance when the intent is a color change
    // so the model updates every element using the old accent (toggles, pills,
    // badges, icons, focus rings, etc.) — not just buttons and headings.
    const colorExhaustivenessSuffix = repromptIntent?.kind === "color"
      ? `\n\n${COLOR_EXHAUSTIVENESS_INSTRUCTION.trim()}`
      : ""

    // ── Hardened preservation (always appended for follow-ups) ──
    const hardenedPreservation = isFollowUp ? `\n\n${HARDENED_PRESERVATION_INSTRUCTION.trim()}` : ""

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

      const recoveryInstruction = isRecoveryModeActive(recoveryMode)
        ? surgicalMode
          ? `\n\n${SURGICAL_EDIT_REPAIR_INSTRUCTION.trim()}`
          : `\n\n${FOLLOW_UP_REPAIR_INSTRUCTION.trim()}`
        : ""

      const textContent = [
        designTokensBlock,
        healthWarning,
        restoreReferenceBlock,
        context,
        "",
        adaptationPrefix,
        hexConstraintBlock,
        `User Request: ${effectivePrompt}`,
        copyConsistencySuffix,
        colorExhaustivenessSuffix,
        recoveryInstruction,
        hardenedPreservation,
      ].filter(Boolean).join("\n")
      baseMessages.push({
        role: "user",
        content: hasImages
          ? [{ type: "text", text: textContent }, ...images!.map((url): ContentPart => ({ type: "image_url", image_url: { url } }))]
          : textContent,
      })
    } else {
      const textContent = [
        adaptationPrefix,
        hexConstraintBlock,
        `User Request: ${effectivePrompt}`,
      ].filter(Boolean).join("\n")
      baseMessages.push({
        role: "user",
        content: hasImages
          ? [{ type: "text", text: textContent }, ...images!.map((url): ContentPart => ({ type: "image_url", image_url: { url } }))]
          : textContent,
      })
    }

    const fallbackChain = await getRuntimeModelFallbackChainForUser(userId, model)
    const runtimeModelsById = await getRuntimeModelsByIdForUser(userId)
    const requestBase = {
      stream: true,
      max_tokens: UPSTREAM_MAX_TOKENS,
      temperature: surgicalMode ? 0.1 : isFollowUp ? 0.25 : 0.7,
    }

    const requestOpenRouterStream = async (partMessages: Message[]): Promise<UpstreamRequestResult> => {
      let response: Response | null = null
      let modelUsed = model
      let firstFailureStatus: number | null = null
      let readTimeoutMs = UPSTREAM_READ_TIMEOUT_MS

      for (let index = 0; index < fallbackChain.length; index += 1) {
        const candidateModel = fallbackChain[index]

        try {
          const providerConfig = await resolveProviderRequestConfig({
            modelId: candidateModel,
            model: runtimeModelsById.get(candidateModel),
            requestId,
            openRouterReadTimeoutMs: UPSTREAM_READ_TIMEOUT_MS,
            userId,
          })
          const candidateResponse = await fetch(providerConfig.endpoint, {
            method: "POST",
            headers: providerConfig.headers,
            signal: requestSignal,
            body: JSON.stringify({
              ...requestBase,
              messages: partMessages,
              model: providerConfig.upstreamModelId,
            }),
          })

          if (candidateResponse.ok && candidateResponse.body) {
            response = candidateResponse
            modelUsed = candidateModel
            readTimeoutMs = providerConfig.readTimeoutMs
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

          logger.warn("AI provider model attempt failed", {
            phase: "upstream",
            requestId,
            candidateModel,
            sourceProvider: providerConfig.sourceProvider,
            status: candidateResponse.status,
            detail: failureDetails.slice(0, 300),
          })

          const hasMoreCandidates = index < fallbackChain.length - 1
          if (!hasMoreCandidates || !isRecoverableModelFailure(candidateResponse.status)) {
            return {
              response: null,
              modelUsed,
              fatalStatus: candidateResponse.status,
              readTimeoutMs,
            }
          }
        } catch (fetchError) {
          if (isAbortError(fetchError)) {
            throw fetchError
          }

          logger.warn("AI provider network error on model attempt", {
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
        readTimeoutMs,
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
        let hiddenFollowUpRetryCount = 0
        let requestAborted = requestSignal.aborted
        // For initial generation we stream raw model output to the client so
        // Monaco can render it live. For follow-up edits we still buffer the
        // final content (so the in-memory finalizer + hidden retry can
        // validate SEARCH/REPLACE blocks before they reach the client) but we
        // additionally emit a "draft" event with each chunk so Monaco can
        // show live progress during a reprompt without the client applying
        // half-applied patches.
        const streamContentIncrementally = !isFollowUp
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

        /**
         * Emit final content after running conflict-marker sanitization,
         * content-preservation, and hex-constraint checks. If content would be
         * wiped on a style-only prompt, emit a `content-wipe-rejected` event
         * instead so the client can restore the previous version.
         */
        const emitFinalContentAndClose = (finalContent: string) => {
          // ── Conflict marker sanitization (Bug #1) ──
          // Run on finalized HTML only, after patch application is complete.
          const sanitizedContent = sanitizeConflictMarkers(finalContent)

          // ── Content preservation check (Bug #1 from Session 2) ──
          if (isFollowUp && currentHtml && sanitizedContent) {
            const styleOnly = isStyleOnlyPrompt(requestPrompt) ||
              repromptIntent?.kind === "color" ||
              repromptIntent?.kind === "layout"
            if (styleOnly) {
              const preservation = checkContentPreservation(currentHtml, sanitizedContent)
              if (!preservation.preserved) {
                logger.warn("Content wipe rejected", {
                  phase: "finalize",
                  requestId,
                  lostTokens: preservation.lostTokens.slice(0, 20),
                  lostPriceTokens: preservation.lostPriceTokens,
                  lossRatio: preservation.lossRatio,
                })
                emitEvent("content-wipe-rejected", {
                  reason: "Content would have been lost — kept your previous version.",
                  lostTokens: preservation.lostTokens.slice(0, 30),
                  lostPriceTokens: preservation.lostPriceTokens,
                  lossRatio: preservation.lossRatio,
                })
                closeController()
                return
              }
            }

            // ── Hex constraint check (Bug #4 from Session 2) ──
            if (hexConstraints.length > 0) {
              const missingHex = checkHexConstraintsInOutput(hexConstraints, sanitizedContent)
              if (missingHex.length > 0) {
                logger.warn("Hex constraints not respected", {
                  phase: "finalize",
                  requestId,
                  missingHex,
                })
                emitEvent("hex-warning", {
                  message: `Some exact hex colors were not applied: ${missingHex.join(", ")}`,
                  missingHex,
                })
              }
            }
          }

          emitEvent("content", sanitizedContent)
          closeController()
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

        const buildHiddenFollowUpRetryMessages = (reason: string): Message[] => [
          ...baseMessages,
          {
            role: "user" as const,
            content: [
              "The previous follow-up attempt was rejected before it reached the editor.",
              `Rejection reason: ${reason}`,
              "Try again from the original current HTML and original user request.",
              surgicalMode
                ? SURGICAL_EDIT_REPAIR_INSTRUCTION.trim()
                : FOLLOW_UP_REPAIR_INSTRUCTION.trim(),
            ].join("\n\n"),
          },
        ]

        const retryAtomicFollowUpIfNeeded = async (): Promise<"retry" | "continue" | "closed"> => {
          if (streamContentIncrementally) {
            return "continue"
          }

          // Step 1: Run the model-agnostic finalizer. This handles the vast
          // majority of non-Gemini outputs (thinking tags, fenced blocks,
          // narration, SEARCH/REPLACE patches) without a re-prompt round trip.
          const finalized = finalizeFollowUpResponse({
            rawContent: aggregatedContent,
            currentHtml: currentHtml ?? "",
            preferPatches: surgicalMode,
          })

          if (finalized.ok) {
            // ── Sanitize conflict markers from finalized HTML (Bug #1) ──
            // Run ONLY on finalized HTML after patch application, never on
            // the raw aggregate while the StreamParser still needs it.
            const sanitized = sanitizeConflictMarkers(finalized.html)
            if (sanitized !== finalized.html) {
              logger.warn("Conflict markers stripped from finalized HTML", {
                phase: "finalize",
                requestId,
                originalLength: finalized.html.length,
                sanitizedLength: sanitized.length,
              })
            }
            aggregatedContent = sanitized
            totalEmittedContentLength = sanitized.length
            logger.info("Follow-up response finalized via in-memory strategy", {
              phase: "finalize",
              requestId,
              strategy: finalized.strategy,
              appliedPatchCount: finalized.appliedPatchCount,
              diffCompliant: finalized.diffCompliant ?? true,
            })
            return "continue"
          }

          const outputIssue = finalized.reason

          if (hiddenFollowUpRetryCount >= MAX_HIDDEN_FOLLOW_UP_RETRIES) {
            logger.warn("Atomic follow-up failed validation after hidden retry budget", {
              phase: "validation",
              requestId,
              reason: outputIssue,
            })
            emitEvent("error", {
              message: "Could not complete the update automatically. The previous page was kept.",
              reason: outputIssue,
            })
            closeController()
            return "closed"
          }

          hiddenFollowUpRetryCount += 1
          logger.warn("Retrying atomic follow-up inside API", {
            phase: "validation",
            requestId,
            reason: outputIssue,
            hiddenFollowUpRetryCount,
          })
          emitProgress({
            stage: "continuing",
            message: "Refining update...",
            partNumber: totalParts + 1,
            continuationCount,
            totalContentLength: totalEmittedContentLength,
            thresholdReached: continuationCount > 0,
          })

          const retryUpstreamRequest = await requestOpenRouterStream(buildHiddenFollowUpRetryMessages(outputIssue))
          if (!retryUpstreamRequest.response || !retryUpstreamRequest.response.body) {
            emitEvent("error", {
              message: "Could not complete the update automatically. The previous page was kept.",
              reason: outputIssue,
            })
            closeController()
            return "closed"
          }

          aggregatedContent = ""
          totalEmittedContentLength = 0
          continuationCount = 0
          totalParts = 0
          activeResponse = retryUpstreamRequest.response
          activeModelUsed = retryUpstreamRequest.modelUsed
          activeReadTimeoutMs = retryUpstreamRequest.readTimeoutMs
          return "retry"
        }

        let activeResponse: Response | null = initialUpstreamRequest.response
        let activeModelUsed = initialUpstreamRequest.modelUsed
        let activeReadTimeoutMs = initialUpstreamRequest.readTimeoutMs

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
                  ? isFollowUp
                    ? "Updating page..."
                    : "Generating code..."
                  : isFollowUp
                    ? "Refining update..."
                    : `Continuing generation (part ${totalParts})...`,
              partNumber: totalParts,
              continuationCount,
              totalContentLength: totalEmittedContentLength,
              thresholdReached: continuationCount > 0,
            })

            const partResult = await streamOpenRouterResponse({
              response: activeResponse,
              thresholdChars: continuationThresholdChars,
              readTimeoutMs: activeReadTimeoutMs,
              signal: requestSignal,
              onContent: (content) => {
                aggregatedContent += content
                totalEmittedContentLength += content.length
                if (streamContentIncrementally) {
                  emitEvent("content", content)
                } else {
                  // Buffered follow-up path: still surface partial output to
                  // the client as a non-applied "draft" so Monaco can render
                  // live progress while we wait for the full response to be
                  // validated.
                  emitEvent("draft", content)
                }
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
              const retryDecision = await retryAtomicFollowUpIfNeeded()
              if (retryDecision === "retry") {
                continue
              }
              if (retryDecision === "closed") {
                return
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
              if (!streamContentIncrementally && aggregatedContent) {
                emitFinalContentAndClose(aggregatedContent)
                return
              }
              closeController()
              return
            }

            continuationCount += 1
            emitMeta()
            emitProgress({
              stage: "continuing",
              message: isFollowUp
                ? "Refining update..."
                : `Preparing continuation part ${continuationCount + 1}...`,
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

              if (!streamContentIncrementally) {
                const retryDecision = await retryAtomicFollowUpIfNeeded()
                if (retryDecision === "retry") {
                  continue
                }
                if (retryDecision === "closed") {
                  return
                }
                if (aggregatedContent) {
                  emitFinalContentAndClose(aggregatedContent)
                  return
                }
              }

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
            activeReadTimeoutMs = nextUpstreamRequest.readTimeoutMs
          }

          const retryDecision = await retryAtomicFollowUpIfNeeded()
          if (retryDecision === "retry") {
            while (activeResponse && totalParts < MAX_CONTINUATIONS + 1) {
              throwIfAborted(requestSignal)

              totalParts += 1
              lastModelUsed = activeModelUsed
              modelsUsed.add(activeModelUsed)

              emitMeta()
              emitProgress({
                stage: totalParts === 1 ? "generating" : "continuing",
                message: totalParts === 1 ? "Updating page..." : "Refining update...",
                partNumber: totalParts,
                continuationCount,
                totalContentLength: totalEmittedContentLength,
                thresholdReached: continuationCount > 0,
              })

              const partResult = await streamOpenRouterResponse({
                response: activeResponse,
                thresholdChars: continuationThresholdChars,
                readTimeoutMs: activeReadTimeoutMs,
                signal: requestSignal,
                onContent: (content) => {
                  aggregatedContent += content
                  totalEmittedContentLength += content.length
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
                const secondRetryDecision = await retryAtomicFollowUpIfNeeded()
                if (secondRetryDecision === "retry") {
                  continue
                }
                if (secondRetryDecision === "closed") {
                  return
                }
                break
              }

              continuationCount += 1
              emitMeta()
              emitProgress({
                stage: "continuing",
                message: "Refining update...",
                partNumber: continuationCount + 1,
                continuationCount,
                totalContentLength: totalEmittedContentLength,
                thresholdReached: true,
              })

              const nextUpstreamRequest = await requestOpenRouterStream(buildMessagesForPart(continuationCount + 1))
              if (!nextUpstreamRequest.response || !nextUpstreamRequest.response.body) {
                emitEvent("error", "Could not complete the update automatically. The previous page was kept.")
                closeController()
                return
              }

              activeResponse = nextUpstreamRequest.response
              activeModelUsed = nextUpstreamRequest.modelUsed
              activeReadTimeoutMs = nextUpstreamRequest.readTimeoutMs
            }
          } else if (retryDecision === "closed") {
            return
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
          if (!streamContentIncrementally && aggregatedContent) {
            emitFinalContentAndClose(aggregatedContent)
            return
          }
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
