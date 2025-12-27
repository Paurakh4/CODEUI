import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCombinedSystemPrompt } from "@/lib/prompts/frontend-design"
import { getModelsRecord, isModelEnabled, getDefaultModelId } from "@/lib/ai-models"

// Get enabled AI models from configuration
// This is dynamically loaded based on ENABLED_AI_MODELS environment variable
export const AI_MODELS = getModelsRecord()

type ModelId = keyof typeof AI_MODELS

// System prompt is now securely loaded from server-only module
// This prevents the prompt from being exposed to client bundles

interface Message {
  role: "user" | "assistant" | "system"
  content: string
}

interface RequestBody {
  prompt: string
  currentHtml?: string
  model?: ModelId
  isFollowUp?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    // Rate limiting for unauthenticated users
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    
    if (!session?.user) {
      // Check rate limit for anonymous users
      const rateLimitKey = `rate_limit:${ip}`
      // In production, implement proper rate limiting with Redis
    }

    const body: RequestBody = await req.json()
    const { prompt, currentHtml, model = getDefaultModelId(), isFollowUp = false } = body

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      )
    }

    // Validate model is enabled
    if (!isModelEnabled(model)) {
      return NextResponse.json(
        { error: `Model "${model}" is not enabled or does not exist` },
        { status: 400 }
      )
    }

    const openRouterApiKey = process.env.OPENROUTER_API_KEY
    
    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 }
      )
    }

    // Build messages array
    // The system prompt is securely loaded from a server-only module
    const systemPrompt = getCombinedSystemPrompt()
    
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
    ]

    if (isFollowUp && currentHtml) {
      messages.push({
        role: "user",
        content: `Here is my current HTML code:

${currentHtml}

Please modify it based on this request: ${prompt}`,
      })
    } else {
      messages.push({
        role: "user",
        content: prompt,
      })
    }

    // Make streaming request to OpenRouter
    const requestBody = {
      model,
      messages,
      stream: true,
      max_tokens: 16000,
      temperature: 0.7,
    }
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "CodeUI",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("OpenRouter error:", error)
      return NextResponse.json(
        { error: "AI service error" },
        { status: response.status }
      )
    }

    // Create a TransformStream to process the SSE stream
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        let buffer = ""

        try {
          while (true) {
            const { done, value } = await reader.read()
            
            if (done) {
              controller.close()
              break
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim()
                
                if (data === "[DONE]") {
                  controller.close()
                  return
                }

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  const reasoning = parsed.choices?.[0]?.delta?.reasoning
                  
                  if (content) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: "content", data: content })}\n\n`)
                    )
                  }
                  
                  if (reasoning) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: "thinking", data: reasoning })}\n\n`)
                    )
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error("Stream error:", error)
          controller.error(error)
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  } catch (error) {
    console.error("AI endpoint error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// For modifying existing HTML
export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      // Allow anonymous but with rate limiting in production
    }

    const body: RequestBody = await req.json()
    
    // Reuse POST logic with isFollowUp flag
    const modifiedRequest = new NextRequest(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({ ...body, isFollowUp: true }),
    })

    return POST(modifiedRequest)
  } catch (error) {
    console.error("AI PUT endpoint error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
