import mongoose, { Schema, Document, Model } from "mongoose"

export type FeedbackType = "bug" | "feature" | "general"

export interface IFeedback extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  type: FeedbackType
  message: string
  pathname?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["bug", "feature", "general"],
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    pathname: {
      type: String,
      trim: true,
      maxlength: 512,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
)

FeedbackSchema.index({ userId: 1, createdAt: -1 })
FeedbackSchema.index({ type: 1, createdAt: -1 })

const Feedback: Model<IFeedback> =
  mongoose.models.Feedback || mongoose.model<IFeedback>("Feedback", FeedbackSchema)

export default Feedback
