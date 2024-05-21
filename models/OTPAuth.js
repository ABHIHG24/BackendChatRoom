import mongoose, { Schema, model } from "mongoose";

const schema = new Schema({
  userId: {
    type: String,
  },
  otp: String,
  createdAt: Date,
  expireAt: Date,
});

export const OTPAuth = mongoose.models.OTPAuth || model("OTPAuth", schema);
