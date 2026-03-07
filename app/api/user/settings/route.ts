import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
import { isModelEnabled } from "@/lib/ai-models";
import {
  USER_PREFERENCE_COLOR_NAMES,
  USER_THEME_OPTIONS,
  normalizeUserPreferences,
} from "@/lib/user-preferences";

const updateSettingsSchema = z
  .object({
    theme: z.enum(USER_THEME_OPTIONS).optional(),
    primaryColor: z.enum(USER_PREFERENCE_COLOR_NAMES).optional(),
    secondaryColor: z.enum(USER_PREFERENCE_COLOR_NAMES).optional(),
    defaultModel: z
      .string()
      .min(1)
      .refine((value) => isModelEnabled(value), "Selected model is not enabled.")
      .optional(),
    enhancedPrompts: z.boolean().optional(),
    contactPreferences: z
      .object({
        productUpdates: z.boolean().optional(),
        marketingEmails: z.boolean().optional(),
      })
      .strict()
      .optional(),
    privacyPreferences: z
      .object({
        privateProjectsByDefault: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    const user = await User.findById(session.user.id)
      .select("preferences")
      .lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      settings: normalizeUserPreferences(user.preferences),
    });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
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
    const parsed = updateSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid settings update",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    await connectDB();

    const existingUser = await User.findById(session.user.id)
      .select("preferences")
      .lean();

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const mergedPreferences = normalizeUserPreferences({
      ...normalizeUserPreferences(existingUser.preferences),
      ...parsed.data,
      contactPreferences: {
        ...normalizeUserPreferences(existingUser.preferences).contactPreferences,
        ...parsed.data.contactPreferences,
      },
      privacyPreferences: {
        ...normalizeUserPreferences(existingUser.preferences).privacyPreferences,
        ...parsed.data.privacyPreferences,
      },
    });

    const user = await User.findByIdAndUpdate(
      session.user.id,
      { $set: { preferences: mergedPreferences } },
      { new: true, runValidators: true }
    )
      .select("preferences")
      .lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      settings: normalizeUserPreferences(user.preferences),
    });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}