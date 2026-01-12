import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  image?: string;
  googleId: string;

  // Subscription info
  subscription: {
    tier: "free" | "pro" | "enterprise";
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    currentPeriodEnd?: Date;
  };

  // Usage tracking
  credits: number;
  creditsUsedThisMonth: number;

  createdAt: Date;
  updatedAt: Date;
}

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
    subscription: {
      tier: {
        type: String,
        enum: ["free", "pro", "enterprise"],
        default: "free",
      },
      stripeCustomerId: String,
      stripeSubscriptionId: String,
      stripePriceId: String,
      currentPeriodEnd: Date,
    },
    credits: {
      type: Number,
      default: 10, // Free tier starts with 10 credits
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
UserSchema.index({ email: 1 });
UserSchema.index({ googleId: 1 });
UserSchema.index({ "subscription.stripeCustomerId": 1 });

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
