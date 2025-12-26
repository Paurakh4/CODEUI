import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// AI Models available through OpenRouter
export const AI_MODELS = {
  "deepseek/deepseek-chat": {
    name: "DeepSeek V3",
    contextLength: 64000,
    supportsReasoning: false,
  },
  "deepseek/deepseek-r1": {
    name: "DeepSeek R1 (Reasoning)",
    contextLength: 64000,
    supportsReasoning: true,
  },
  "qwen/qwen3-coder-480b-instruct": {
    name: "Qwen3 Coder 480B",
    contextLength: 32000,
    supportsReasoning: false,
  },
  "moonshot/kimi-k2-instruct": {
    name: "Kimi K2",
    contextLength: 128000,
    supportsReasoning: false,
  },
  "zhipu/glm-4.6": {
    name: "GLM 4.6",
    contextLength: 128000,
    supportsReasoning: false,
  },
  "mistralai/devstral-2512:free": {
    name: "Devstral",
    contextLength: 64000,
    supportsReasoning: false,
  },
  "google/gemini-3-flash-preview": {
    name: "Gemini 3 Flash Preview",
    contextLength: 2000000,
    supportsReasoning: false,
  },
} as const

type ModelId = keyof typeof AI_MODELS

const SYSTEM_PROMPT = `You are CodeUI, an expert AI assistant specialized in generating beautiful, modern, and responsive single-page HTML websites. You use Tailwind CSS for styling (loaded via CDN) and vanilla JavaScript for interactivity.

CRITICAL RULES:
1. Generate ONLY valid HTML code wrapped in a complete HTML document structure
2. ALWAYS include the Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
3. Create visually stunning, modern designs with gradients, shadows, and smooth animations
4. Use semantic HTML5 elements (header, nav, main, section, footer)
5. Ensure mobile responsiveness using Tailwind's responsive prefixes (sm:, md:, lg:, xl:)
6. Include hover effects and smooth transitions for interactive elements
7. Use a cohesive color scheme based on Tailwind's color palette
8. Add meaningful content - avoid Lorem Ipsum when possible
9. Include JavaScript for interactivity when appropriate (inline in <script> tags)

OUTPUT FORMAT:
- Return ONLY the complete HTML document, starting with <!DOCTYPE html>
- Do NOT include any markdown code blocks, explanations, or comments outside the HTML
- The output should be directly renderable in a browser

When modifying existing code, use the SEARCH/REPLACE format:
<<<<<<< SEARCH
[exact content to find]
=======
[new content to replace with]
>>>>>>> REPLACE

For new projects, generate a complete HTML document.`

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
      // For now, we'll allow requests but log the IP
      console.log(`Anonymous request from IP: ${ip}`)
    }

    const body: RequestBody = await req.json()
    const { prompt, currentHtml, model = "deepseek/deepseek-chat", isFollowUp = false } = body

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
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
    const messages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ]

    if (isFollowUp && currentHtml) {
      messages.push({
        role: "user",
        content: `Here is my current HTML code:\n\n${currentHtml}\n\nPlease modify it based on this request: ${prompt}`,
      })
    } else {
      messages.push({
        role: "user",
        content: `Create a beautiful, modern single-page website for: ${prompt}`,
      })
    }

    // Make streaming request to OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "CodeUI",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: 16000,
        temperature: 0.7,
      }),
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
