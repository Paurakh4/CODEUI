import { NextResponse } from "next/server";
import { stripe } from "@/lib/payments/stripe";
import {
  BILLING_CYCLES,
  PAID_SUBSCRIPTION_TIERS,
  getSubscriptionPriceId,
  type BillingCycle,
  type PaidSubscriptionTier,
  type StripePricingQuote,
} from "@/lib/pricing";

type PricingResponse = Record<
  PaidSubscriptionTier,
  Partial<Record<BillingCycle, StripePricingQuote>>
>;

export async function GET() {
  const prices = {} as PricingResponse;

  await Promise.all(
    PAID_SUBSCRIPTION_TIERS.flatMap((tier) => {
      prices[tier] = {};

      return BILLING_CYCLES.map(async (billingCycle) => {
        const priceId = getSubscriptionPriceId(tier, billingCycle);

        if (!priceId) {
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
        }
      });
    })
  );

  return NextResponse.json({ prices });
}