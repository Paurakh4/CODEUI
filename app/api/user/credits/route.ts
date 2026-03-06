import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User, UsageLog } from "@/lib/models";
import {
  getMonthlyCreditsForTier,
  isStaffUser,
  isAdminUser,
  getStaffCreditLimit,
  TIERS,
  SubscriptionTier,
} from "@/lib/pricing";

// GET /api/user/credits - Get current user's credits and usage
export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const user = await User.findById(session.user.id).select(
      "email monthlyCredits topupCredits creditsResetDate totalCreditsUsed subscription.tier credits creditsUsedThisMonth"
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tier = (user.subscription?.tier || "free") as SubscriptionTier;
    const tierConfig = TIERS[tier];

    // Check if user is staff
    const staffCreditLimit = getStaffCreditLimit(user.email);
    const isStaff = isStaffUser(user.email);
    const isAdmin = isAdminUser(user.email);

    // Get usage history for current month (optional query param)
    const url = new URL(req.url);
    const includeHistory = url.searchParams.get("history") === "true";

    let recentUsage: Array<{
      timestamp: Date;
      aiModel: string;
      promptType: string;
    }> = [];

    if (includeHistory) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      recentUsage = await UsageLog.find({
        userId: user._id,
        timestamp: { $gte: thirtyDaysAgo },
      })
        .select("timestamp aiModel promptType creditsCost")
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();
    }

    return NextResponse.json({
      // New credit system fields
      monthlyCredits: user.monthlyCredits ?? 0,
      topupCredits: user.topupCredits ?? 0,
      totalCredits: (user.monthlyCredits ?? 0) + (user.topupCredits ?? 0),
      creditsResetDate: user.creditsResetDate,
      totalCreditsUsed: user.totalCreditsUsed ?? 0,

      // Tier info
      tier: tier,
      tierName: tierConfig?.name || "Free",
      monthlyAllowance: tierConfig?.monthlyCredits || 20,

      // Staff info
      isStaff: isStaff,
      staffCreditLimit: staffCreditLimit,
      isAdmin: isAdmin,

      // Legacy fields (backwards compatibility)
      credits: user.credits ?? user.monthlyCredits ?? 0,
      creditsUsedThisMonth: user.creditsUsedThisMonth ?? 0,

      // Usage history (if requested)
      ...(includeHistory && { recentUsage }),
    });
  } catch (error) {
    console.error("Error fetching user credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 }
    );
  }
}
