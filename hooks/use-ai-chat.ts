"use client"

import { useState, useCallback, useRef } from "react"
import { DIVIDER, REPLACE_END, SEARCH_START } from "@/lib/constants"
import {
  detectIncompletePatchBlocks,
  StreamParser,
  validateAIResponse,
} from "@/lib/parsers/stream-parser"
import { isRecoveryModeActive, type RecoveryModeValue } from "@/lib/recovery-mode"
import { createRepromptLogger } from "@/lib/utils/reprompt-logger"

export interface ConversationHistoryItem {
  role: "user" | "assistant"
  content: string
}

export interface AIStreamMeta {
  requestId?: string
  requestedModel?: string
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

export type AIProgressStage = "preparing" | "generating" | "continuing" | "finalizing"

export interface AIStreamProgress {
  stage: AIProgressStage
  message: string
  partNumber: number
  continuationCount: number
  totalContentLength: number
  thresholdReached?: boolean
}

export interface AICompletionResult {
  rawContent: string
  extractedHtml: string
  failedFiles?: string[]
  recoveryMode?: RecoveryModeValue
  incompletePatches?: number
  validationError?: string
  meta?: AIStreamMeta
}

interface UseAIChatOptions {
  onContentUpdate?: (content: string) => void
  onThinkingUpdate?: (thinking: string) => void
  onProgressUpdate?: (progress: AIStreamProgress) => void
  onComplete?: (result: AICompletionResult) => void
  onCancel?: () => void
  onPatch?: (filePath: string, searchBlock: string, replaceBlock: string) => boolean | void
  onFileUpdate?: (filePath: string) => void
  onProjectNameUpdate?: (name: string) => void
  onNewFile?: (filePath: string, content: string) => void
  onError?: (error: Error) => void
}

interface SendMessageOptions {
  prompt: string
  currentHtml?: string
  selectedElement?: string
  model?: string
  isFollowUp?: boolean
  recoveryMode?: RecoveryModeValue
  enhancedPrompts?: boolean
  primaryColor?: string
  secondaryColor?: string
  theme?: "light" | "dark"
  conversationHistory?: ConversationHistoryItem[]
}

const logger = createRepromptLogger("use-ai-chat")

function mergeStreamMeta(
  currentMeta: AIStreamMeta | undefined,
  incomingMeta: AIStreamMeta | undefined,
): AIStreamMeta | undefined {
  if (!incomingMeta) {
    return currentMeta
  }

  const mergedModels = [...new Set([...(currentMeta?.modelsUsed ?? []), ...(incomingMeta.modelsUsed ?? [])])]

  return {
    ...currentMeta,
    ...incomingMeta,
    modelsUsed: mergedModels.length > 0 ? mergedModels : undefined,
  }
}

export function useAIChat(options: UseAIChatOptions = {}) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [isGenerating, setIsGenerating] = useState(false)
  const [content, setContent] = useState("")
  const [thinking, setThinking] = useState("")
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestCounterRef = useRef(0)
  const activeRequestIdRef = useRef<number | null>(null)
  const failedFilesRef = useRef<Set<string>>(new Set())
  const incompletePatchCountRef = useRef(0)
  const parserRef = useRef<StreamParser | null>(null)

  if (!parserRef.current) {
    parserRef.current = new StreamParser({
      onFileUpdate: (path) => optionsRef.current.onFileUpdate?.(path),
      onProjectNameUpdate: (name) => optionsRef.current.onProjectNameUpdate?.(name),
      onNewFile: (path, fileContent) => optionsRef.current.onNewFile?.(path, fileContent),
      onIncompletePatch: (count) => {
        incompletePatchCountRef.current = count
      },
      onPatch: (path, search, replace) => {
        const success = optionsRef.current.onPatch?.(path, search, replace)
        if (success === false) {
          failedFilesRef.current.add(path)
        }
      },
    })
  }

  const abortActiveRequest = useCallback((notifyCancel: boolean) => {
    const hasActiveRequest = Boolean(abortControllerRef.current) || activeRequestIdRef.current !== null

    abortControllerRef.current?.abort()
    activeRequestIdRef.current = null
    abortControllerRef.current = null
    setIsGenerating(false)
    setContent("")
    setThinking("")
    setError(null)
    failedFilesRef.current.clear()
    incompletePatchCountRef.current = 0
    parserRef.current?.reset()

    if (notifyCancel && hasActiveRequest) {
      optionsRef.current.onCancel?.()
    }
  }, [])

