import mongoose, { Schema, Document, Model } from "mongoose";

// Message interface for chat history within a project
export interface IMessage {
  role: "user" | "assistant";
  content: string;
  thinkingContent?: string;
  createdAt: Date;
}

// Version interface for project history
export interface IVersion {
  htmlContent: string;
  description?: string;
  createdAt: Date;
}

export interface IProject extends Omit<Document, "_id"> {
  _id: string;
  userId: mongoose.Types.ObjectId;
  name: string;
  emoji?: string;
  htmlContent: string;
  latestCheckpointId?: mongoose.Types.ObjectId;
  checkpointCount: number;
  isPrivate: boolean;
  isFavorite: boolean;

  // Stats for dashboard display
  views: number;
  likes: number;

  // Version history (embedded)
  versions: IVersion[];

  // Chat messages (embedded, per-project persistence)
  messages: IMessage[];

  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    thinkingContent: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const VersionSchema = new Schema<IVersion>(
  {
    htmlContent: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true } // Keep _id for versions to reference them
);

const ProjectSchema = new Schema<IProject>(
  {
    _id: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      default: "Untitled Project",
    },
    emoji: {
      type: String,
      default: "🎨",
    },
    htmlContent: {
      type: String,
      default: "",
    },
    latestCheckpointId: {
      type: Schema.Types.ObjectId,
      ref: "Checkpoint",
    },
    checkpointCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isPrivate: {
      type: Boolean,
      default: true,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    versions: {
      type: [VersionSchema],
      default: [],
    },
    messages: {
      type: [MessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user's projects sorted by update time
ProjectSchema.index({ userId: 1, updatedAt: -1 });
ProjectSchema.index({ userId: 1, isFavorite: 1, updatedAt: -1 });

// Index for public projects (for explore/discover features)
ProjectSchema.index({ isPrivate: 1, createdAt: -1 });
ProjectSchema.index({ isPrivate: 1, updatedAt: -1 });
ProjectSchema.index({ isPrivate: 1, views: -1, updatedAt: -1 });
ProjectSchema.index({ isPrivate: 1, likes: -1, updatedAt: -1 });

const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>("Project", ProjectSchema);

export default Project;
