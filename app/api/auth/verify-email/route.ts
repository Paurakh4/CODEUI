import { NextResponse } from "next/server";
import { consumeAuthActionToken } from "@/lib/auth-email";
import connectDB from "@/lib/db";
import { normalizeAuthEmail } from "@/lib/local-auth";
import User from "@/lib/models/User";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json(
        { error: "Missing email verification token." },
        { status: 400 }
      );
    }

    const record = await consumeAuthActionToken({
      token,
      type: "email-verification",
    });

    if (!record) {
      return NextResponse.json(
        { error: "This email verification link is invalid or expired." },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({
      email: normalizeAuthEmail(record.email),
    });

    if (!user) {
      return NextResponse.json(
        { error: "This email verification link is invalid or expired." },
        { status: 400 }
      );
    }

    user.emailVerifiedAt = new Date();
    await user.save();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error verifying email:", error);
    return NextResponse.json(
      { error: "Failed to verify email" },
      { status: 500 }
    );
  }
}