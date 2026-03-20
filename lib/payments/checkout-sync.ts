import type { SubscriptionTier } from "@/lib/pricing"

export type CheckoutSyncStatus = "processing" | "confirmed" | "failed"

export interface CheckoutSyncResponse {
  status: CheckoutSyncStatus
  message: string
  tier?: SubscriptionTier
  monthlyCredits?: number
  totalCredits?: number
  subscriptionId?: string
}

interface PollCheckoutSyncOptions {
  maxAttempts?: number
  delayMs?: number
  onProgress?: (result: CheckoutSyncResponse, attempt: number) => void
  timeoutMessage?: string
}

function wait(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

export function shouldContinueCheckoutSync(status: CheckoutSyncStatus) {
  return status === "processing"
}

export async function pollCheckoutSync(
  fetchStatus: (attempt: number) => Promise<CheckoutSyncResponse>,
  options: PollCheckoutSyncOptions = {}
) {
  const {
    maxAttempts = 12,
    delayMs = 1500,
    onProgress,
    timeoutMessage = "Payment succeeded, but the upgrade confirmation is still processing.",
  } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await fetchStatus(attempt)
    onProgress?.(result, attempt)

    if (!shouldContinueCheckoutSync(result.status)) {
      return result
    }

    if (attempt < maxAttempts) {
      await wait(delayMs)
    }
  }

  return {
    status: "failed" as const,
    message: timeoutMessage,
  }
}