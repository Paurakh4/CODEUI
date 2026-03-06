import { stripe } from "@/lib/payments/stripe";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { TOPUP_PACKAGES } from "@/lib/pricing";

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

    // Find the topup package
    const topupPackage = TOPUP_PACKAGES.find((pkg) => pkg.id === packageId);

    if (!topupPackage) {
      return new NextResponse("Invalid package ID", { status: 400 });
    }

    if (!topupPackage.stripePriceId) {
      return new NextResponse("Stripe price not configured for this package", {
        status: 500,
      });
    }

    // Create Checkout Session for one-time payment
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: topupPackage.stripePriceId,
          quantity: 1,
        },
      ],
      mode: "payment", // One-time payment, not subscription
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?topup=success&credits=${topupPackage.credits}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?topup=canceled`,
      customer_email: session.user.email!,
      metadata: {
        userId: session.user.id!,
        topupPackageId: topupPackage.id,
        credits: topupPackage.credits.toString(),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: unknown) {
    console.error("STRIPE_TOPUP_ERROR", err);
    return new NextResponse("Internal Error", { status: 500 });
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
      available: !!pkg.stripePriceId,
    }));

    return NextResponse.json({ packages });
  } catch (err: unknown) {
    console.error("TOPUP_LIST_ERROR", err);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
