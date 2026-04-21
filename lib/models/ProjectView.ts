import mongoose, { Schema, Document, Model } from "mongoose"

export interface IProjectView extends Document {
  _id: mongoose.Types.ObjectId
  projectId: string
  viewerFingerprint: string
  windowKey: string
  createdAt: Date
}

const ProjectViewSchema = new Schema<IProjectView>(
  {
    projectId: {
      type: String,
      ref: "Project",
      required: true,
      index: true,
    },
    viewerFingerprint: {
      type: String,
      required: true,
      trim: true,
    },
    windowKey: {
      type: String,
      required: true,
      trim: true,
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

ProjectViewSchema.index({ projectId: 1, viewerFingerprint: 1, windowKey: 1 }, { unique: true })

const ProjectView: Model<IProjectView> =
  mongoose.models.ProjectView || mongoose.model<IProjectView>("ProjectView", ProjectViewSchema)

export default ProjectView
