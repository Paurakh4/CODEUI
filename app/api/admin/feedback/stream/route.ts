import { requireAdminRoute } from "@/lib/admin/guards"
import { subscribeToAdminFeedback } from "@/lib/admin/feedback-events"
import type { AdminFeedbackStreamEvent } from "@/lib/admin/feedback-types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function serializeEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET(request: Request) {
  const authResult = await requireAdminRoute("admin:view-feedback")
  if ("response" in authResult) {
    return authResult.response
  }

  const encoder = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(serializeEvent(event, data)))
      }

      const unsubscribe = subscribeToAdminFeedback((event: AdminFeedbackStreamEvent) => {
        send(event.type, event.data)
      })

      const heartbeat = setInterval(() => {
        send("ping", { timestamp: new Date().toISOString() })
      }, 15000)

      const abortHandler = () => {
        cleanup()

        try {
          controller.close()
        } catch {
          // No-op if the stream already closed.
        }
      }

      cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
        request.signal.removeEventListener("abort", abortHandler)
      }

      request.signal.addEventListener("abort", abortHandler, { once: true })
      send("ready", { connectedAt: new Date().toISOString() })
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}