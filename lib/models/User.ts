import mongoose, { Schema, Document, Model } from "mongoose";
import {
  ACCOUNT_STATUSES,
  USER_ROLES,
  type AccountStatus,
  type AdminPermission,
  type UserRole,
} from "@/lib/admin/rbac";
import { SubscriptionTier } from "@/lib/pricing";
import {
  type UserPreferences,
  createDefaultUserPreferences,
} from "@/lib/user-preferences";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  image?: string;
  googleId: string;
  preferences: UserPreferences;
  role: UserRole;
  accountStatus: AccountStatus;
  permissionOverrides: AdminPermission[];
  adminNotes?: string;

  // Subscription info
  subscription: {
    tier: SubscriptionTier;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    currentPeriodEnd?: Date;
  };

  // Credit system
  monthlyCredits: number; // Credits from subscription (resets monthly)
  topupCredits: number; // Credits from one-time purchases (never expire)
  creditsResetDate: Date; // When monthly credits should reset
  totalCreditsUsed: number; // Lifetime usage tracking

  // Legacy fields (for backwards compatibility)
  credits?: number;
  creditsUsedThisMonth?: number;

  createdAt: Date;
  updatedAt: Date;
}

const ContactPreferencesSchema = new Schema(
  {
    productUpdates: {
      type: Boolean,
      default: true,
    },
    marketingEmails: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const PrivacyPreferencesSchema = new Schema(
  {
    privateProjectsByDefault: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const PreferencesSchema = new Schema(
  {
    theme: {
      type: String,
      enum: ["light", "dark"],
      default: "dark",
    },
    primaryColor: {
      type: String,
      default: "blue",
    },
    secondaryColor: {
      type: String,
      default: "slate",
    },
    defaultModel: {
      type: String,
      default: createDefaultUserPreferences().defaultModel,
    },
    enhancedPrompts: {
      type: Boolean,
      default: false,
    },
    contactPreferences: {
      type: ContactPreferencesSchema,
      default: () => createDefaultUserPreferences().contactPreferences,
    },
    privacyPreferences: {
      type: PrivacyPreferencesSchema,
      default: () => createDefaultUserPreferences().privacyPreferences,
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
    },
    googleId: {
      type: String,
      required: true,
      unique: true,
    },
    preferences: {
      type: PreferencesSchema,
      default: () => createDefaultUserPreferences(),
    },
    role: {
      type: String,
      enum: [...USER_ROLES],
      default: "user",
      index: true,
    },
    accountStatus: {
      type: String,
      enum: [...ACCOUNT_STATUSES],
      default: "active",
      index: true,
    },
    permissionOverrides: {
      type: [String],
      default: [],
    },
    adminNotes: {
      type: String,
      default: "",
      trim: true,
    },
    subscription: {
      tier: {
        type: String,
        enum: ["free", "pro", "proplus"],
        default: "free",
      },
      stripeCustomerId: String,
      stripeSubscriptionId: String,
      stripePriceId: String,
      currentPeriodEnd: Date,
    },
    monthlyCredits: {
      type: Number,
      default: 20, // Free tier starts with 20 credits
    },
    topupCredits: {
      type: Number,
      default: 20,
    },
    creditsResetDate: {
      type: Date,
      default: () => {
        // Set to first day of next month
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      },
    },
    totalCreditsUsed: {
      type: Number,
      default: 0,
    },
    // Legacy fields (backwards compatibility)
    credits: {
      type: Number,
      default: 20,
    },
    creditsUsedThisMonth: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
UserSchema.index({ "subscription.stripeCustomerId": 1 });
UserSchema.index({ role: 1, createdAt: -1 });
UserSchema.index({ accountStatus: 1, createdAt: -1 });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
