import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import connectDB from "./db";
import User from "./models/User";
import { authConfig } from "@/auth.config";
import { getMonthlyCreditsForTier, SubscriptionTier } from "./pricing";

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

          // Find or create user in MongoDB
          const existingUser = await User.findOne({
            googleId: profile.sub,
          });

          if (!existingUser) {
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
            // Update existing user info (name/image might change)
            existingUser.name = user.name || existingUser.name;
            existingUser.image = user.image || existingUser.image;
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
      if (trigger === "update" || (token.id && !token.subscription)) {
        try {
          await connectDB();
          const dbUser = await User.findById(token.id);
          if (dbUser) {
            token.subscription = dbUser.subscription.tier as SubscriptionTier;
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
        // Add subscription info to session
        (session.user as any).subscription =
          token.subscription;
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
