/**
 * Credit System Pricing Configuration
 *
 * Subscription Tiers:
 * - Free: 20 prompts/month (no payment)
 * - Pro: 120 prompts/month for $10
 * - ProPlus: 350 prompts/month for $30
 *
 * Top-up packages (one-time):
 * - 25 credits for $5
 * - 50 credits for $10
 * - 100 credits for $20
 *
 * Staff/Admin overrides via STAFF_CREDITS env variable:
 * Format: email:credits,email:credits
 * Example: admin@example.com:999,staff@example.com:500
 *
 * Admin bypass via ADMIN_EMAILS env variable:
 * Format: email,email
 * Example: admin@example.com,owner@example.com
 */

export type SubscriptionTier = "free" | "pro" | "proplus";
export type PaidSubscriptionTier = Exclude<SubscriptionTier, "free">;
export type BillingCycle = "monthly" | "yearly";

export interface TierConfig {
  name: string;
  monthlyCredits: number;
  priceMonthly: number;
  priceYearly?: number;
  description: string;
  features: string[];
}

export interface TopupPackage {
  id: string;
  credits: number;
  price: number;
}

export interface StripePricingQuote {
  amount: number;
  currency: string;
  priceId: string;
}

export const BILLING_CYCLES: BillingCycle[] = ["monthly", "yearly"];
export const PAID_SUBSCRIPTION_TIERS: PaidSubscriptionTier[] = ["pro", "proplus"];

// Subscription tier configurations
export const TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    name: "Free",
    monthlyCredits: 20,
    priceMonthly: 0,
    description: "Perfect for exploring and small projects",
    features: [
      "20 prompts per month",
      "All AI models",
      "Public projects",
      "Community support",
    ],
  },
  pro: {
    name: "Pro",
    monthlyCredits: 120,
    priceMonthly: 10,
    priceYearly: 100,
    description: "For creators who need more power",
    features: [
      "120 prompts per month",
      "All AI models",
      "Private projects",
      "Export to code",
      "Priority support",
      "Version history",
    ],
  },
  proplus: {
    name: "Pro Plus",
    monthlyCredits: 350,
    priceMonthly: 30,
    priceYearly: 300,
    description: "For power users and teams",
    features: [
      "350 prompts per month",
      "All AI models",
      "Private projects",
      "Export to code",
      "Priority support",
      "Version history",
      "Early access to new features",
    ],
  },
};

// Top-up packages for one-time credit purchases
export const TOPUP_PACKAGES: TopupPackage[] = [
  {
    id: "topup_25",
    credits: 25,
    price: 5,
  },
  {
    id: "topup_50",
    credits: 50,
    price: 10,
  },
  {
    id: "topup_100",
    credits: 100,
    price: 20,
  },
];

function getSubscriptionPriceIds(): Record<PaidSubscriptionTier, Record<BillingCycle, string | undefined>> {
  return {
    pro: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID,
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    },
    proplus: {
      monthly: process.env.STRIPE_PROPLUS_MONTHLY_PRICE_ID || process.env.STRIPE_PROPLUS_PRICE_ID,
      yearly: process.env.STRIPE_PROPLUS_YEARLY_PRICE_ID,
    },
  };
}

function getTopupPriceIds(): Record<TopupPackage["id"], string | undefined> {
  return {
    topup_25: process.env.STRIPE_TOPUP_25_PRICE_ID,
    topup_50: process.env.STRIPE_TOPUP_50_PRICE_ID,
    topup_100: process.env.STRIPE_TOPUP_100_PRICE_ID,
  };
}

export function getSubscriptionPriceId(
  tier: PaidSubscriptionTier,
  billingCycle: BillingCycle
): string | undefined {
  return getSubscriptionPriceIds()[tier][billingCycle];
}

export function getTopupPriceId(packageId: TopupPackage["id"]): string | undefined {
  return getTopupPriceIds()[packageId];
}

/**
 * Parse staff credits from environment variable
 * Format: email:credits,email:credits
 * Example: admin@example.com:999,staff@example.com:500
 */
