import "server-only"

import connectDB from "@/lib/db"
import { createAdminAuditEntry } from "@/lib/admin/audit"
import { resolveAccountStatus, type UserRole } from "@/lib/admin/rbac"
import { User } from "@/lib/models"
import {
  BILLING_CYCLES,
  PAID_SUBSCRIPTION_TIERS,
  TOPUP_PACKAGES,
  TIERS,
  getSubscriptionPriceId,
  getTopupPriceId,
  type SubscriptionTier,
} from "@/lib/pricing"
import {
  getStripeServerConfigIssues,
  getStripeWebhookConfigIssues,
  isConfiguredEnvValue,
} from "@/lib/payments/stripe-config"
import { getStripeServer } from "@/lib/payments/stripe"
import { syncSubscriptionByLookup } from "@/lib/payments/stripe-subscription-sync"
import type { AdminBillingQuery } from "@/lib/admin/billing-filters"

export interface AdminBillingSummary {
  filteredAccounts: number
  paidAccounts: number
  linkedAccounts: number
  pendingRenewals7d: number
  totalTopupCredits: number
}

export interface AdminBillingAccount {
  id: string
  name: string
  email: string
  accountStatus: string
  subscription: {
    tier: SubscriptionTier
    tierName: string
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
    stripePriceId?: string | null
    currentPeriodEnd?: Date | null
  }
  monthlyCredits: number
  topupCredits: number
  totalCreditsUsed: number
  createdAt: Date
}

export interface AdminBillingPageData {
  accounts: AdminBillingAccount[]
  pagination: {
    page: number
    pageSize: number
    totalAccounts: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
  summary: AdminBillingSummary
  filters: AdminBillingQuery
  pricingHealth: {
    serverIssues: string[]
    webhookIssues: string[]
    subscriptionPrices: Array<{
      key: string
      label: string
      configured: boolean
      priceId?: string
    }>
    topupPrices: Array<{
      key: string
      label: string
      configured: boolean
      priceId?: string
    }>
  }
}

interface AdminActor {
  id: string
  email?: string | null
  role: UserRole
}

export class AdminBillingMutationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = "AdminBillingMutationError"
    this.status = status
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function getAdminBillingPageData(
  filters: AdminBillingQuery,
): Promise<AdminBillingPageData> {
  await connectDB()

  const query: Record<string, unknown> = {}

  if (filters.search) {
    const regex = new RegExp(escapeRegex(filters.search), "i")
    query.$or = [{ name: regex }, { email: regex }]
  }

  if (filters.tier !== "all") {
    query["subscription.tier"] = filters.tier
  }

  if (filters.accountStatus !== "all") {
    query.accountStatus = filters.accountStatus
  }

  if (filters.linkStatus === "linked") {
    query["subscription.stripeSubscriptionId"] = { $exists: true, $nin: [null, ""] }
  }

  if (filters.linkStatus === "unlinked") {
    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),
      {
        $or: [
          { "subscription.stripeSubscriptionId": { $exists: false } },
          { "subscription.stripeSubscriptionId": null },
          { "subscription.stripeSubscriptionId": "" },
        ],
      },
    ]
  }

  const now = new Date()
  const renewalCutoff = new Date(now)
  renewalCutoff.setDate(renewalCutoff.getDate() + 7)

  const totalAccountsPromise = User.countDocuments(query)
  const paidAccountsPromise = User.countDocuments({
    ...query,
    "subscription.tier": { $in: ["pro", "proplus"] },
  })
  const linkedAccountsPromise = User.countDocuments({
    ...query,
    "subscription.stripeSubscriptionId": { $exists: true, $nin: [null, ""] },
  })
  const pendingRenewalsPromise = User.countDocuments({
    ...query,
    "subscription.currentPeriodEnd": { $gte: now, $lte: renewalCutoff },
  })
  const topupCreditsRowsPromise = User.aggregate<{ total: number }>([
    { $match: query },
    { $group: { _id: null, total: { $sum: "$topupCredits" } } },
  ])

  const offset = (filters.page - 1) * filters.pageSize
  const accounts = await User.find(query)
    .select(
      "name email accountStatus subscription monthlyCredits topupCredits totalCreditsUsed createdAt",
    )
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(filters.pageSize)
    .lean()

  const [
    totalAccounts,
    paidAccounts,
    linkedAccounts,
    pendingRenewals7d,
    topupCreditsRows,
  ] = await Promise.all([
    totalAccountsPromise,
    paidAccountsPromise,
    linkedAccountsPromise,
    pendingRenewalsPromise,
    topupCreditsRowsPromise,
  ])

  const totalPages = Math.max(1, Math.ceil(totalAccounts / filters.pageSize))

  return {
    accounts: accounts.map((account) => {
      const tier = (account.subscription?.tier || "free") as SubscriptionTier

      return {
        id: account._id.toString(),
        name: account.name,
        email: account.email,
        accountStatus: resolveAccountStatus(account.accountStatus),
        subscription: {
          tier,
          tierName: TIERS[tier]?.name || "Free",
          stripeCustomerId: account.subscription?.stripeCustomerId,
          stripeSubscriptionId: account.subscription?.stripeSubscriptionId,
          stripePriceId: account.subscription?.stripePriceId,
          currentPeriodEnd: account.subscription?.currentPeriodEnd,
        },
        monthlyCredits: account.monthlyCredits ?? 0,
        topupCredits: account.topupCredits ?? 0,
        totalCreditsUsed: account.totalCreditsUsed ?? 0,
        createdAt: account.createdAt,
      }
    }),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalAccounts,
      totalPages,
      hasPreviousPage: filters.page > 1,
      hasNextPage: filters.page < totalPages,
    },
    summary: {
      filteredAccounts: totalAccounts,
      paidAccounts,
      linkedAccounts,
      pendingRenewals7d,
      totalTopupCredits: topupCreditsRows[0]?.total ?? 0,
    },
    filters,
    pricingHealth: {
      serverIssues: getStripeServerConfigIssues(),
      webhookIssues: getStripeWebhookConfigIssues(),
      subscriptionPrices: PAID_SUBSCRIPTION_TIERS.flatMap((tier) =>
        BILLING_CYCLES.map((cycle) => {
          const priceId = getSubscriptionPriceId(tier, cycle)

          return {
            key: `${tier}-${cycle}`,
            label: `${TIERS[tier].name} ${cycle}`,
            configured: isConfiguredEnvValue(priceId),
            priceId,
          }
        }),
      ),
      topupPrices: TOPUP_PACKAGES.map((pkg) => {
        const priceId = getTopupPriceId(pkg.id)

        return {
          key: pkg.id,
          label: `${pkg.credits} credits`,
          configured: isConfiguredEnvValue(priceId),
          priceId,
        }
      }),
    },
  }
}

