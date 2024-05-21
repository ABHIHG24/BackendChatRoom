import mongoose, { Schema, model } from "mongoose";
import { hash } from "bcrypt";
import validator from "email-validator";
import crypto from "crypto";

const schema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: validator.validate,
        message: "Email address is not valid",
      },
    },
    bio: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    avatar: {
      public_id: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetTokenExpried: Date,
    // verified: {
    //   type: Boolean,
    //   default: false,
    // },
  },
  {
    timestamps: true,
  }
);

schema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await hash(this.password, 10);
});

schema.methods.isPasswordChanged = async function (jwttime) {
  if (this.passwordChangedAt) {
    const passwordchangetime = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return jwttime < passwordchangetime;
  }
  return false;
};

schema.methods.createResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  const passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetTokenExpried = Date.now() + 10 * 60 * 1000;
  return { passwordResetToken, resetToken };
};

export const User = mongoose.models.User || model("User", schema);
