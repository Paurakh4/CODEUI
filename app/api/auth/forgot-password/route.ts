import { NextResponse } from "next/server";
import { z } from "zod";
import { issuePasswordResetEmail } from "@/lib/auth-email";
import connectDB from "@/lib/db";
import { normalizeAuthEmail } from "@/lib/local-auth";
import User from "@/lib/models/User";

const forgotPasswordSchema = z
  .object({
    email: z.string().trim().email(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid forgot-password request" },
        { status: 400 }
      );
    }

    await connectDB();

    const email = normalizeAuthEmail(parsed.data.email);
    const user = await User.findOne({ email }).select("+passwordHash");
    // Allow password reset for any registered, non-suspended user. Google-only
    // accounts can use this flow to set a password without affecting their
    // existing Google sign-in (googleId stays intact).
    const canResetPassword = Boolean(
      user && user.accountStatus !== "suspended"
    );

    if (process.env.NODE_ENV !== "production") {
      console.info("[forgot-password] request", {
        email,
        userFound: Boolean(user),
        hasPasswordHash: Boolean(user?.passwordHash),
        googleId: user?.googleId,
        accountStatus: user?.accountStatus,
        canResetPassword,
      });
    }

    if (canResetPassword) {
      const delivery = await issuePasswordResetEmail(email);

      if (process.env.NODE_ENV !== "production") {
        console.info("[forgot-password] delivery", {
          email,
          delivered: delivery.delivered,
        });
      }

      return NextResponse.json(
        {
          success: true,
          debugUrl: delivery.debugUrl,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error creating password reset request:", error);
    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    );
  }
}