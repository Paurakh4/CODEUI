import { NextResponse } from "next/server";
import { verifyKhaltiPayment } from "@/lib/payments/khalti";
import connectDB from "@/lib/db";
import { User } from "@/lib/models";
import {
  TIERS,
  TOPUP_PACKAGES,
  SubscriptionTier,
  TierConfig
} from "@/lib/pricing";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pidx = searchParams.get("pidx");
  const purchaseOrderId = searchParams.get("purchase_order_id");
  const status = searchParams.get("status"); // Usually 'Completed' if success

  if (!pidx || !purchaseOrderId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=invalid_callback`);
  }

  try {
    // 1. Verify Payment
    const verification = await verifyKhaltiPayment(pidx);
    
    if (verification.status !== "Completed") {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=payment_failed`);
    }

    // 2. Parse purchase_order_id
    // Format: userId__planId__timestamp
    const parts = purchaseOrderId.split("__");
    if (parts.length < 3) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=invalid_order_id`);
    }

    const userId = parts[0];
    const planId = parts[1];

    await connectDB();

    // 3. Update User
    // Check if it's a subscription or topup
    if (planId.startsWith("topup_")) {
      // Handle Topup
      const packageDetails = TOPUP_PACKAGES.find(p => p.id === planId);
      
      if (!packageDetails) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=invalid_package`);
      }

      await User.findByIdAndUpdate(userId, {
        $inc: { 
          topupCredits: packageDetails.credits,
          credits: packageDetails.credits 
        }
      });

    } else {
      // Handle Subscription (Pro / ProPlus)
      // Since Khalti is one-time, we grant 30 days access
      const tierKey = planId as SubscriptionTier;
      const tierConfig = TIERS[tierKey];

      if (!tierConfig) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=invalid_tier`);
      }

      const oneMonthFromNow = new Date();
      oneMonthFromNow.setDate(oneMonthFromNow.getDate() + 30);

      await User.findByIdAndUpdate(userId, {
        $set: {
          "subscription.tier": tierKey,
          "subscription.currentPeriodEnd": oneMonthFromNow,
          // We don't have stripe IDs, so we can leave them or set a marker
          "subscription.stripeSubscriptionId": `khalti_${pidx}`,
          "subscription.stripeCustomerId": `khalti_${userId}`, 
          "subscription.stripePriceId": planId,
          monthlyCredits: tierConfig.monthlyCredits,
          creditsResetDate: oneMonthFromNow,
          credits: tierConfig.monthlyCredits, // Reset credits to monthly limit
        }
      });
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`);

  } catch (error) {
    console.error("KHALTI_CALLBACK_ERROR", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=server_error`);
  }
}