export async function resyncAdminBillingAccount(input: {
  userId: string
  actor: AdminActor
  reason: string
}) {
  await connectDB()

  const user = await User.findById(input.userId)
    .select("email subscription monthlyCredits topupCredits")
    .lean()

  if (!user) {
    throw new AdminBillingMutationError("User not found", 404)
  }

  const stripeSubscriptionId = user.subscription?.stripeSubscriptionId
  if (!stripeSubscriptionId) {
    throw new AdminBillingMutationError("This account does not have a Stripe subscription to resync.")
  }

  const stripe = getStripeServer()
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
  const before = {
    tier: user.subscription?.tier || "free",
    stripeSubscriptionId,
    monthlyCredits: user.monthlyCredits ?? 0,
    topupCredits: user.topupCredits ?? 0,
  }

  const result = await syncSubscriptionByLookup({
    subscription,
    userId: input.userId,
    source: "admin-billing-resync",
  })

  if (!result.ok) {
    throw new AdminBillingMutationError(result.message, 409)
  }

  const updatedUser = await User.findById(input.userId)
    .select("subscription monthlyCredits topupCredits")
    .lean()

  await createAdminAuditEntry({
    actorUserId: input.actor.id,
    actorEmail: input.actor.email || "unknown@local",
    actorRole: input.actor.role,
    action: "admin.billing.resynced",
    permission: "admin:manage-billing",
    targetType: "user",
    targetId: input.userId,
    reason: input.reason,
    before,
    after: {
      tier: updatedUser?.subscription?.tier || result.tier || "free",
      stripeSubscriptionId: updatedUser?.subscription?.stripeSubscriptionId || stripeSubscriptionId,
      monthlyCredits: updatedUser?.monthlyCredits ?? result.monthlyCredits ?? 0,
      topupCredits: updatedUser?.topupCredits ?? 0,
    },
    metadata: {
      stripeSubscriptionId,
      stripeCustomerId: user.subscription?.stripeCustomerId || null,
    },
  })

  return result
}