import mongoose, { Schema, Document, Model } from "mongoose"
import {
  FEEDBACK_EMAIL_DELIVERY_STATUSES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type FeedbackEmailDeliveryStatus,
  type FeedbackStatus,
  type FeedbackType,
} from "@/lib/admin/feedback-types"

export interface IFeedback extends Document {
  _id: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  type: FeedbackType
  status: FeedbackStatus
  message: string
  pathname?: string
  adminNote: string
  responseMessage: string
  responseEmailStatus: FeedbackEmailDeliveryStatus
  responseEmailSentAt?: Date
  responseEmailError?: string
  responseEmailRecipient?: string
  metadata?: Record<string, unknown>
  readAt?: Date
  readBy?: mongoose.Types.ObjectId
  respondedAt?: Date
  respondedBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
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
      enum: FEEDBACK_TYPES,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: FEEDBACK_STATUSES,
      default: "new",
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    responseMessage: {
      type: String,
      trim: true,
      maxlength: 8000,
      default: "",
    },
    responseEmailStatus: {
      type: String,
      enum: FEEDBACK_EMAIL_DELIVERY_STATUSES,
      required: true,
      default: "not-requested",
    },
    responseEmailSentAt: {
      type: Date,
    },
    responseEmailError: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    responseEmailRecipient: {
      type: String,
      trim: true,
      maxlength: 320,
    },
    pathname: {
      type: String,
      trim: true,
      maxlength: 512,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    readAt: {
      type: Date,
    },
    readBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    respondedAt: {
      type: Date,
    },
    respondedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
)

FeedbackSchema.index({ userId: 1, createdAt: -1 })
FeedbackSchema.index({ type: 1, createdAt: -1 })
FeedbackSchema.index({ status: 1, createdAt: -1 })

const existingFeedbackModel = mongoose.models.Feedback as Model<IFeedback> | undefined

if (
  existingFeedbackModel &&
  (!existingFeedbackModel.schema.path("status") ||
    !existingFeedbackModel.schema.path("readAt") ||
    !existingFeedbackModel.schema.path("respondedAt") ||
    !existingFeedbackModel.schema.path("adminNote") ||
    !existingFeedbackModel.schema.path("responseEmailStatus"))
) {
  delete mongoose.models.Feedback
  delete mongoose.connection.models.Feedback
}

const Feedback: Model<IFeedback> =
  (mongoose.models.Feedback as Model<IFeedback>) ||
  mongoose.model<IFeedback>("Feedback", FeedbackSchema)

export default Feedback
export type { FeedbackStatus, FeedbackType }
