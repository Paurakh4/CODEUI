import NextAuth from "next-auth";
import { z } from "zod";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import connectDB from "./db";
import User from "./models/User";
import { getPublicModelCatalog } from "@/lib/admin/model-policies";
import { resolveAdminAccess } from "@/lib/admin/rbac";
import { authConfig } from "@/auth.config";
import { SubscriptionTier } from "./pricing";
import {
  buildUserCreationInput,
  normalizeAuthEmail,
  verifyPassword,
} from "./local-auth";
import { normalizeUserPreferences } from "./user-preferences";

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsedCredentials = credentialsSchema.safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        try {
          await connectDB();

          const email = normalizeAuthEmail(parsedCredentials.data.email);
          const existingUser = await User.findOne({ email }).select(
            "+passwordHash"
          );

          if (!existingUser?.passwordHash) {
            return null;
          }

          if (existingUser.accountStatus === "suspended") {
            return null;
          }

          const isPasswordValid = await verifyPassword(
            parsedCredentials.data.password,
            existingUser.passwordHash
          );

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: existingUser._id.toString(),
            email: existingUser.email,
            name: existingUser.name,
            image: existingUser.image || undefined,
          };
        } catch (error) {
          console.error("Error authorizing credentials user:", error);
          return null;
        }
      },
    }),
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
          const normalizedEmail = normalizeAuthEmail(user.email || "");
          const googleId = typeof profile.sub === "string" ? profile.sub : null;

          if (!normalizedEmail || !googleId) {
            return false;
          }

          const existingUser = await User.findOne({
            $or: [{ googleId }, { email: normalizedEmail }],
          });

          if (!existingUser) {
            const newUser = await User.create({
              ...buildUserCreationInput({
                email: normalizedEmail,
                name: user.name,
                image: user.image,
                googleId,
                defaultModelId: modelCatalog.defaultModelId,
              }),
            });
            // Use MongoDB _id as the user id
            user.id = newUser._id.toString();
          } else {
            const adminAccess = resolveAdminAccess({
              email: existingUser.email || normalizedEmail,
              role: existingUser.role,
              accountStatus: existingUser.accountStatus,
              permissionOverrides: existingUser.permissionOverrides,
            });
            // Update existing user info (name/image might change)
            existingUser.email = normalizedEmail;
            existingUser.name = user.name || existingUser.name;
            existingUser.image = user.image || existingUser.image;
            existingUser.googleId = googleId;
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
        token.accessToken =
          typeof account.access_token === "string"
            ? account.access_token
            : undefined;
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
