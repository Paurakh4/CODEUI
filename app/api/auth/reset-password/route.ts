import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeAuthActionToken } from "@/lib/auth-email";
import connectDB from "@/lib/db";
import { hashPassword, normalizeAuthEmail } from "@/lib/local-auth";
import User from "@/lib/models/User";

const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1),
    password: z.string().min(8).max(72),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid password reset request" },
        { status: 400 }
      );
    }

    const record = await consumeAuthActionToken({
      token: parsed.data.token,
      type: "password-reset",
    });

    if (!record) {
      return NextResponse.json(
        { error: "This password reset link is invalid or expired." },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({
      email: normalizeAuthEmail(record.email),
    }).select("+passwordHash");

    if (!user) {
      return NextResponse.json(
        { error: "This password reset link is invalid or expired." },
        { status: 400 }
      );
    }

    user.passwordHash = await hashPassword(parsed.data.password);
    await user.save();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    );
  }
}