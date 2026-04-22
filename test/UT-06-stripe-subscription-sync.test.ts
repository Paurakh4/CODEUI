import Stripe from "stripe"
import { describe, expect, it, vi } from "vitest"

import {
  resolveCheckoutUserId,
  syncCheckoutSubscription,
  syncSubscriptionByLookup,
  type StripeUserRecord,
  type StripeUserStore,
} from "@/lib/payments/stripe-subscription-sync"

function createSubscription(overrides: Partial<any> = {}) {
  return {
    id: "sub_123",
    customer: "cus_123",
    current_period_end: 1_750_000_000,
    metadata: {},
    items: {
      data: [
        {
          current_period_end: 1_750_000_000,
          price: {
            id: "price_pro_monthly",
          },
        },
      ],
    },
    ...overrides,
  } as Stripe.Subscription & { current_period_end: number }
}

function createCheckoutSession(overrides: Partial<any> = {}) {
  return {
    id: "cs_test_123",
    mode: "subscription",
    client_reference_id: null,
    metadata: {
      userId: "user_123",
    },
    subscription: "sub_123",
    ...overrides,
  } as unknown as Stripe.Checkout.Session
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
        topupCredits: currentUser.topupCredits,
        monthlyCredits: nextSet.monthlyCredits,
        credits: nextSet.credits,
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

describe("UT-06 stripe subscription sync", () => {
  it("resolves the checkout user id from metadata and client reference id", () => {
    expect(resolveCheckoutUserId(createCheckoutSession(), null as any)).toBe("user_123")
    expect(
      resolveCheckoutUserId(
        createCheckoutSession({ metadata: {}, client_reference_id: "user_456" }),
        null as any,
      ),
    ).toBe("user_456")
  })

  it("synchronizes a confirmed checkout into the user subscription record", async () => {
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_pro_monthly"

    const userStore = createUserStore({
      _id: "user_123",
      topupCredits: 15,
      subscription: {
        tier: "free",
      },
      monthlyCredits: 20,
      credits: 35,
    })

    const result = await syncCheckoutSubscription({
      stripe: {
        subscriptions: {
          retrieve: vi.fn(async () => createSubscription()),
        },
      } as any,
      checkoutSession: createCheckoutSession(),
      source: "test",
      connect: vi.fn(async () => undefined) as any,
      userStore,
    })

    expect(result.ok).toBe(true)
    expect(result.tier).toBe("pro")
    expect(result.monthlyCredits).toBe(120)
    expect(result.totalCredits).toBe(135)
  })

  it("falls back to the subscription item billing period end for newer Stripe API versions", async () => {
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_pro_monthly"

    const userStore = createUserStore({
      _id: "user_123",
      topupCredits: 15,
      subscription: {
        tier: "free",
      },
      monthlyCredits: 20,
      credits: 35,
    })

    const result = await syncCheckoutSubscription({
      stripe: {
        subscriptions: {
          retrieve: vi.fn(async () =>
            createSubscription({
              current_period_end: undefined,
              items: {
                data: [
                  {
                    current_period_end: 1_760_000_000,
                    price: {
                      id: "price_pro_monthly",
                    },
                  },
                ],
              },
            }),
          ),
        },
      } as any,
      checkoutSession: createCheckoutSession(),
      source: "test.new-api-shape",
      connect: vi.fn(async () => undefined) as any,
      userStore,
    })

    expect(result.ok).toBe(true)
    expect(result.tier).toBe("pro")
    expect(result.monthlyCredits).toBe(120)
    expect(result.totalCredits).toBe(135)
  })

  it("can synchronize a subscription event when only the subscription lookup is available", async () => {
    process.env.STRIPE_PROPLUS_MONTHLY_PRICE_ID = "price_proplus_monthly"

    const subscription = createSubscription({
      id: "sub_999",
      metadata: { userId: "user_999" },
      items: {
        data: [
          {
            price: {
              id: "price_proplus_monthly",
            },
          },
        ],
      },
    })

    const userStore = createUserStore({
      _id: "user_999",
      topupCredits: 0,
      subscription: {
        tier: "free",
      },
      monthlyCredits: 20,
      credits: 20,
    })

    const result = await syncSubscriptionByLookup({
      subscription: subscription as any,
      userId: (subscription.metadata as { userId?: string }).userId,
      source: "test.subscription.updated",
      connect: vi.fn(async () => undefined) as any,
      userStore,
    })

    expect(result.ok).toBe(true)
    expect(result.tier).toBe("proplus")
    expect(result.monthlyCredits).toBe(350)
    expect(result.totalCredits).toBe(350)
  })
})