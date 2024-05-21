import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import { getBase64, getSockets } from "../lib/helper.js";
import { CHATROOM_TOKEN } from "../constants/config.js";
import { sendEmail } from "./email.js";
import bcrypt from "bcrypt";
import { OTPAuth } from "../models/OTPAuth.js";

const cookieOptions = {
  expires: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  // sameSite: "none",
  httpOnly: true,
  // secure: true,
};

const connectDB = (uri) => {
  mongoose
    .connect(uri, { dbName: "ChatRoom" })
    .then((data) => console.log(`Connected to DB: ${data.connection.host}`))
    .catch((err) => {
      throw err;
    });
};

const sendToken = (res, user, code, message) => {
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

  return res.status(code).cookie(CHATROOM_TOKEN, token, cookieOptions).json({
    success: true,
    user,
    message,
  });
};

const emitEvent = (req, event, users, data) => {
  const io = req.app.get("io");
  const usersSocket = getSockets(users);
  io.to(usersSocket).emit(event, data);
};

const uploadFilesToCloudinary = async (files = []) => {
  const uploadPromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        getBase64(file),
        {
          resource_type: "auto",
          public_id: uuid(),
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
    });
  });

  try {
    const results = await Promise.all(uploadPromises);

    const formattedResults = results.map((result) => ({
      public_id: result.public_id,
      url: result.secure_url,
    }));
    return formattedResults;
  } catch (err) {
    console.log(err);
    throw new Error("Error uploading files to cloudinary", err);
  }
};

const deletFilesFromCloudinary = async (public_ids) => {
  // Delete files from cloudinary
};

const Email = async (email, subject, data) => {
  await sendEmail({
    to: email,
    subject: subject,
    text: data,
  });
};

const sendOTPVerification = async (email, _id, res) => {
  try {
    const OTPNumber = `${Math.floor(1000 + Math.random() * 9000)}`;

    const text = `Enter ${OTPNumber} in the app to verify you email and address and complete the Registration. This code expires in 1 hour in \n http://localhost:5173/verify-otp/${_id}`;

    const hashedOTP = await bcrypt.hash(OTPNumber, 10);
    const otpAuthInstance = new OTPAuth({
      userId: _id,
      otp: hashedOTP,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    await Email(email, "Verify Your Email", text);
    await otpAuthInstance.save();
    res.json({
      status: "PENDING",
      message: "Verification otp email sent",
      data: {
        userId: _id,
        email,
      },
    });
  } catch (err) {
    res.json({
      status: "FAILED",
      message: err.message,
    });
  }
};

export {
  connectDB,
  sendToken,
  cookieOptions,
  emitEvent,
  deletFilesFromCloudinary,
  uploadFilesToCloudinary,
  Email,
  sendOTPVerification,
};
