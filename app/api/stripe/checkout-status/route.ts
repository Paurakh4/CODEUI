import { auth } from "@/lib/auth";
import { getStripeServer } from "@/lib/payments/stripe";
import { NextResponse } from "next/server";
import { logStripeFlow, serializeStripeError } from "@/lib/payments/stripe-logging";
import { getStripeServerConfigIssues } from "@/lib/payments/stripe-config";
import { syncCheckoutSubscription } from "@/lib/payments/stripe-subscription-sync";
import type { CheckoutSyncResponse } from "@/lib/payments/checkout-sync";

function buildResponse(
  body: CheckoutSyncResponse,
  status: number
) {
  return NextResponse.json(body, { status });
}

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return buildResponse(
      {
        status: "failed",
        message: "You must be signed in to verify a Stripe checkout.",
      },
      401
    );
  }

  const [configIssue] = getStripeServerConfigIssues();

  if (configIssue) {
    return buildResponse(
      {
        status: "failed",
        message: configIssue,
      },
      500
    );
  }

  const requestUrl = new URL(req.url);
  const checkoutSessionId = requestUrl.searchParams.get("session_id");

  if (!checkoutSessionId) {
    return buildResponse(
      {
        status: "failed",
        message: "A Stripe checkout session id is required.",
      },
      400
    );
  }

  const stripe = getStripeServer();

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(
      checkoutSessionId,
      {
        expand: ["subscription"],
      }
    );

    const ownerUserId =
      checkoutSession.metadata?.userId || checkoutSession.client_reference_id;

    if (ownerUserId && ownerUserId !== session.user.id) {
      return buildResponse(
        {
          status: "failed",
          message: "This Stripe checkout does not belong to the active account.",
        },
        403
      );
    }

    if (checkoutSession.mode !== "subscription") {
      return buildResponse(
        {
          status: "failed",
          message: "This Stripe checkout is not a subscription upgrade.",
        },
        409
      );
    }

    if (checkoutSession.status !== "complete") {
      return buildResponse(
        {
          status: "processing",
          message: "Stripe checkout completed, but the subscription is still being finalized.",
        },
        202
      );
    }

    if (
      checkoutSession.payment_status !== "paid" &&
      checkoutSession.payment_status !== "no_payment_required"
    ) {
      return buildResponse(
        {
          status: "processing",
          message: "Stripe is still confirming the payment for this subscription.",
        },
        202
      );
    }

    const result = await syncCheckoutSubscription({
      stripe,
      checkoutSession,
      source: "checkout-status",
    });

    if (!result.ok) {
      logStripeFlow("warn", "CHECKOUT_STATUS_SYNC_PENDING", {
        checkoutSessionId,
        userId: session.user.id,
        message: result.message,
      });

      return buildResponse(
        {
          status: "processing",
          message: result.message,
        },
        202
      );
    }

    return buildResponse(
      {
        status: "confirmed",
        message: result.message,
        tier: result.tier,
        monthlyCredits: result.monthlyCredits,
        totalCredits: result.totalCredits,
        subscriptionId: result.subscriptionId,
      },
      200
    );
  } catch (error) {
    logStripeFlow("error", "CHECKOUT_STATUS_FAILED", {
      checkoutSessionId,
      userId: session.user.id,
      error: serializeStripeError(error),
    });

    return buildResponse(
      {
        status: "failed",
        message: "Unable to verify the Stripe checkout right now.",
      },
      500
    );
  }
}