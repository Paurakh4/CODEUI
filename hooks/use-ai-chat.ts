"use client"

import { useState, useCallback, useRef } from "react"

interface UseAIChatOptions {
  onContentUpdate?: (content: string) => void
  onThinkingUpdate?: (thinking: string) => void
  onComplete?: (result: { rawContent: string; extractedHtml: string }) => void
  onError?: (error: Error) => void
}

interface SendMessageOptions {
  prompt: string
  currentHtml?: string
  model?: string
  isFollowUp?: boolean
}

export function useAIChat(options: UseAIChatOptions = {}) {
  const { onContentUpdate, onThinkingUpdate, onComplete, onError } = options
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [content, setContent] = useState("")
  const [thinking, setThinking] = useState("")
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async ({ prompt, currentHtml, model, isFollowUp }: SendMessageOptions) => {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      abortControllerRef.current = new AbortController()
      setIsGenerating(true)
      setContent("")
      setThinking("")
      setError(null)

      let fullContent = ""
      let fullThinking = ""

      try {
        const response = await fetch("/api/ai", {
          method: isFollowUp ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            currentHtml,
            model,
            isFollowUp,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to generate content")
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("No response body")
        }

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === "content") {
                  fullContent += data.data
                  setContent(fullContent)
                  onContentUpdate?.(fullContent)
                } else if (data.type === "thinking") {
                  fullThinking += data.data
                  setThinking(fullThinking)
                  onThinkingUpdate?.(fullThinking)
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }

        // Extract HTML from the response
        const extractedHtml = extractHtml(fullContent)
        onComplete?.({ rawContent: fullContent, extractedHtml })

        return extractedHtml
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was cancelled
          return null
        }
        
        const error = err instanceof Error ? err : new Error("Unknown error")
        setError(error)
        onError?.(error)
        throw error
      } finally {
        setIsGenerating(false)
        abortControllerRef.current = null
      }
    },
    [onContentUpdate, onThinkingUpdate, onComplete, onError]
  )

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsGenerating(false)
    }
  }, [])

  const reset = useCallback(() => {
    setContent("")
    setThinking("")
    setError(null)
    cancel()
  }, [cancel])

  return {
    sendMessage,
    cancel,
    reset,
    isGenerating,
    content,
    thinking,
    error,
  }
}

// Helper to extract HTML from AI response
function extractHtml(content: string): string {
  // If content starts with <!DOCTYPE, it's already clean HTML
  if (content.trim().startsWith("<!DOCTYPE") || content.trim().startsWith("<html")) {
    return content.trim()
  }

  // Try to extract from markdown code blocks
  const htmlBlockRegex = /```html?\s*([\s\S]*?)```/gi
  const matches = [...content.matchAll(htmlBlockRegex)]
  
  if (matches.length > 0) {
    return matches.map(m => m[1]).join("\n").trim()
  }

  // Try to find complete HTML document
  const doctypeMatch = content.match(/<!DOCTYPE[\s\S]*?<\/html>/i)
  if (doctypeMatch) {
    return doctypeMatch[0].trim()
  }

  const htmlMatch = content.match(/<html[\s\S]*?<\/html>/i)
  if (htmlMatch) {
    return htmlMatch[0].trim()
  }

  // Return as-is if no patterns match
  return content.trim()
}

// Helper to apply SEARCH/REPLACE patches
export function applySearchReplace(originalHtml: string, aiResponse: string): string {
  const patchRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g
  let result = originalHtml
  let match

  while ((match = patchRegex.exec(aiResponse)) !== null) {
    const [, searchBlock, replaceBlock] = match
    const searchContent = searchBlock.trim()
    const replaceContent = replaceBlock.trim()

    if (result.includes(searchContent)) {
      result = result.replace(searchContent, replaceContent)
    }
  }

  // If no patches found, check if response is a complete HTML document
  if (result === originalHtml) {
    const extractedHtml = extractHtml(aiResponse)
    if (extractedHtml.startsWith("<!DOCTYPE") || extractedHtml.startsWith("<html")) {
      return extractedHtml
    }
  }

  return result
}
