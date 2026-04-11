import mongoose, { Document, Model, Schema } from "mongoose"

export interface IAdminModelConfig extends Document {
  _id: string
  enabledModelIds: string[]
  defaultModelId: string
  updatedByUserId?: mongoose.Types.ObjectId
  updatedByEmail?: string
  createdAt: Date
  updatedAt: Date
}

const AdminModelConfigSchema = new Schema<IAdminModelConfig>(
  {
    _id: {
      type: String,
      default: "global",
    },
    enabledModelIds: {
      type: [String],
      default: [],
    },
    defaultModelId: {
      type: String,
      required: true,
      trim: true,
    },
    updatedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedByEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  },
)

const AdminModelConfig: Model<IAdminModelConfig> =
  mongoose.models.AdminModelConfig ||
  mongoose.model<IAdminModelConfig>("AdminModelConfig", AdminModelConfigSchema)

export default AdminModelConfig