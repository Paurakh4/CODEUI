import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      subscription?: "free" | "pro" | "enterprise";
      credits?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
    subscription?: "free" | "pro" | "enterprise";
    credits?: number;
  }
}
