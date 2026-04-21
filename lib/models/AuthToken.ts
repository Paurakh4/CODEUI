import mongoose, { Schema, Document, Model } from "mongoose";

export const AUTH_TOKEN_TYPES = [
  "email-verification",
  "password-reset",
] as const;

export type AuthTokenType = (typeof AUTH_TOKEN_TYPES)[number];

export interface IAuthToken extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  type: AuthTokenType;
  tokenHash: string;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AuthTokenSchema = new Schema<IAuthToken>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: [...AUTH_TOKEN_TYPES],
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuthTokenSchema.index({ email: 1, type: 1, createdAt: -1 });

const existingAuthTokenModel =
  mongoose.models.AuthToken as Model<IAuthToken> | undefined;

if (existingAuthTokenModel && !existingAuthTokenModel.schema.path("consumedAt")) {
  delete mongoose.models.AuthToken;
  delete mongoose.connection.models.AuthToken;
}

const AuthToken: Model<IAuthToken> =
  (mongoose.models.AuthToken as Model<IAuthToken>) ||
  mongoose.model<IAuthToken>("AuthToken", AuthTokenSchema);

export default AuthToken;