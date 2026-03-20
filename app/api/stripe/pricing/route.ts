import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/payments/stripe";
import { getStripeServerConfigIssues, isConfiguredEnvValue } from "@/lib/payments/stripe-config";
import {
  BILLING_CYCLES,
  PAID_SUBSCRIPTION_TIERS,
  TIERS,
  getSubscriptionPriceId,
  type BillingCycle,
  type PaidSubscriptionTier,
  type StripePricingQuote,
} from "@/lib/pricing";

type PricingResponse = Record<
  PaidSubscriptionTier,
  Partial<Record<BillingCycle, StripePricingQuote>>
>;

type PricingAvailabilityResponse = Record<
  PaidSubscriptionTier,
  Record<BillingCycle, boolean>
>;

export async function GET() {
  const prices = {} as PricingResponse;
  const availability = {} as PricingAvailabilityResponse;
  const issues = new Set<string>(getStripeServerConfigIssues());
  const canLoadLivePricing = issues.size === 0;

  let stripe = null;

  if (canLoadLivePricing) {
    stripe = getStripeServer();
  }

  await Promise.all(
    PAID_SUBSCRIPTION_TIERS.flatMap((tier) => {
      prices[tier] = {};
      availability[tier] = {
        monthly: false,
        yearly: false,
      };

      return BILLING_CYCLES.map(async (billingCycle) => {
        const priceId = getSubscriptionPriceId(tier, billingCycle);
        availability[tier][billingCycle] = isConfiguredEnvValue(priceId);

        if (!priceId) {
          issues.add(`${TIERS[tier].name} ${billingCycle} billing is not configured in Stripe`);
          return;
        }

        if (!isConfiguredEnvValue(priceId)) {
          issues.add(`${TIERS[tier].name} ${billingCycle} billing is still using a placeholder Stripe price ID`);
          return;
        }

        if (!stripe) {
          return;
        }

        try {
          const stripePrice = await stripe.prices.retrieve(priceId);

          if (typeof stripePrice.unit_amount !== "number") {
            return;
          }

          prices[tier][billingCycle] = {
            amount: stripePrice.unit_amount / 100,
            currency: stripePrice.currency,
            priceId,
          };
        } catch (error) {
          console.error("STRIPE_PRICING_LOOKUP_ERROR", { tier, billingCycle, priceId, error });
          issues.add(`Unable to load live Stripe pricing for ${TIERS[tier].name} ${billingCycle}`);
        }
      });
    })
  );

  return NextResponse.json({
    prices,
    availability,
    issues: Array.from(issues),
  });
}