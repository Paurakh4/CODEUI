import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { Project, User } from "@/lib/models";
import { TIERS, type SubscriptionTier } from "@/lib/pricing";

const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Display name must be at least 2 characters.")
      .max(80, "Display name must be 80 characters or less."),
  })
  .strict();

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const [user, projectCount, recentProjects] = await Promise.all([
      User.findById(session.user.id)
        .select(
          "name email image createdAt updatedAt subscription.tier monthlyCredits topupCredits totalCreditsUsed"
        )
        .lean(),
      Project.countDocuments({ userId: session.user.id }),
      Project.find({ userId: session.user.id })
        .select("_id name emoji updatedAt isPrivate")
        .sort({ updatedAt: -1 })
        .limit(4)
        .lean(),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tier = (user.subscription?.tier || "free") as SubscriptionTier;
    const tierInfo = TIERS[tier];

    return NextResponse.json({
      profile: {
        name: user.name,
        email: user.email,
        image: user.image || null,
        memberSince: user.createdAt,
        lastUpdated: user.updatedAt,
        projectCount,
        subscription: {
          tier,
          tierName: tierInfo?.name || "Free",
          monthlyAllowance: tierInfo?.monthlyCredits || 20,
        },
        credits: {
          monthlyCredits: user.monthlyCredits ?? 0,
          topupCredits: user.topupCredits ?? 0,
          totalCredits: (user.monthlyCredits ?? 0) + (user.topupCredits ?? 0),
          totalCreditsUsed: user.totalCreditsUsed ?? 0,
        },
        recentProjects: recentProjects.map((project) => ({
          id: project._id.toString(),
          name: project.name,
          emoji: project.emoji,
          updatedAt: project.updatedAt,
          isPrivate: project.isPrivate,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid profile update",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findByIdAndUpdate(
      session.user.id,
      { $set: { name: parsed.data.name } },
      { new: true, runValidators: true }
    )
      .select("name email image")
      .lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      profile: {
        name: user.name,
        email: user.email,
        image: user.image || null,
      },
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}