import { describe, expect, it, vi } from "vitest"

import { pollCheckoutSync, shouldContinueCheckoutSync } from "@/lib/payments/checkout-sync"

describe("UT-11 checkout sync polling", () => {
  it("continues polling until the checkout is confirmed", async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce({
        status: "processing",
        message: "Waiting for webhook",
      })
      .mockResolvedValueOnce({
        status: "confirmed",
        message: "Subscription confirmed",
        tier: "pro",
      })

    const result = await pollCheckoutSync(fetchStatus, {
      delayMs: 0,
    })

    expect(fetchStatus).toHaveBeenCalledTimes(2)
    expect(result.status).toBe("confirmed")
    expect(result.message).toBe("Subscription confirmed")
  })

  it("stops immediately for a failed checkout status", async () => {
    const fetchStatus = vi.fn().mockResolvedValue({
      status: "failed",
      message: "Subscription verification failed",
    })

    const result = await pollCheckoutSync(fetchStatus, {
      delayMs: 0,
    })

    expect(fetchStatus).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("failed")
  })

  it("returns a timeout failure after the max attempts are exhausted", async () => {
    const result = await pollCheckoutSync(
      vi.fn().mockResolvedValue({
        status: "processing",
        message: "Still waiting",
      }),
      {
        delayMs: 0,
        maxAttempts: 2,
        timeoutMessage: "Timed out waiting for Stripe",
      },
    )

    expect(shouldContinueCheckoutSync(result.status)).toBe(false)
    expect(result).toEqual({
      status: "failed",
      message: "Timed out waiting for Stripe",
    })
  })
})