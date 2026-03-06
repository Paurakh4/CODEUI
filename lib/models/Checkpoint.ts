import mongoose, { Schema, Document, Model } from "mongoose";

export type CheckpointKind = "auto" | "manual" | "restore";
export type CheckpointTrigger =
  | "before-ai"
  | "after-ai"
  | "manual-save"
  | "restore";

export interface ICheckpoint extends Document {
  projectId: string;
  userId: mongoose.Types.ObjectId;
  seq: number;
  htmlContent: string;
  description?: string;
  kind: CheckpointKind;
  trigger: CheckpointTrigger;
  restoredFromId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CheckpointSchema = new Schema<ICheckpoint>(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    seq: {
      type: Number,
      required: true,
      min: 1,
    },
    htmlContent: {
      type: String,
      required: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
    },
    kind: {
      type: String,
      enum: ["auto", "manual", "restore"],
      default: "manual",
      required: true,
    },
    trigger: {
      type: String,
      enum: ["before-ai", "after-ai", "manual-save", "restore"],
      default: "manual-save",
      required: true,
    },
    restoredFromId: {
      type: Schema.Types.ObjectId,
      ref: "Checkpoint",
    },
  },
  {
    timestamps: true,
  }
);

CheckpointSchema.index({ projectId: 1, seq: 1 }, { unique: true });
CheckpointSchema.index({ projectId: 1, createdAt: -1 });

const Checkpoint: Model<ICheckpoint> =
  mongoose.models.Checkpoint ||
  mongoose.model<ICheckpoint>("Checkpoint", CheckpointSchema);

export default Checkpoint;
