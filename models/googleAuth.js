import mongoose, { Schema, model } from "mongoose";

const schema = new Schema(
  {
    googleId: String,
    displayName: String,
    email: String,
    image: String,
    accessToken: String,
  },
  {
    timestamps: true,
  }
);

export const GoogleAuth =
  mongoose.models.GoogleAuth || model("GoogleAuth", schema);
