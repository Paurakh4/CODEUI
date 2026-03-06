import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/lib/models";
import { getMonthlyCreditsForTier, SubscriptionTier } from "@/lib/pricing";

/**
 * Vercel Cron Job to reset monthly credits
 *
 * This endpoint should be called by Vercel Cron daily.
 * It resets monthly credits for users whose creditsResetDate has passed.
 *
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/reset-credits",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export async function GET(req: Request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const now = new Date();

    // Find all users whose reset date has passed
    const usersToReset = await User.find({
      creditsResetDate: { $lte: now },
    }).select("_id email subscription.tier creditsResetDate");

    let resetCount = 0;
    const errors: string[] = [];

    for (const user of usersToReset) {
      try {
        const tier = (user.subscription?.tier || "free") as SubscriptionTier;
        const monthlyCredits = getMonthlyCreditsForTier(tier);

        // Calculate next reset date (first of next month)
        const nextResetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        await User.findByIdAndUpdate(user._id, {
          $set: {
            monthlyCredits: monthlyCredits,
            creditsResetDate: nextResetDate,
            // Keep legacy fields in sync
            credits: monthlyCredits,
            creditsUsedThisMonth: 0,
          },
        });

        resetCount++;
      } catch (error) {
        console.error(`Error resetting credits for user ${user._id}:`, error);
        errors.push(user._id.toString());
      }
    }

    console.log(
      `Credit reset cron completed: ${resetCount} users reset, ${errors.length} errors`
    );

    return NextResponse.json({
      success: true,
      usersProcessed: usersToReset.length,
      usersReset: resetCount,
      errors: errors.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Credit reset cron error:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: String(error) },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(req: Request) {
  return GET(req);
}
