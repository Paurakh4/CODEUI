import mongoose, { Document, Model, Schema } from "mongoose"

export interface IAdminManagedModel {
  id: string
  name: string
  provider: string
  sourceProvider?: "openrouter" | "pxroute"
  description?: string
  contextLength: number
  supportsReasoning?: boolean
  isFast?: boolean
  isNewModel?: boolean
}

export interface IAdminModelConfig extends Document<string> {
  _id: string
  models: IAdminManagedModel[]
  enabledModelIds: string[]
  defaultModelId: string
  promptEnhanceModelId?: string
  updatedByUserId?: mongoose.Types.ObjectId
  updatedByEmail?: string
  createdAt: Date
  updatedAt: Date
}

const AdminManagedModelSchema = new Schema<IAdminManagedModel>(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    sourceProvider: {
      type: String,
      enum: ["openrouter", "pxroute"],
      default: "openrouter",
    },
    description: {
      type: String,
      trim: true,
    },
    contextLength: {
      type: Number,
      required: true,
      min: 1,
    },
    supportsReasoning: {
      type: Boolean,
      default: false,
    },
    isFast: {
      type: Boolean,
      default: false,
    },
    isNewModel: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  },
)

const AdminModelConfigSchema = new Schema<IAdminModelConfig>(
  {
    _id: {
      type: String,
      default: "global",
    },
    models: {
      type: [AdminManagedModelSchema],
      default: [],
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
    promptEnhanceModelId: {
      type: String,
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

const existingAdminModelConfig = mongoose.models.AdminModelConfig as Model<IAdminModelConfig> | undefined

function hasExpectedManagedModelPath(model: Model<IAdminModelConfig> | undefined) {
  const modelsPath = model?.schema.path("models") as { schema?: Schema<IAdminManagedModel> } | undefined
  return Boolean(modelsPath?.schema?.path("isNewModel") && modelsPath.schema.path("sourceProvider"))
}

if (existingAdminModelConfig && !hasExpectedManagedModelPath(existingAdminModelConfig)) {
  delete mongoose.models.AdminModelConfig
}

const AdminModelConfig: Model<IAdminModelConfig> =
  (mongoose.models.AdminModelConfig as Model<IAdminModelConfig> | undefined) ||
  mongoose.model<IAdminModelConfig>("AdminModelConfig", AdminModelConfigSchema)

export default AdminModelConfig
