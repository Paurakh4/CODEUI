import mongoose, { Schema, Document, Model } from "mongoose"

export interface IProjectLike extends Document {
  _id: mongoose.Types.ObjectId
  projectId: string
  userId: mongoose.Types.ObjectId
  createdAt: Date
}

const ProjectLikeSchema = new Schema<IProjectLike>(
  {
    projectId: {
      type: String,
      ref: "Project",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
)

ProjectLikeSchema.index({ projectId: 1, userId: 1 }, { unique: true })

const ProjectLike: Model<IProjectLike> =
  mongoose.models.ProjectLike || mongoose.model<IProjectLike>("ProjectLike", ProjectLikeSchema)

export default ProjectLike
