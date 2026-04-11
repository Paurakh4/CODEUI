import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import connectDB from "./db";
import User from "./models/User";
import { getPublicModelCatalog } from "@/lib/admin/model-policies";
import { resolveAdminAccess } from "@/lib/admin/rbac";
import { authConfig } from "@/auth.config";
import { getMonthlyCreditsForTier, SubscriptionTier } from "./pricing";
import { createDefaultUserPreferences, normalizeUserPreferences } from "./user-preferences";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && profile) {
        try {
          await connectDB();
          const modelCatalog = await getPublicModelCatalog();
          const isRuntimeModelEnabled = (value: string) =>
            modelCatalog.models.some((model) => model.id === value);

          // Find or create user in MongoDB
          const existingUser = await User.findOne({
            googleId: profile.sub,
          });

          if (!existingUser) {
            const adminAccess = resolveAdminAccess({ email: user.email });
            // Calculate initial credits and reset date
            const initialCredits = getMonthlyCreditsForTier("free");
            const nextResetDate = new Date();
            nextResetDate.setMonth(nextResetDate.getMonth() + 1);
            nextResetDate.setDate(1);

            // Create new user on first sign in
            const newUser = await User.create({
              email: user.email!,
              name: user.name!,
              image: user.image || undefined,
              googleId: profile.sub!,
              preferences: createDefaultUserPreferences({
                defaultModel: modelCatalog.defaultModelId,
              }),
              role: adminAccess.role,
              accountStatus: adminAccess.accountStatus,
              permissionOverrides: [],
              subscription: {
                tier: "free",
              },
              // New credit system
              monthlyCredits: initialCredits,
              topupCredits: 20,
              creditsResetDate: nextResetDate,
              totalCreditsUsed: 0,
              // Legacy fields (backwards compatibility)
              credits: initialCredits,
              creditsUsedThisMonth: 0,
            });
            // Use MongoDB _id as the user id
            user.id = newUser._id.toString();
          } else {
            const adminAccess = resolveAdminAccess({
              email: existingUser.email || user.email,
              role: existingUser.role,
              accountStatus: existingUser.accountStatus,
              permissionOverrides: existingUser.permissionOverrides,
            });
            // Update existing user info (name/image might change)
            existingUser.name = user.name || existingUser.name;
            existingUser.image = user.image || existingUser.image;
            existingUser.preferences = normalizeUserPreferences(existingUser.preferences, {
              defaultModel: modelCatalog.defaultModelId,
              isModelEnabled: isRuntimeModelEnabled,
            });
            existingUser.role = adminAccess.role;
            existingUser.accountStatus = adminAccess.accountStatus;
            existingUser.permissionOverrides = Array.isArray(existingUser.permissionOverrides)
              ? existingUser.permissionOverrides
              : [];
            await existingUser.save();
            user.id = existingUser._id.toString();
          }

          return true;
        } catch (error) {
          console.error("Error syncing user to MongoDB:", error);
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // On initial sign in, user object is available
      if (account && user) {
        token.id = user.id;
        token.accessToken = account.access_token;
      }

      // Refresh user data from DB periodically or on update trigger
      if (
        trigger === "update" ||
        (token.id && (!token.subscription || !token.role || !Array.isArray(token.permissions)))
      ) {
        try {
          await connectDB();
          const dbUser = await User.findById(token.id);
          if (dbUser) {
            const adminAccess = resolveAdminAccess({
              email: dbUser.email,
              role: dbUser.role,
              accountStatus: dbUser.accountStatus,
              permissionOverrides: dbUser.permissionOverrides,
            });
            token.name = dbUser.name;
            token.email = dbUser.email;
            token.picture = dbUser.image;
            token.subscription = dbUser.subscription.tier as SubscriptionTier;
            token.role = adminAccess.role;
            token.accountStatus = adminAccess.accountStatus;
            token.permissions = adminAccess.permissions;
            // New credit fields
            token.monthlyCredits = dbUser.monthlyCredits ?? 0;
            token.topupCredits = dbUser.topupCredits ?? 0;
            token.totalCredits =
              (dbUser.monthlyCredits ?? 0) + (dbUser.topupCredits ?? 0);
            // Legacy field
            token.credits = dbUser.credits ?? dbUser.monthlyCredits ?? 0;
          }
        } catch (error) {
          console.error("Error fetching user data for JWT:", error);
        }
      }

      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        if (typeof token.name === "string") {
          session.user.name = token.name;
        }
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        if (typeof token.picture === "string") {
          session.user.image = token.picture;
        }
        // Add subscription info to session
        (session.user as any).subscription =
          token.subscription;
        (session.user as any).role = token.role;
        (session.user as any).accountStatus = token.accountStatus;
        (session.user as any).permissions = token.permissions;
        // New credit fields
        (session.user as any).monthlyCredits =
          token.monthlyCredits;
        (session.user as any).topupCredits =
          token.topupCredits;
        (session.user as any).totalCredits =
          token.totalCredits;
        // Legacy field
        (session.user as any).credits = token.credits;
      }
      return session;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
});
