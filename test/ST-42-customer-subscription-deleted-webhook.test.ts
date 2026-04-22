import Stripe from "stripe"
import { describe, expect, it, vi } from "vitest"

import {
  cancelSubscriptionByLookup,
  type StripeUserRecord,
  type StripeUserStore,
} from "@/lib/payments/stripe-subscription-sync"
import { getMonthlyCreditsForTier } from "@/lib/pricing"

function createCanceledSubscription(overrides: Partial<any> = {}) {
  return {
    id: "sub_deleted_123",
    customer: "cus_deleted_123",
    status: "canceled",
    metadata: {},
    items: {
      data: [
        {
          price: {
            id: "price_pro_monthly",
          },
        },
      ],
    },
    ...overrides,
  } as Stripe.Subscription
}

function createUserStore(user: StripeUserRecord | null): StripeUserStore {
  let currentUser = user

  return {
    findById: vi.fn(async () => currentUser),
    findOne: vi.fn(async () => currentUser),
    findByIdAndUpdate: vi.fn(async (_id, update) => {
      if (!currentUser) {
        return null
      }

      const nextSet = (update as any).$set ?? {}
      currentUser = {
        ...currentUser,
        monthlyCredits: nextSet.monthlyCredits,
        credits: nextSet.credits,
        creditsResetDate: nextSet.creditsResetDate,
        subscription: {
          ...currentUser.subscription,
          tier: nextSet["subscription.tier"],
          stripeSubscriptionId: nextSet["subscription.stripeSubscriptionId"],
          stripeCustomerId: nextSet["subscription.stripeCustomerId"],
          stripePriceId: nextSet["subscription.stripePriceId"],
          currentPeriodEnd: nextSet["subscription.currentPeriodEnd"],
        },
      }

      return currentUser
    }),
  }
}

describe("ST-42 customer.subscription.deleted webhook", () => {
  it("downgrades the account to free and recalculates monthly credits", async () => {
    const freeCredits = getMonthlyCreditsForTier("free")

    const userStore = createUserStore({
      _id: "user_deleted_123",
      topupCredits: 15,
      subscription: {
        tier: "pro",
        stripeSubscriptionId: "sub_deleted_123",
        stripeCustomerId: "cus_deleted_123",
        stripePriceId: "price_pro_monthly",
        currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
      },
      monthlyCredits: 120,
      credits: 135,
    })

    const result = await cancelSubscriptionByLookup({
      subscription: createCanceledSubscription(),
      source: "customer.subscription.deleted",
      eventId: "evt_subscription_deleted_123",
      connect: vi.fn(async () => undefined) as any,
      userStore,
    })

    expect(result.ok).toBe(true)
    expect(result.tier).toBe("free")
    expect(result.monthlyCredits).toBe(freeCredits)
    expect(result.totalCredits).toBe(freeCredits + 15)
    expect(result.message).toContain("returned to the free plan")

    const updatedUser = await userStore.findById("user_deleted_123")

    expect(updatedUser?.subscription?.tier).toBe("free")
    expect(updatedUser?.subscription?.stripeSubscriptionId).toBeNull()
    expect(updatedUser?.subscription?.stripeCustomerId).toBe("cus_deleted_123")
    expect(updatedUser?.subscription?.stripePriceId).toBeNull()
    expect(updatedUser?.subscription?.currentPeriodEnd).toBeNull()
    expect(updatedUser?.monthlyCredits).toBe(freeCredits)
    expect(updatedUser?.credits).toBe(freeCredits + 15)
    expect(updatedUser?.creditsResetDate).toBeInstanceOf(Date)
  })
})