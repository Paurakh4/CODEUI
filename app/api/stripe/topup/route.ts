import { getStripeServer } from "@/lib/payments/stripe";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { TOPUP_PACKAGES, getTopupPriceId } from "@/lib/pricing";
import { buildAppUrl, getStripeServerConfigIssues, isConfiguredEnvValue } from "@/lib/payments/stripe-config";

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { packageId } = await req.json();

    if (!packageId) {
      return new NextResponse("Package ID is required", { status: 400 });
    }

    if (!session.user.id) {
      return new NextResponse("Authenticated user is missing an internal user id", { status: 400 });
    }

    const [configIssue] = getStripeServerConfigIssues();

    if (configIssue) {
      return new NextResponse(configIssue, { status: 500 });
    }

    // Find the topup package
    const topupPackage = TOPUP_PACKAGES.find((pkg) => pkg.id === packageId);

    if (!topupPackage) {
      return new NextResponse("Invalid package ID", { status: 400 });
    }

    const priceId = getTopupPriceId(topupPackage.id);

    if (!priceId) {
      return new NextResponse(`Stripe price is not configured for the ${topupPackage.credits}-credit top-up`, {
        status: 500,
      });
    }

    if (!isConfiguredEnvValue(priceId)) {
      return new NextResponse(`Stripe price for the ${topupPackage.credits}-credit top-up is still set to a placeholder value`, {
        status: 400,
      });
    }

    const stripe = getStripeServer();

    // Create Checkout Session for one-time payment
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment", // One-time payment, not subscription
      success_url: buildAppUrl(`/dashboard?topup=success&credits=${topupPackage.credits}`),
      cancel_url: buildAppUrl("/dashboard?topup=canceled"),
      customer_email: session.user.email!,
      metadata: {
        userId: session.user.id,
        topupPackageId: topupPackage.id,
        credits: topupPackage.credits.toString(),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: unknown) {
    console.error("STRIPE_TOPUP_ERROR", err);
    const message = err instanceof Error ? err.message : "Unable to create Stripe top-up session";
    return new NextResponse(message, { status: 500 });
  }
}

// GET endpoint to list available topup packages
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Return available packages (without sensitive Stripe IDs)
    const packages = TOPUP_PACKAGES.map((pkg) => ({
      id: pkg.id,
      credits: pkg.credits,
      price: pkg.price,
      available: isConfiguredEnvValue(getTopupPriceId(pkg.id)),
    }));

    return NextResponse.json({ packages });
  } catch (err: unknown) {
    console.error("TOPUP_LIST_ERROR", err);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
