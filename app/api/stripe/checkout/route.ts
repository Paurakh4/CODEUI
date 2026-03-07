import { stripe } from "@/lib/payments/stripe";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
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

    const priceId = getSubscriptionPriceId(tier, billingCycle);

    if (!priceId) {
      return new NextResponse("Stripe price not configured for this subscription", { status: 500 });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?canceled=true`,
      customer_email: session.user.email!,
      metadata: {
        userId: session.user.id!,
        tier,
        billingCycle,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: any) {
    console.error("STRIPE_CHECKOUT_ERROR", err);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
