import Stripe from "stripe";
import { User } from "@/lib/models";
import {
  getMonthlyCreditsForTier,
  getTierFromPriceId,
  getTopupPackageFromPriceId,
  type SubscriptionTier,
} from "@/lib/pricing";
import { logStripeFlow } from "./stripe-logging";

export interface StripeUserRecord {
  _id?: { toString(): string } | string;
  topupCredits?: number;
  subscription?: {
    tier?: SubscriptionTier;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: Date | null;
  };
  monthlyCredits?: number;
  credits?: number;
}

export interface StripeUserStore {
  findById(id: string): Promise<StripeUserRecord | null>;
  findOne(query: Record<string, unknown>): Promise<StripeUserRecord | null>;
  findByIdAndUpdate(
    id: string,
    update: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<StripeUserRecord | null>;
}

interface BaseSyncOptions {
  source: string;
  eventId?: string;
  connect?: () => Promise<unknown>;
  userStore?: StripeUserStore;
}

interface SyncCheckoutSubscriptionOptions extends BaseSyncOptions {
  stripe: Pick<Stripe, "subscriptions">;
  checkoutSession: Stripe.Checkout.Session;
}

interface SyncSubscriptionByLookupOptions extends BaseSyncOptions {
  subscription: Stripe.Subscription;
  userId?: string | null;
  resetUsage?: boolean;
}

interface CancelSubscriptionOptions extends BaseSyncOptions {
  subscription: Stripe.Subscription;
}

interface ApplySubscriptionUpdateOptions extends BaseSyncOptions {
  resetUsage?: boolean;
}

interface ProcessTopupCheckoutOptions extends BaseSyncOptions {
  stripe: Pick<Stripe, "checkout">;
  checkoutSession: Stripe.Checkout.Session;
}

export interface SubscriptionSyncResult {
  ok: boolean;
  message: string;
  userId?: string;
  tier?: SubscriptionTier;
  monthlyCredits?: number;
  totalCredits?: number;
  subscriptionId?: string;
}

const defaultUserStore: StripeUserStore = {
  findById(id) {
    return User.findById(id);
  },
  findOne(query) {
    return User.findOne(query);
  },
  findByIdAndUpdate(id, update, options) {
    return User.findByIdAndUpdate(id, update, options);
  },
};

async function connectToDatabase() {
  const { default: connectDB } = await import("@/lib/db");
  return connectDB();
}

function getUserId(user: StripeUserRecord | null) {
  if (!user?._id) {
    return null;
  }

  return typeof user._id === "string" ? user._id : user._id.toString();
}

function getStripeCustomerId(subscription: Stripe.Subscription) {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id;
}

function getPaidTierFromPriceId(priceId: string) {
  const tier = getTierFromPriceId(priceId);

  if (tier === "free") {
    throw new Error(`Unable to map Stripe price ${priceId} to a paid subscription tier`);
  }

  return tier;
}

function getSubscriptionPeriodEndUnix(subscription: Stripe.Subscription) {
  const legacyPeriodEnd = (
    subscription as Stripe.Subscription & { current_period_end?: number }
  ).current_period_end;

  if (typeof legacyPeriodEnd === "number") {
    return legacyPeriodEnd;
  }

  const itemPeriodEnds = subscription.items.data
    .map((item) => {
      const value = (
        item as Stripe.SubscriptionItem & { current_period_end?: number }
      ).current_period_end;

      return typeof value === "number" ? value : null;
    })
    .filter((value): value is number => value !== null);

  if (itemPeriodEnds.length > 0) {
    return Math.max(...itemPeriodEnds);
  }

  return null;
}

function getSubscriptionDetails(subscription: Stripe.Subscription) {
  const stripePriceId = subscription.items.data[0]?.price?.id;

  if (!stripePriceId) {
    throw new Error(`Stripe subscription ${subscription.id} is missing a price id`);
  }

  const tier = getPaidTierFromPriceId(stripePriceId);
  const monthlyCredits = getMonthlyCreditsForTier(tier);
  const currentPeriodEndUnix = getSubscriptionPeriodEndUnix(subscription);

  if (typeof currentPeriodEndUnix !== "number") {
    throw new Error(
      `Stripe subscription ${subscription.id} is missing a billing period end on both the subscription and its items`
    );
  }

  return {
    stripePriceId,
    tier,
    monthlyCredits,
    currentPeriodEnd: new Date(currentPeriodEndUnix * 1000),
    stripeCustomerId: getStripeCustomerId(subscription),
  };
}

export function resolveCheckoutUserId(
  checkoutSession: Stripe.Checkout.Session,
  subscription?: Stripe.Subscription | null
) {
  return (
    checkoutSession.metadata?.userId ||
    checkoutSession.client_reference_id ||
    subscription?.metadata?.userId ||
    null
  );
}

async function findSubscriptionOwner(
  subscription: Stripe.Subscription,
  userStore: StripeUserStore,
  userId?: string | null
) {
  if (userId) {
    const directUser = await userStore.findById(userId);
    if (directUser) {
      return directUser;
    }
  }

  if (subscription.metadata?.userId) {
    const metadataUser = await userStore.findById(subscription.metadata.userId);
    if (metadataUser) {
      return metadataUser;
    }
  }

  const lookupClauses: Array<Record<string, unknown>> = [
    { "subscription.stripeSubscriptionId": subscription.id },
  ];
  const stripeCustomerId = getStripeCustomerId(subscription);

  if (stripeCustomerId) {
    lookupClauses.push({ "subscription.stripeCustomerId": stripeCustomerId });
  }

  return userStore.findOne(
    lookupClauses.length === 1 ? lookupClauses[0] : { $or: lookupClauses }
  );
}

async function applySubscriptionUpdate(
  owner: StripeUserRecord,
  subscription: Stripe.Subscription,
  options: ApplySubscriptionUpdateOptions
): Promise<SubscriptionSyncResult> {
  const { source, eventId, resetUsage = false } = options;
  const connect = options.connect ?? connectToDatabase;
  const userStore = options.userStore ?? defaultUserStore;
  const ownerId = getUserId(owner);

  if (!ownerId) {
    return {
      ok: false,
      message: "Subscription owner is missing a persisted user id",
    };
  }

  const details = getSubscriptionDetails(subscription);
  const topupCredits = owner.topupCredits ?? 0;
  const totalCredits = details.monthlyCredits + topupCredits;

  await connect();

  await userStore.findByIdAndUpdate(
    ownerId,
    {
      $set: {
        "subscription.stripeSubscriptionId": subscription.id,
        "subscription.stripeCustomerId": details.stripeCustomerId ?? null,
        "subscription.stripePriceId": details.stripePriceId,
        "subscription.currentPeriodEnd": details.currentPeriodEnd,
        "subscription.tier": details.tier,
        monthlyCredits: details.monthlyCredits,
        creditsResetDate: details.currentPeriodEnd,
        credits: totalCredits,
        ...(resetUsage ? { creditsUsedThisMonth: 0 } : {}),
      },
    },
    { new: true }
  );

  logStripeFlow("info", "SUBSCRIPTION_SYNCED", {
    source,
    eventId,
    userId: ownerId,
    subscriptionId: subscription.id,
    tier: details.tier,
    monthlyCredits: details.monthlyCredits,
    topupCredits,
    totalCredits,
  });

  return {
    ok: true,
    message: `Subscription confirmed for the ${details.tier} plan.`,
    userId: ownerId,
    tier: details.tier,
    monthlyCredits: details.monthlyCredits,
    totalCredits,
    subscriptionId: subscription.id,
  };
}

export async function syncCheckoutSubscription(
  options: SyncCheckoutSubscriptionOptions
): Promise<SubscriptionSyncResult> {
  const { stripe, checkoutSession, source, eventId } = options;
  const userStore = options.userStore ?? defaultUserStore;

  if (checkoutSession.mode !== "subscription") {
    return {
      ok: false,
      message: "Checkout session is not a subscription checkout",
    };
  }

  if (!checkoutSession.subscription) {
    return {
      ok: false,
      message: `Checkout session ${checkoutSession.id} is missing a Stripe subscription id`,
    };
  }

  const subscription =
    typeof checkoutSession.subscription === "string"
      ? await stripe.subscriptions.retrieve(checkoutSession.subscription)
      : checkoutSession.subscription;

  const userId = resolveCheckoutUserId(checkoutSession, subscription);
  const owner = await findSubscriptionOwner(subscription, userStore, userId);

  if (!owner) {
    return {
      ok: false,
      message: `No user found for checkout session ${checkoutSession.id}`,
      userId: userId ?? undefined,
      subscriptionId: subscription.id,
    };
  }

  return applySubscriptionUpdate(owner, subscription, {
    source,
    eventId,
    connect: options.connect,
    userStore: options.userStore,
  });
}

export async function syncSubscriptionByLookup(
  options: SyncSubscriptionByLookupOptions
): Promise<SubscriptionSyncResult> {
  const { subscription, userId, source, eventId } = options;
  const userStore = options.userStore ?? defaultUserStore;
  const owner = await findSubscriptionOwner(subscription, userStore, userId);

  if (!owner) {
    return {
      ok: false,
      message: `No user found for subscription ${subscription.id}`,
      userId: userId ?? undefined,
      subscriptionId: subscription.id,
    };
  }

  return applySubscriptionUpdate(owner, subscription, {
    ...options,
    source,
    eventId,
  });
}

export async function cancelSubscriptionByLookup(
  options: CancelSubscriptionOptions
): Promise<SubscriptionSyncResult> {
  const { subscription, source, eventId } = options;
  const connect = options.connect ?? connectToDatabase;
  const userStore = options.userStore ?? defaultUserStore;
  const owner = await findSubscriptionOwner(subscription, userStore);

  if (!owner) {
    return {
      ok: false,
      message: `No user found for canceled subscription ${subscription.id}`,
      subscriptionId: subscription.id,
    };
  }

  const ownerId = getUserId(owner);

  if (!ownerId) {
    return {
      ok: false,
      message: "Canceled subscription owner is missing a persisted user id",
      subscriptionId: subscription.id,
    };
  }

  const freeCredits = getMonthlyCreditsForTier("free");
  const topupCredits = owner.topupCredits ?? 0;
  const totalCredits = freeCredits + topupCredits;
  const nextResetDate = new Date();
  nextResetDate.setMonth(nextResetDate.getMonth() + 1);
  nextResetDate.setDate(1);

  await connect();

  await userStore.findByIdAndUpdate(
    ownerId,
    {
      $set: {
        "subscription.tier": "free",
        "subscription.stripeSubscriptionId": null,
        "subscription.stripeCustomerId": getStripeCustomerId(subscription) ?? null,
        "subscription.stripePriceId": null,
        "subscription.currentPeriodEnd": null,
        monthlyCredits: freeCredits,
        creditsResetDate: nextResetDate,
        credits: totalCredits,
      },
    },
    { new: true }
  );

  logStripeFlow("info", "SUBSCRIPTION_CANCELED", {
    source,
    eventId,
    userId: ownerId,
    subscriptionId: subscription.id,
    monthlyCredits: freeCredits,
    topupCredits,
    totalCredits,
  });

  return {
    ok: true,
    message: "Subscription canceled and account returned to the free plan.",
    userId: ownerId,
    tier: "free",
    monthlyCredits: freeCredits,
    totalCredits,
    subscriptionId: subscription.id,
  };
}

export async function processTopupCheckout(
  options: ProcessTopupCheckoutOptions
): Promise<SubscriptionSyncResult> {
  const { stripe, checkoutSession, source, eventId } = options;
  const connect = options.connect ?? connectToDatabase;

  if (!checkoutSession.metadata?.userId || !checkoutSession.metadata?.topupPackageId) {
    return {
      ok: false,
      message: "Top-up checkout is missing required user or package metadata",
    };
  }

  await connect();

  const lineItems = await stripe.checkout.sessions.listLineItems(checkoutSession.id);
  const priceId = lineItems.data[0]?.price?.id;

  if (!priceId) {
    return {
      ok: false,
      message: `Top-up checkout ${checkoutSession.id} is missing a Stripe price id`,
      userId: checkoutSession.metadata.userId,
    };
  }

  const topupPackage = getTopupPackageFromPriceId(priceId);

  if (!topupPackage) {
    return {
      ok: false,
      message: `Unknown top-up price id ${priceId}`,
      userId: checkoutSession.metadata.userId,
    };
  }

  const updatedUser = await User.findByIdAndUpdate(
    checkoutSession.metadata.userId,
    {
      $inc: {
        topupCredits: topupPackage.credits,
        credits: topupPackage.credits,
      },
    },
    { new: true }
  );

  if (!updatedUser) {
    return {
      ok: false,
      message: `No user found for top-up checkout ${checkoutSession.id}`,
      userId: checkoutSession.metadata.userId,
    };
  }

  const totalCredits =
    (updatedUser.monthlyCredits ?? 0) + (updatedUser.topupCredits ?? 0);

  logStripeFlow("info", "TOPUP_SYNCED", {
    source,
    eventId,
    userId: checkoutSession.metadata.userId,
    checkoutSessionId: checkoutSession.id,
    topupCredits: topupPackage.credits,
    totalCredits,
  });

  return {
    ok: true,
    message: `Top-up completed for ${topupPackage.credits} credits.`,
    userId: checkoutSession.metadata.userId,
    monthlyCredits: updatedUser.monthlyCredits ?? 0,
    totalCredits,
  };
}