import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      subscription?: "free" | "pro" | "proplus";
      // New credit system fields
      monthlyCredits?: number;
      topupCredits?: number;
      totalCredits?: number;
      // Legacy field (backwards compatibility)
      credits?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
    subscription?: "free" | "pro" | "proplus";
    // New credit system fields
    monthlyCredits?: number;
    topupCredits?: number;
    totalCredits?: number;
    // Legacy field (backwards compatibility)
    credits?: number;
  }
}