  const sendMessage = useCallback(
    async ({
      prompt,
      currentHtml,
      selectedElement,
      model,
      isFollowUp,
      recoveryMode,
      enhancedPrompts,
      primaryColor,
      secondaryColor,
      theme,
      conversationHistory,
    }: SendMessageOptions) => {
      if (abortControllerRef.current) {
        abortActiveRequest(false)
      }

      const requestId = requestCounterRef.current + 1
      requestCounterRef.current = requestId
      activeRequestIdRef.current = requestId

      const abortController = new AbortController()
      abortControllerRef.current = abortController
      setIsGenerating(true)
      setContent("")
      setThinking("")
      setError(null)
      failedFilesRef.current.clear()
      incompletePatchCountRef.current = 0
      parserRef.current?.reset()

      let fullContent = ""
      let fullThinking = ""
      let responseMeta: AIStreamMeta | undefined
      let latestProgress: AIStreamProgress | undefined
      let chunkCount = 0

      const isRequestActive = () => {
        return activeRequestIdRef.current === requestId && !abortController.signal.aborted
      }

      const processSseBlocks = (blocks: string[]) => {
        for (const block of blocks) {
          if (!isRequestActive()) {
            return false
          }

          if (!block.startsWith("data: ")) {
            continue
          }

          try {
            const data = JSON.parse(block.slice(6))

            if (data.type === "meta") {
              if (!isRequestActive()) {
                return false
              }

              responseMeta = mergeStreamMeta(responseMeta, data.data)
              logger.info("Received stream meta", {
                phase: "stream",
                requestId,
                ...responseMeta,
              })
              continue
            }

            if (data.type === "progress") {
              if (!isRequestActive()) {
                return false
              }

              latestProgress = data.data as AIStreamProgress
              if (latestProgress) {
                optionsRef.current.onProgressUpdate?.(latestProgress)
              }
              continue
            }

            if (data.type === "error") {
              throw new Error(data.data || "AI stream error")
            }

            if (data.type === "content") {
              if (!isRequestActive()) {
                return false
              }

              chunkCount += 1
              fullContent += data.data
              setContent(fullContent)
              optionsRef.current.onContentUpdate?.(fullContent)
              parserRef.current?.parse(fullContent)
              continue
            }

            if (data.type === "thinking") {
              if (!isRequestActive()) {
                return false
              }

              fullThinking += data.data
              setThinking(fullThinking)
              optionsRef.current.onThinkingUpdate?.(fullThinking)
            }
          } catch (blockError) {
            if (blockError instanceof Error) {
              throw blockError
            }
          }
        }

        return true
      }

      logger.info("Starting AI request", {
        phase: "stream",
        requestId,
        isFollowUp: Boolean(isFollowUp),
        recoveryMode: isRecoveryModeActive(recoveryMode),
        model,
      })

      try {
        const response = await fetch("/api/ai", {
          method: isFollowUp ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CodeUI-Request-ID": String(requestId),
            "X-CodeUI-Recovery": isRecoveryModeActive(recoveryMode) ? "1" : "0",
          },
          body: JSON.stringify({
            prompt,
            currentHtml,
            selectedElement,
            model,
            isFollowUp,
            recoveryMode,
            enhancedPrompts,
            primaryColor,
            secondaryColor,
            theme,
            conversationHistory,
            isRecoveryRequest: isRecoveryModeActive(recoveryMode),
          }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Failed to generate content" }))
          throw new Error(errorData.error || "Failed to generate content")
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("No response body")
        }

        const readChunk = () => {
          if (!isRequestActive()) {
            throw new DOMException("The request was aborted.", "AbortError")
          }

          return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
            const handleAbort = () => {
              cleanup()
              void reader.cancel().catch(() => {})
              reject(new DOMException("The request was aborted.", "AbortError"))
            }

            const cleanup = () => {
              abortController.signal.removeEventListener("abort", handleAbort)
            }

            abortController.signal.addEventListener("abort", handleAbort, { once: true })

            reader.read().then(
              (result) => {
                cleanup()
                resolve(result)
              },
              (readError) => {
                cleanup()
                reject(readError)
              },
            )
          })
        }

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          if (!isRequestActive()) {
            logger.info("Cancelling stale request", { phase: "stream", requestId })
            await reader.cancel().catch(() => {})
            return null
          }

          const { done, value } = await readChunk()
          if (done) {
            if (buffer.trim()) {
              if (!processSseBlocks(buffer.split("\n\n").filter(Boolean))) {
                return null
              }
            }
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const blocks = buffer.split("\n\n")
          buffer = blocks.pop() || ""
          if (!processSseBlocks(blocks)) {
            await reader.cancel().catch(() => {})
            return null
          }
        }

        if (!isRequestActive()) {
          return null
        }

        const extractedHtml = extractHtml(fullContent)
        const failedFiles = Array.from(failedFilesRef.current)
        const incompletePatches = Math.max(
          incompletePatchCountRef.current,
          detectIncompletePatchBlocks(fullContent),
        )
        const validation = validateAIResponse(fullContent)

        logger.info("Completed AI request", {
          phase: "stream",
          requestId,
          chunkCount,
          contentLength: fullContent.length,
          failedFileCount: failedFiles.length,
          incompletePatches,
          validationError: validation.valid ? undefined : validation.reason,
        })

        if (latestProgress && responseMeta) {
          responseMeta = mergeStreamMeta(responseMeta, {
            continuationCount: latestProgress.continuationCount,
            totalParts: Math.max(responseMeta.totalParts ?? 0, latestProgress.partNumber),
            totalContentLength: latestProgress.totalContentLength,
            thresholdReached: latestProgress.thresholdReached,
          })
        }

        optionsRef.current.onComplete?.({
          rawContent: fullContent,
          extractedHtml,
          failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
          recoveryMode,
          incompletePatches,
          validationError: validation.valid ? undefined : validation.reason,
          meta: responseMeta,
        })

        return extractedHtml
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          logger.info("AI request aborted", { phase: "stream", requestId })
          return null
        }

        if (activeRequestIdRef.current !== requestId) {
          return null
        }

        const nextError = err instanceof Error ? err : new Error("Unknown error")
        logger.error("AI request failed", {
          phase: "stream",
          requestId,
          error: nextError.message,
        })
        setError(nextError)
        optionsRef.current.onError?.(nextError)
        throw nextError
      } finally {
        if (activeRequestIdRef.current === requestId) {
          setIsGenerating(false)
          activeRequestIdRef.current = null
          abortControllerRef.current = null
        }
      }
    },
    [abortActiveRequest],
  )

  const cancel = useCallback(() => {
    abortActiveRequest(true)
  }, [abortActiveRequest])

  const reset = useCallback(() => {
    abortActiveRequest(false)
  }, [abortActiveRequest])

  return {
    sendMessage,
    cancel,
    reset,
    isGenerating,
    content,
    thinking,
    error,
    failedFiles: Array.from(failedFilesRef.current),
  }
}

