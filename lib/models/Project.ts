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

export interface IProject extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  emoji?: string;
  htmlContent: string;
  isPrivate: boolean;

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
    isPrivate: {
      type: Boolean,
      default: true,
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

// Index for public projects (for explore/discover features)
ProjectSchema.index({ isPrivate: 1, createdAt: -1 });

const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>("Project", ProjectSchema);

export default Project;
