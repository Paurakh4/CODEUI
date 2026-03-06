import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildContext } from "@/lib/context-builder"
import connectDB from "@/lib/db"
import { User, UsageLog } from "@/lib/models"
import {
  getCombinedSystemPrompt,
} from "@/lib/prompts/frontend-design"
import { FOLLOW_UP_SYSTEM_PROMPT } from "@/lib/prompts/reprompt-system"
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
import { estimateTokenCount } from "@/lib/token-counter"
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
  recoveryMode?: boolean | "full-document"
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

const FULL_DOCUMENT_RECOVERY_FLAG = "FULL_DOCUMENT_RECOVERY_MODE"
const MAX_PROMPT_LENGTH = 10_000
const logger = createRepromptLogger("api-ai-route")

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
      (recoveryMode === true ||
        recoveryMode === "full-document" ||
        (typeof prompt === "string" && prompt.includes(FULL_DOCUMENT_RECOVERY_FLAG)))

    const recoveryHeader = req.headers.get("x-codeui-recovery") === "1"
    const shouldChargeCredits = !(isRecoveryRequest || recoveryHeader || isFullDocumentRecovery)
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
    const conversationBudgetTokens = Math.floor((modelContextWindow ?? 64_000) * 0.15)
    const historyMessages = normalizeConversationHistory(conversationHistory, conversationBudgetTokens)
    const enhancedPromptPrefix = buildEnhancedPromptPrefix({
      enhancedPrompts,
      primaryColor,
      secondaryColor,
      theme,
    })

    const messages: Message[] = [{ role: "system", content: systemPrompt }]
    if (historyMessages.length > 0) {
      messages.push(...historyMessages)
    }

    if (isFollowUp && currentHtml) {
      const context = buildContext({
        currentFile: { name: "index.html", content: currentHtml },
        selectedElement,
        modelId: model,
      })

      const recoveryInstruction = isFullDocumentRecovery
        ? "\n\nRecovery instructions: Return one COMPLETE HTML document that keeps the current design, structure, spacing, colors, and typography unless the user explicitly requested a redesign. Apply only the requested change."
        : ""

      messages.push({
        role: "user",
        content: `${context}\n\n${enhancedPromptPrefix}User Request: ${sanitizedPrompt || prompt}${recoveryInstruction}`,
      })
    } else {
      messages.push({
        role: "user",
        content: enhancedPromptPrefix
          ? `${enhancedPromptPrefix}User Request: ${sanitizedPrompt || prompt}`
          : sanitizedPrompt || prompt,
      })
    }

    const fallbackChain = getModelFallbackChain(model)
    const requestBase = {
      messages,
      stream: true,
      max_tokens: 16000,
      temperature: isFollowUp ? 0.25 : 0.7,
    }

    const openRouterHeaders = {
      Authorization: `Bearer ${openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "CodeUI",
      "X-CodeUI-Request-ID": requestId,
    }

    let response: Response | null = null
    let modelUsed = model
    let firstFailureStatus: number | null = null
    const fallbackFailures: string[] = []

    for (let index = 0; index < fallbackChain.length; index += 1) {
      const candidateModel = fallbackChain[index]

      try {
        const candidateResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: openRouterHeaders,
          body: JSON.stringify({
            ...requestBase,
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

        fallbackFailures.push(`[${candidateModel}] ${candidateResponse.status}: ${failureDetails.slice(0, 300)}`)
        logger.warn("OpenRouter model attempt failed", {
          phase: "upstream",
          requestId,
          candidateModel,
          status: candidateResponse.status,
          detail: failureDetails.slice(0, 300),
        })

        const hasMoreCandidates = index < fallbackChain.length - 1
        if (!hasMoreCandidates || !isRecoverableModelFailure(candidateResponse.status)) {
          await refundCreditsIfNeeded(creditContext, `upstream-status-${candidateResponse.status}`)
          return NextResponse.json(
            {
              error: "AI service error",
              fallbackAttempted: fallbackChain.length > 1,
            },
            { status: candidateResponse.status },
          )
        }
      } catch (fetchError) {
        fallbackFailures.push(
          `[${candidateModel}] network: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        )
        logger.warn("OpenRouter network error on model attempt", {
          phase: "upstream",
          requestId,
          candidateModel,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
        })
      }
    }

    if (!response || !response.body) {
      await refundCreditsIfNeeded(creditContext, "all-models-failed")
      return NextResponse.json(
        {
          error: "AI service unavailable after fallback attempts",
          fallbackAttempted: fallbackChain.length > 1,
        },
        { status: firstFailureStatus && firstFailureStatus >= 500 ? 503 : firstFailureStatus || 503 },
      )
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response?.body?.getReader()
        if (!reader) {
          await refundCreditsIfNeeded(creditContext, "missing-reader")
          controller.close()
          return
        }

        let buffer = ""
        let emittedContentLength = 0

        const emitEvent = (type: string, data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`))
        }

        const maybeRefundForEmptyStream = async (reason: string) => {
          if (emittedContentLength === 0) {
            await refundCreditsIfNeeded(creditContext, reason)
          }
        }

        emitEvent("meta", {
          requestedModel: model,
          modelUsed,
          fallbackUsed: modelUsed !== model,
        })

        try {
          while (true) {
            const { done, value } = await reader.read()

            if (done) {
              if (buffer.trim()) {
                const finalLine = buffer.trim()
                if (finalLine.startsWith("data: ")) {
                  const data = finalLine.slice(6).trim()
                  if (data !== "[DONE]") {
                    try {
                      const parsed = JSON.parse(data)
                      const content = parsed.choices?.[0]?.delta?.content
                      const reasoning = parsed.choices?.[0]?.delta?.reasoning
                      if (content) {
                        emittedContentLength += content.length
                        emitEvent("content", content)
                      }
                      if (reasoning) {
                        emitEvent("thinking", reasoning)
                      }
                    } catch {
                      // Ignore malformed trailing payloads.
                    }
                  }
                }
              }

              await maybeRefundForEmptyStream("empty-stream")
              if (emittedContentLength === 0) {
                emitEvent("error", "Empty or insufficient response from AI")
              }
              controller.close()
              break
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (!line.startsWith("data: ")) {
                continue
              }

              const data = line.slice(6).trim()
              if (data === "[DONE]") {
                await maybeRefundForEmptyStream("empty-stream")
                if (emittedContentLength === 0) {
                  emitEvent("error", "Empty or insufficient response from AI")
                }
                controller.close()
                return
              }

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                const reasoning = parsed.choices?.[0]?.delta?.reasoning

                if (content) {
                  emittedContentLength += content.length
                  emitEvent("content", content)
                }

                if (reasoning) {
                  emitEvent("thinking", reasoning)
                }
              } catch {
                // Skip invalid JSON chunks from upstream.
              }
            }
          }
        } catch (error) {
          logger.error("Stream error", {
            phase: "stream",
            requestId,
            error: error instanceof Error ? error.message : String(error),
          })
          await maybeRefundForEmptyStream("stream-error")
          try {
            emitEvent("error", error instanceof Error ? error.message : "AI stream error")
            controller.close()
          } catch {
            controller.error(error)
          }
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-CodeUI-Model-Requested": model,
        "X-CodeUI-Model-Used": modelUsed,
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
