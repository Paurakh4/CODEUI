"use client"

import { DashboardMain } from "@/components/dashboard/dashboard-main"
import { useEffect, Suspense, useState, useEffectEvent } from "react"
import { toast } from "sonner"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { deriveProjectNameFromPrompt } from "@/lib/utils/project-name"
import { storePendingProjectStart } from "@/lib/utils/project-bootstrap"
import { pollCheckoutSync, type CheckoutSyncResponse } from "@/lib/payments/checkout-sync"

type BillingSyncState = "idle" | "processing" | "confirmed" | "failed"

function DashboardContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status, update: updateSession } = useSession()
  const [billingSyncState, setBillingSyncState] = useState<BillingSyncState>("idle")
  const [billingSyncMessage, setBillingSyncMessage] = useState<string | null>(null)

  const clearPaymentParams = useEffectEvent(() => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("success")
    nextParams.delete("canceled")
    nextParams.delete("session_id")

    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `/dashboard?${nextQuery}` : "/dashboard")
  })

  const fetchCheckoutStatus = useEffectEvent(async (checkoutSessionId: string) => {
    const response = await fetch(`/api/stripe/checkout-status?session_id=${encodeURIComponent(checkoutSessionId)}`, {
      cache: "no-store",
    })

    let payload: CheckoutSyncResponse | null = null

    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (payload) {
      return payload
    }

    return {
      status: response.ok ? "processing" : "failed",
      message: response.ok
        ? "Payment succeeded and we are still confirming the upgrade."
        : "Unable to verify the Stripe checkout right now.",
    } satisfies CheckoutSyncResponse
  })

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("dashboard_state")
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        if (parsed.hasStarted) {
          // Migrate existing editor state to a new project ID
          const existingEditorState = localStorage.getItem("editor_state")
          if (existingEditorState) {
            const newId = crypto.randomUUID()
            localStorage.setItem(`editor_state_${newId}`, existingEditorState)
            
            // If user is logged in, create the project in DB first
            if (session?.user) {
              fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: newId }),
              }).catch(console.error)
            }

            // Clear old state
            localStorage.removeItem("dashboard_state")
            localStorage.removeItem("editor_state")
            
            // Redirect
            router.push(`/project/${newId}`)
          } else {
             // If no editor state but dashboard thought we started, just clear it
             localStorage.removeItem("dashboard_state")
          }
        }
      } catch (e) {
        console.error("Failed to restore dashboard state", e)
      }
    }
  }, [router, session])

  useEffect(() => {
    if (searchParams.get("canceled")) {
      setBillingSyncState("idle")
      setBillingSyncMessage(null)
      toast.error("Subscription canceled. You can try again anytime.")
      clearPaymentParams()
    }
  }, [clearPaymentParams, searchParams])

  useEffect(() => {
    const checkoutSucceeded = searchParams.get("success")
    const checkoutSessionId = searchParams.get("session_id")

    if (!checkoutSucceeded || status === "loading") {
      return
    }

    if (!session?.user?.id) {
      setBillingSyncState("failed")
      setBillingSyncMessage("Sign in again to confirm your subscription upgrade.")
      toast.error("Sign in again to confirm your subscription upgrade.")
      return
    }

    if (!checkoutSessionId) {
      setBillingSyncState("processing")
      setBillingSyncMessage("Payment completed. Refreshing your account status.")

      void updateSession()
      toast.success("Payment completed. Refreshing your account status.")
      clearPaymentParams()
      return
    }

    let isActive = true

    const syncCheckout = async () => {
      setBillingSyncState("processing")
      setBillingSyncMessage("Payment received. Confirming your upgrade with Stripe.")

      const result = await pollCheckoutSync(
        (attempt) => fetchCheckoutStatus(checkoutSessionId),
        {
          onProgress: (progressResult) => {
            if (!isActive) {
              return
            }

            setBillingSyncMessage(progressResult.message)
          },
        }
      )

      if (!isActive) {
        return
      }

      setBillingSyncMessage(result.message)

      if (result.status === "confirmed") {
        setBillingSyncState("confirmed")
        await updateSession()
        toast.success(result.message)
        clearPaymentParams()
        return
      }

      setBillingSyncState("failed")
      toast.error(result.message)
    }

    void syncCheckout()

    return () => {
      isActive = false
    }
  }, [clearPaymentParams, fetchCheckoutStatus, searchParams, session?.user?.id, status, updateSession])

  const handleStart = async (prompt?: string, model?: string) => {
    const id = crypto.randomUUID()
    const projectName = prompt ? deriveProjectNameFromPrompt(prompt) : undefined
    const requestBody: { id: string; prompt?: string; name?: string } = { id }
    if (prompt) {
      requestBody.prompt = prompt
      requestBody.name = projectName
    }
    
    if (session?.user) {
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })
        
        if (!res.ok) {
          const data = await res.json().catch(() => null)

          if (data?.code === "FREE_PROJECT_LIMIT_REACHED") {
            throw new Error(data.error || "Free project limit reached")
          }

          throw new Error(data?.error || "Failed to create project")
        }
      } catch (error) {
        console.error("Error creating project:", error)
        const message = error instanceof Error ? error.message : "Failed to create project"
        toast.error(message)
        return
      }
    }

    storePendingProjectStart(id, { prompt, model })
    const nextParams = new URLSearchParams()

    if (prompt) {
      nextParams.set("prompt", prompt)
    }

    if (model) {
      nextParams.set("model", model)
    }

    const nextQuery = nextParams.toString()
    router.push(nextQuery ? `/project/${id}?${nextQuery}` : `/project/${id}`)
  }

  return (
    <DashboardMain
      onStart={handleStart}
      billingSyncState={billingSyncState}
      billingSyncMessage={billingSyncMessage}
      onRetryBillingSync={async () => {
        const checkoutSessionId = searchParams.get("session_id")

        if (!checkoutSessionId) {
          setBillingSyncState("failed")
          setBillingSyncMessage("The Stripe checkout session is no longer available.")
          return
        }

        setBillingSyncState("processing")
        const result = await fetchCheckoutStatus(checkoutSessionId)
        setBillingSyncMessage(result.message)

        if (result.status === "confirmed") {
          setBillingSyncState("confirmed")
          await updateSession()
          toast.success(result.message)
          clearPaymentParams()
          return
        }

        if (result.status === "failed") {
          setBillingSyncState("failed")
          toast.error(result.message)
        }
      }}
    />
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
