import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPublicModelCatalog } from "@/lib/admin/model-policies";
import connectDB from "@/lib/db";
import User from "@/lib/models/User";
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
    defaultModel: z.string().min(1).optional(),
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
    const catalog = await getPublicModelCatalog();
    const isRuntimeModelEnabled = (value: string) =>
      catalog.models.some((model) => model.id === value);

    const user = await User.findById(session.user.id)
      .select("preferences")
      .lean();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      settings: normalizeUserPreferences(user.preferences, {
        defaultModel: catalog.defaultModelId,
        isModelEnabled: isRuntimeModelEnabled,
      }),
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
    const catalog = await getPublicModelCatalog();
    const isRuntimeModelEnabled = (value: string) =>
      catalog.models.some((model) => model.id === value);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid settings update",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    if (parsed.data.defaultModel && !isRuntimeModelEnabled(parsed.data.defaultModel)) {
      return NextResponse.json(
        {
          error: "Invalid settings update",
          details: {
            fieldErrors: {
              defaultModel: ["Selected model is not enabled."],
            },
            formErrors: [],
          },
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
      ...normalizeUserPreferences(existingUser.preferences, {
        defaultModel: catalog.defaultModelId,
        isModelEnabled: isRuntimeModelEnabled,
      }),
      ...parsed.data,
      contactPreferences: {
        ...normalizeUserPreferences(existingUser.preferences, {
          defaultModel: catalog.defaultModelId,
          isModelEnabled: isRuntimeModelEnabled,
        }).contactPreferences,
        ...parsed.data.contactPreferences,
      },
      privacyPreferences: {
        ...normalizeUserPreferences(existingUser.preferences, {
          defaultModel: catalog.defaultModelId,
          isModelEnabled: isRuntimeModelEnabled,
        }).privacyPreferences,
        ...parsed.data.privacyPreferences,
      },
    }, {
      defaultModel: catalog.defaultModelId,
      isModelEnabled: isRuntimeModelEnabled,
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
      settings: normalizeUserPreferences(user.preferences, {
        defaultModel: catalog.defaultModelId,
        isModelEnabled: isRuntimeModelEnabled,
      }),
    });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}