export function getStaffCredits(): Map<string, number> {
  const staffCreditsEnv = process.env.STAFF_CREDITS || "";
  const staffMap = new Map<string, number>();

  if (!staffCreditsEnv.trim()) {
    return staffMap;
  }

  const entries = staffCreditsEnv.split(",");
  for (const entry of entries) {
    const [email, creditsStr] = entry.trim().split(":");
    if (email && creditsStr) {
      const credits = parseInt(creditsStr, 10);
      if (!isNaN(credits)) {
        staffMap.set(email.toLowerCase().trim(), credits);
      }
    }
  }

  return staffMap;
}

/**
 * Parse admin emails from environment variables.
 * Supports:
 * - ADMIN_EMAILS: comma-separated emails
 * - ADMIN_EMAIL: single email
 * - ADMIN: single email
 */
export function getAdminEmails(): Set<string> {
  const adminEmailsEnv = process.env.ADMIN_EMAILS || ""
  const adminEmailEnv = process.env.ADMIN_EMAIL || ""
  const adminEnv = process.env.ADMIN || ""

  const combined = [adminEmailsEnv, adminEmailEnv, adminEnv]
    .filter(Boolean)
    .join(",")

  if (!combined.trim()) {
    return new Set<string>()
  }

  return new Set(
    combined
      .split(",")
      .map((email) => email.toLowerCase().trim())
      .filter((email) => email.length > 0)
  )
}

/**
 * Check if a user is configured as admin.
 */
export function isAdminUser(email: string): boolean {
  if (!email) {
    return false
  }

  const admins = getAdminEmails()
  return admins.has(email.toLowerCase().trim())
}

/**
 * Check if a user is a staff/admin with custom credit limit
 */
export function isStaffUser(email: string): boolean {
  const staffCredits = getStaffCredits();
  return staffCredits.has(email.toLowerCase().trim());
}

/**
 * Get staff credit limit for a user
 * Returns undefined if user is not staff
 */
export function getStaffCreditLimit(email: string): number | undefined {
  const staffCredits = getStaffCredits();
  return staffCredits.get(email.toLowerCase());
}

/**
 * Get tier from Stripe price ID
 */
export function getTierFromPriceId(priceId: string): SubscriptionTier {
  const subscriptionPriceIds = getSubscriptionPriceIds();

  for (const tier of PAID_SUBSCRIPTION_TIERS) {
    const priceIds = subscriptionPriceIds[tier];
    if (priceIds.monthly === priceId || priceIds.yearly === priceId) {
      return tier;
    }
  }

  return "free";
}

/**
 * Get topup package from Stripe price ID
 */
export function getTopupPackageFromPriceId(
  priceId: string
): TopupPackage | undefined {
  return TOPUP_PACKAGES.find((pkg) => getTopupPriceId(pkg.id) === priceId);
}

/**
 * Get monthly credit limit for a tier
 */
export function getMonthlyCreditsForTier(tier: SubscriptionTier): number {
  return TIERS[tier]?.monthlyCredits ?? TIERS.free.monthlyCredits;
}

/**
 * Check if user has available credits
 * Considers: monthly credits + topup credits + staff overrides
 */
export function hasAvailableCredits(
  email: string,
  monthlyCredits: number,
  topupCredits: number
): boolean {
  if (isAdminUser(email)) {
    return true;
  }

  // Staff users with unlimited or high credits
  const staffLimit = getStaffCreditLimit(email);
  if (staffLimit !== undefined) {
    return true; // Staff always has credits (we check limit separately)
  }

  return monthlyCredits + topupCredits > 0;
}

/**
 * Calculate credits to deduct
 * Returns { fromMonthly, fromTopup } breakdown
 */
export function calculateCreditDeduction(
  monthlyCredits: number,
  topupCredits: number,
  cost: number = 1
): { fromMonthly: number; fromTopup: number } {
  // Deduct from monthly credits first
  const fromMonthly = Math.min(monthlyCredits, cost);
  const remaining = cost - fromMonthly;
  const fromTopup = Math.min(topupCredits, remaining);

  return { fromMonthly, fromTopup };
}
