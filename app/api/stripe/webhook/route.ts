import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import connectDB from "@/lib/db";
import { User } from "@/lib/models";

// Map Stripe price IDs to subscription tiers
function getTierFromPriceId(priceId: string): "free" | "pro" | "enterprise" {
  // Update these with your actual Stripe price IDs
  const proPriceIds = [
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
    process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  ];
  const enterprisePriceIds = [
    process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
    process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
  ];

  if (proPriceIds.includes(priceId)) return "pro";
  if (enterprisePriceIds.includes(priceId)) return "enterprise";
  return "free";
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (event.type === "checkout.session.completed") {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );

    if (!session?.metadata?.userId) {
      return new NextResponse("User id is required", { status: 400 });
    }

    try {
      await connectDB();

      // Update user subscription in MongoDB
      await User.findByIdAndUpdate(session.metadata.userId, {
        $set: {
          "subscription.stripeSubscriptionId": subscription.id,
          "subscription.stripeCustomerId": subscription.customer as string,
          "subscription.stripePriceId": subscription.items.data[0].price.id,
          "subscription.currentPeriodEnd": new Date(
            subscription.current_period_end * 1000
          ),
          "subscription.tier": getTierFromPriceId(
            subscription.items.data[0].price.id
          ),
        },
      });

      console.log("Subscription created for user:", session.metadata.userId);
    } catch (error) {
      console.error("Error updating user subscription:", error);
      return new NextResponse("Database error", { status: 500 });
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );

    try {
      await connectDB();

      // Update user subscription in MongoDB
      await User.findOneAndUpdate(
        { "subscription.stripeSubscriptionId": subscription.id },
        {
          $set: {
            "subscription.stripePriceId": subscription.items.data[0].price.id,
            "subscription.currentPeriodEnd": new Date(
              subscription.current_period_end * 1000
            ),
            "subscription.tier": getTierFromPriceId(
              subscription.items.data[0].price.id
            ),
          },
        }
      );

      console.log("Payment succeeded for subscription:", subscription.id);
    } catch (error) {
      console.error("Error updating subscription payment:", error);
      return new NextResponse("Database error", { status: 500 });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    try {
      await connectDB();

      // Reset user to free tier when subscription is cancelled
      await User.findOneAndUpdate(
        { "subscription.stripeSubscriptionId": subscription.id },
        {
          $set: {
            "subscription.tier": "free",
            "subscription.stripeSubscriptionId": null,
            "subscription.stripePriceId": null,
            "subscription.currentPeriodEnd": null,
          },
        }
      );

      console.log("Subscription cancelled:", subscription.id);
    } catch (error) {
      console.error("Error handling subscription cancellation:", error);
      return new NextResponse("Database error", { status: 500 });
    }
  }

  return new NextResponse(null, { status: 200 });
}
