import { getStripeServer } from "@/lib/payments/stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeWebhookConfigIssues } from "@/lib/payments/stripe-config";
import {
  cancelSubscriptionByLookup,
  processTopupCheckout,
  syncCheckoutSubscription,
  syncSubscriptionByLookup,
} from "@/lib/payments/stripe-subscription-sync";
import { logStripeFlow, serializeStripeError } from "@/lib/payments/stripe-logging";

export async function POST(req: Request) {
  const [configIssue] = getStripeWebhookConfigIssues();

  if (configIssue) {
    return new NextResponse(configIssue, { status: 500 });
  }

  const body = await req.text();
  const signature = (await headers()).get("Stripe-Signature") as string;

  if (!signature) {
    return new NextResponse("Missing Stripe-Signature header", { status: 400 });
  }

  const stripe = getStripeServer();

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
    logStripeFlow("error", "WEBHOOK_SIGNATURE_INVALID", {
      error: serializeStripeError(error),
    });
    return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  logStripeFlow("info", "WEBHOOK_RECEIVED", {
    eventId: event.id,
    type: event.type,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === "subscription") {
          const result = await syncCheckoutSubscription({
            stripe,
            checkoutSession: session,
            source: event.type,
            eventId: event.id,
          });

          if (!result.ok) {
            logStripeFlow("error", "CHECKOUT_SESSION_COMPLETED_FAILED", {
              eventId: event.id,
              checkoutSessionId: session.id,
              userId: result.userId,
              subscriptionId: result.subscriptionId,
              message: result.message,
            });
            return new NextResponse(result.message, { status: 500 });
          }
        }

        if (session.mode === "payment") {
          const result = await processTopupCheckout({
            stripe,
            checkoutSession: session,
            source: event.type,
            eventId: event.id,
          });

          if (!result.ok) {
            logStripeFlow("error", "TOPUP_CHECKOUT_FAILED", {
              eventId: event.id,
              checkoutSessionId: session.id,
              userId: result.userId,
              message: result.message,
            });
            return new NextResponse(result.message, { status: 500 });
          }
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const result = await syncSubscriptionByLookup({
          subscription,
          userId: subscription.metadata?.userId,
          source: event.type,
          eventId: event.id,
        });

        if (!result.ok) {
          logStripeFlow("warn", "SUBSCRIPTION_EVENT_UNMATCHED", {
            eventId: event.id,
            type: event.type,
            subscriptionId: subscription.id,
            userId: subscription.metadata?.userId,
            message: result.message,
          });
        }

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceSubscriptionId = (
          invoice as Stripe.Invoice & { subscription?: string | null }
        ).subscription;

        if (!invoiceSubscriptionId) {
          logStripeFlow("info", "INVOICE_PAYMENT_SUCCEEDED_IGNORED", {
            eventId: event.id,
            invoiceId: invoice.id,
          });
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          invoiceSubscriptionId
        );
        const result = await syncSubscriptionByLookup({
          subscription,
          userId: subscription.metadata?.userId,
          source: event.type,
          eventId: event.id,
          resetUsage: true,
        });

        if (!result.ok) {
          logStripeFlow("error", "INVOICE_PAYMENT_SYNC_FAILED", {
            eventId: event.id,
            invoiceId: invoice.id,
            subscriptionId: subscription.id,
            message: result.message,
          });
          return new NextResponse(result.message, { status: 500 });
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const result = await cancelSubscriptionByLookup({
          subscription,
          source: event.type,
          eventId: event.id,
        });

        if (!result.ok) {
          logStripeFlow("error", "SUBSCRIPTION_CANCEL_FAILED", {
            eventId: event.id,
            subscriptionId: subscription.id,
            message: result.message,
          });
          return new NextResponse(result.message, { status: 500 });
        }

        break;
      }

      default:
        logStripeFlow("info", "WEBHOOK_EVENT_IGNORED", {
          eventId: event.id,
          type: event.type,
        });
    }
  } catch (error) {
    logStripeFlow("error", "WEBHOOK_PROCESSING_FAILED", {
      eventId: event.id,
      type: event.type,
      error: serializeStripeError(error),
    });
    return new NextResponse("Webhook processing failed", { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
