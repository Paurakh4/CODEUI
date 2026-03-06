import mongoose, { Document, Model, Schema } from "mongoose";

export type MediaKind = "image" | "video" | "audio";

export interface IMediaAsset extends Omit<Document, "_id"> {
  _id: string;
  userId: mongoose.Types.ObjectId;
  projectId: string;
  kind: MediaKind;
  originalName: string;
  mimeType: string;
  size: number;
  fileName: string;
  url: string;
  storagePath: string;
  createdAt: Date;
  updatedAt: Date;
}

const MediaAssetSchema = new Schema<IMediaAsset>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["image", "video", "audio"],
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    storagePath: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

MediaAssetSchema.index({ userId: 1, projectId: 1, createdAt: -1 });
MediaAssetSchema.index({ userId: 1, projectId: 1, kind: 1, createdAt: -1 });

const MediaAsset: Model<IMediaAsset> =
  mongoose.models.MediaAsset ||
  mongoose.model<IMediaAsset>("MediaAsset", MediaAssetSchema);

export default MediaAsset;
