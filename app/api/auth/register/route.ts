import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicModelCatalog } from "@/lib/admin/model-policies";
import connectDB from "@/lib/db";
import {
  buildUserCreationInput,
  hashPassword,
  normalizeAuthEmail,
} from "@/lib/local-auth";
import { issueVerificationEmail } from "@/lib/auth-email";
import User from "@/lib/models/User";

const registerSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(72),
    name: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid registration request",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    await connectDB();

    const email = normalizeAuthEmail(parsed.data.email);
    const existingUser = await User.findOne({ email }).select("+passwordHash");
    const passwordHash = await hashPassword(parsed.data.password);

    if (existingUser) {
      if (
        !existingUser.passwordHash &&
        typeof existingUser.googleId === "string" &&
        existingUser.googleId.startsWith("local:")
      ) {
        existingUser.passwordHash = passwordHash;
        if (parsed.data.name?.trim()) {
          existingUser.name = parsed.data.name.trim();
        }
        await existingUser.save();
        const verification = await issueVerificationEmail(email);

        return NextResponse.json(
          {
            success: true,
            repaired: true,
            verificationEmailSent: verification.delivered,
          },
          { status: 200 }
        );
      }

      const errorMessage = existingUser.passwordHash
        ? "An account with this email already exists. Sign in instead."
        : "This email is already linked to Google sign-in.";

      return NextResponse.json({ error: errorMessage }, { status: 409 });
    }

    const modelCatalog = await getPublicModelCatalog();

    await User.create(
      buildUserCreationInput({
        email,
        name: parsed.data.name,
        passwordHash,
        defaultModelId: modelCatalog.defaultModelId,
      })
    );

    const verification = await issueVerificationEmail(email);

    return NextResponse.json(
      {
        success: true,
        verificationEmailSent: verification.delivered,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registering credentials user:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}