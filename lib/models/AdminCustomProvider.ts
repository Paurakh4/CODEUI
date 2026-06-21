import mongoose, { Document, Model, Schema } from "mongoose"

export interface IAdminCustomProvider extends Document<string> {
  _id: string
  name: string
  baseUrl: string
  apiKey: string
  createdAt: Date
  updatedAt: Date
}

const AdminCustomProviderSchema = new Schema<IAdminCustomProvider>(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    baseUrl: {
      type: String,
      required: true,
      trim: true,
    },
    // ponytail: stored plaintext. Ceiling: anyone with DB read access sees the
    // key. Upgrade path: AES-GCM with a KMS/env-derive key. Matches how env-var
    // keys are already handled, and the field is masked on every API read.
    apiKey: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
)

const AdminCustomProvider: Model<IAdminCustomProvider> =
  (mongoose.models.AdminCustomProvider as Model<IAdminCustomProvider> | undefined) ||
  mongoose.model<IAdminCustomProvider>("AdminCustomProvider", AdminCustomProviderSchema)

export default AdminCustomProvider
