import mongoose, { Document, Model, Schema, Types } from "mongoose"

export interface IUserApiKeyModel {
  id: string
  name: string
  contextLength: number | null
}

export interface IUserApiKey extends Document<string> {
  _id: string
  userId: Types.ObjectId
  name: string
  baseUrl: string
  apiKeyEncrypted: string
  apiKeyIv: string
  models: IUserApiKeyModel[]
  createdAt: Date
  updatedAt: Date
}

const ByokModelSchema = new Schema<IUserApiKeyModel>(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    contextLength: { type: Number, default: null },
  },
  { _id: false },
)

const UserApiKeySchema = new Schema<IUserApiKey>(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
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
      maxlength: 80,
    },
    baseUrl: {
      type: String,
      required: true,
      trim: true,
    },
    apiKeyEncrypted: {
      type: String,
      required: true,
    },
    apiKeyIv: {
      type: String,
      required: true,
    },
    models: {
      type: [ByokModelSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
)

UserApiKeySchema.index({ userId: 1, createdAt: 1 })

const UserApiKey: Model<IUserApiKey> =
  (mongoose.models.UserApiKey as Model<IUserApiKey> | undefined) ||
  mongoose.model<IUserApiKey>("UserApiKey", UserApiKeySchema)

export default UserApiKey