export function extractHtml(content: string): string {
  const doctypeMatch = content.match(/<!DOCTYPE[\s\S]*?<\/html>/i)
  if (doctypeMatch) {
    return doctypeMatch[0].trim()
  }

  const htmlMatch = content.match(/<html[\s\S]*?<\/html>/i)
  if (htmlMatch) {
    return htmlMatch[0].trim()
  }

  const trimmed = content.trim()
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return trimmed.includes("</html>") ? trimmed : ""
  }

  const htmlBlockRegex = /```html?\s*([\s\S]*?)```/gi
  const matches = [...content.matchAll(htmlBlockRegex)]
  if (matches.length > 0) {
    const extracted = matches.map((match) => match[1]).join("\n").trim()
    if ((extracted.includes("<!DOCTYPE") || extracted.includes("<html")) && extracted.includes("</html>")) {
      return extracted
    }
    return ""
  }

  if (content.includes(SEARCH_START) || content.includes("<<<<<<< UPDATE_FILE")) {
    return ""
  }

  if (trimmed.match(/^[.#@a-z][\w-]*\s*\{/i) || trimmed.match(/^\s*[a-z-]+\s*:/i)) {
    return ""
  }

  return ""
}

export function applySearchReplace(originalHtml: string, aiResponse: string): string {
  const parser = new StreamParser({})
  const patchRegex = new RegExp(
    `${SEARCH_START.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\n([\\s\\S]*?)\\n${DIVIDER.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\n([\\s\\S]*?)\\n${REPLACE_END.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`,
    "g",
  )

  let result = originalHtml
  let appliedPatch = false
  let match: RegExpExecArray | null

  while ((match = patchRegex.exec(aiResponse)) !== null) {
    const [, searchBlock, replaceBlock] = match
    const patchResult = parser.applyPatch(result, searchBlock, replaceBlock, "index.html")
    if (patchResult.success) {
      appliedPatch = true
      result = patchResult.content
    }
  }

  if (!appliedPatch) {
    const extractedHtml = extractHtml(aiResponse)
    if (extractedHtml.startsWith("<!DOCTYPE") || extractedHtml.startsWith("<html")) {
      return extractedHtml
    }
  }

  return result
}
