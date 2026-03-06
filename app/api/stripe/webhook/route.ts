import { stripe } from "@/lib/payments/stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import connectDB from "@/lib/db";
import { User } from "@/lib/models";
import {
  getTierFromPriceId,
  getMonthlyCreditsForTier,
  getTopupPackageFromPriceId,
  SubscriptionTier,
} from "@/lib/pricing";

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
    // Check if this is a subscription or one-time payment (top-up)
    if (session.mode === "subscription") {
      // Handle subscription checkout
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );

      if (!session?.metadata?.userId) {
        return new NextResponse("User id is required", { status: 400 });
      }

      try {
        await connectDB();

        const priceId = subscription.items.data[0].price.id;
        const tier = getTierFromPriceId(priceId);
        const monthlyCredits = getMonthlyCreditsForTier(tier);
        const nextResetDate = new Date(
          subscription.current_period_end * 1000
        );

        // Update user subscription and reset credits
        await User.findByIdAndUpdate(session.metadata.userId, {
          $set: {
            "subscription.stripeSubscriptionId": subscription.id,
            "subscription.stripeCustomerId": subscription.customer as string,
            "subscription.stripePriceId": priceId,
            "subscription.currentPeriodEnd": new Date(
              subscription.current_period_end * 1000
            ),
            "subscription.tier": tier,
            monthlyCredits: monthlyCredits,
            creditsResetDate: nextResetDate,
            // Keep legacy field in sync
            credits: monthlyCredits,
          },
        });

        console.log(
          `Subscription created for user: ${session.metadata.userId}, tier: ${tier}, credits: ${monthlyCredits}`
        );
      } catch (error) {
        console.error("Error updating user subscription:", error);
        return new NextResponse("Database error", { status: 500 });
      }
    } else if (session.mode === "payment") {
      // Handle one-time payment (top-up)
      if (!session?.metadata?.userId || !session?.metadata?.topupPackageId) {
        return new NextResponse("User id and topup package id required", {
          status: 400,
        });
      }

      try {
        await connectDB();

        // Get the line item to find the price ID
        const lineItems = await stripe.checkout.sessions.listLineItems(
          session.id
        );
        const priceId = lineItems.data[0]?.price?.id;

        if (!priceId) {
          return new NextResponse("Price ID not found", { status: 400 });
        }

        const topupPackage = getTopupPackageFromPriceId(priceId);
        if (!topupPackage) {
          console.error(`Unknown topup price ID: ${priceId}`);
          return new NextResponse("Unknown topup package", { status: 400 });
        }

        // Add topup credits to user
        await User.findByIdAndUpdate(session.metadata.userId, {
          $inc: {
            topupCredits: topupPackage.credits,
            // Keep legacy field in sync
            credits: topupPackage.credits,
          },
        });

        console.log(
          `Top-up completed for user: ${session.metadata.userId}, credits: ${topupPackage.credits}`
        );
      } catch (error) {
        console.error("Error processing top-up:", error);
        return new NextResponse("Database error", { status: 500 });
      }
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    // This handles subscription renewals
    const invoice = event.data.object as Stripe.Invoice;

    // Only process subscription invoices (not one-time payments)
    if (!invoice.subscription) {
      return new NextResponse(null, { status: 200 });
    }

    const subscription = await stripe.subscriptions.retrieve(
      invoice.subscription as string
    );

    try {
      await connectDB();

      const priceId = subscription.items.data[0].price.id;
      const tier = getTierFromPriceId(priceId);
      const monthlyCredits = getMonthlyCreditsForTier(tier);
      const nextResetDate = new Date(subscription.current_period_end * 1000);

      // Reset monthly credits on renewal
      await User.findOneAndUpdate(
        { "subscription.stripeSubscriptionId": subscription.id },
        {
          $set: {
            "subscription.stripePriceId": priceId,
            "subscription.currentPeriodEnd": nextResetDate,
            "subscription.tier": tier,
            monthlyCredits: monthlyCredits,
            creditsResetDate: nextResetDate,
            // Keep legacy field in sync
            credits: monthlyCredits,
            creditsUsedThisMonth: 0,
          },
        }
      );

      console.log(
        `Subscription renewed: ${subscription.id}, tier: ${tier}, credits reset to: ${monthlyCredits}`
      );
    } catch (error) {
      console.error("Error updating subscription payment:", error);
      return new NextResponse("Database error", { status: 500 });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    try {
      await connectDB();

      const freeCredits = getMonthlyCreditsForTier("free");
      const nextResetDate = new Date();
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);
      nextResetDate.setDate(1);

      // Reset user to free tier when subscription is cancelled
      await User.findOneAndUpdate(
        { "subscription.stripeSubscriptionId": subscription.id },
        {
          $set: {
            "subscription.tier": "free",
            "subscription.stripeSubscriptionId": null,
            "subscription.stripePriceId": null,
            "subscription.currentPeriodEnd": null,
            monthlyCredits: freeCredits,
            creditsResetDate: nextResetDate,
            // Keep legacy field in sync
            credits: freeCredits,
          },
        }
      );

      console.log(`Subscription cancelled: ${subscription.id}, reset to free tier with ${freeCredits} credits`);
    } catch (error) {
      console.error("Error handling subscription cancellation:", error);
      return new NextResponse("Database error", { status: 500 });
    }
  }

  return new NextResponse(null, { status: 200 });
}
