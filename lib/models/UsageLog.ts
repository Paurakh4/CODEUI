import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUsageLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userEmail: string;

  // Prompt details
  promptType: "initial" | "followup";
  aiModel: string; // Renamed from 'model' to avoid conflict with Mongoose Document
  creditsCost: number;

  // Credit breakdown
  creditsFromMonthly: number;
  creditsFromTopup: number;

  // Optional context
  projectId?: mongoose.Types.ObjectId;
  promptLength?: number;
  responseLength?: number;

  // Metadata
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

const UsageLogSchema = new Schema<IUsageLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },
    promptType: {
      type: String,
      enum: ["initial", "followup"],
      default: "initial",
    },
    aiModel: {
      type: String,
      required: true,
    },
    creditsCost: {
      type: Number,
      required: true,
      default: 1,
    },
    creditsFromMonthly: {
      type: Number,
      default: 0,
    },
    creditsFromTopup: {
      type: Number,
      default: 0,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
    },
    promptLength: {
      type: Number,
    },
    responseLength: {
      type: Number,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: false, // We use our own timestamp field
  }
);

// Compound indexes for common queries
UsageLogSchema.index({ userId: 1, timestamp: -1 });
UsageLogSchema.index({ userEmail: 1, timestamp: -1 });
UsageLogSchema.index({ timestamp: -1 });

// Index for monthly usage aggregation
UsageLogSchema.index({
  userId: 1,
  timestamp: 1,
});

const UsageLog: Model<IUsageLog> =
  mongoose.models.UsageLog ||
  mongoose.model<IUsageLog>("UsageLog", UsageLogSchema);

export default UsageLog;
