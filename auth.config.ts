import type { NextAuthConfig } from "next-auth";
import { resolveAccountStatus } from "@/lib/admin/rbac";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");
      const isActiveAccount = resolveAccountStatus(auth?.user?.accountStatus) === "active";
      
      if (isOnAdmin) {
        return true; // Defer all admin auth decisions to the server-side admin layout
      }

      if (isOnDashboard) {
        if (isLoggedIn && isActiveAccount) return true;
        return false; // Redirect unauthenticated users to login page
      } 
      
      return true;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
