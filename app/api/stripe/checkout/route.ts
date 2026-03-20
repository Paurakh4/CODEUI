import { getStripeServer } from "@/lib/payments/stripe";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { buildAppUrl, getStripeServerConfigIssues, isConfiguredEnvValue } from "@/lib/payments/stripe-config";
import { logStripeFlow, serializeStripeError } from "@/lib/payments/stripe-logging";
import {
  getSubscriptionPriceId,
  type BillingCycle,
  type PaidSubscriptionTier,
} from "@/lib/pricing";

const VALID_BILLING_CYCLES: BillingCycle[] = ["monthly", "yearly"];
const VALID_TIERS: PaidSubscriptionTier[] = ["pro", "proplus"];

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { tier, billingCycle } = await req.json() as {
      tier?: PaidSubscriptionTier;
      billingCycle?: BillingCycle;
    };

    if (!tier || !VALID_TIERS.includes(tier)) {
      return new NextResponse("A valid subscription tier is required", { status: 400 });
    }

    if (!billingCycle || !VALID_BILLING_CYCLES.includes(billingCycle)) {
      return new NextResponse("A valid billing cycle is required", { status: 400 });
    }

    if (!session.user.id) {
      return new NextResponse("Authenticated user is missing an internal user id", { status: 400 });
    }

    const [configIssue] = getStripeServerConfigIssues();

    if (configIssue) {
      return new NextResponse(configIssue, { status: 500 });
    }

    const priceId = getSubscriptionPriceId(tier, billingCycle);

    if (!priceId) {
      return new NextResponse(`Stripe price is not configured for the ${tier} ${billingCycle} plan`, { status: 400 });
    }

    if (!isConfiguredEnvValue(priceId)) {
      return new NextResponse(`Stripe price for the ${tier} ${billingCycle} plan is still set to a placeholder value`, { status: 400 });
    }

    const stripe = getStripeServer();
    const userId = session.user.id;

    logStripeFlow("info", "CHECKOUT_REQUESTED", {
      userId,
      tier,
      billingCycle,
      priceId,
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: buildAppUrl("/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: buildAppUrl("/dashboard?canceled=true"),
      client_reference_id: userId,
      customer_email: session.user.email!,
      metadata: {
        userId,
        tier,
        billingCycle,
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
          billingCycle,
        },
      },
    });

    logStripeFlow("info", "CHECKOUT_CREATED", {
      userId,
      tier,
      billingCycle,
      priceId,
      checkoutSessionId: checkoutSession.id,
      stripeStatus: checkoutSession.status,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: unknown) {
    logStripeFlow("error", "CHECKOUT_FAILED", {
      error: serializeStripeError(err),
    });
    const message = err instanceof Error ? err.message : "Unable to create Stripe checkout session";
    return new NextResponse(message, { status: 500 });
  }
}
