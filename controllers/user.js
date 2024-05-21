import { compare } from "bcrypt";
import { NEW_REQUEST, REFETCH_CHATS } from "../constants/events.js";
import { getOtherMember } from "../lib/helper.js";
import { TryCatch } from "../middlewares/error.js";
import { Chat } from "../models/chat.js";
import { Request } from "../models/request.js";
import { User } from "../models/user.js";
import { OTPAuth } from "../models/OTPAuth.js";
import crypto from "crypto";
import {
  Email,
  cookieOptions,
  emitEvent,
  sendOTPVerification,
  sendToken,
  uploadFilesToCloudinary,
} from "../utils/features.js";
import { ErrorHandler } from "../utils/utility.js";
import { CHATROOM_TOKEN } from "../constants/config.js";

const newUser = TryCatch(async (req, res, next) => {
  const { name, username, password, bio, email } = req.body;

  const file = req.file;

  if (!file) return next(new ErrorHandler("Please Upload Avatar"));

  const result = await uploadFilesToCloudinary([file]);

  const avatar = {
    public_id: result[0].public_id,
    url: result[0].url,
  };

  const user = await User.create({
    name,
    bio,
    username,
    password,
    avatar,
    email,
  });
  // sendOTPVerification(user.email, user._id, res);

  sendToken(res, user, 201, "User created");
});

const login = TryCatch(async (req, res, next) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username }).select("+password");

  if (!user) return next(new ErrorHandler("Invalid Username or Password", 404));

  // if (!user.verified)
  //   return next(new ErrorHandler(" Please verified Your email", 401));

  const isMatch = await compare(password, user.password);

  if (!isMatch)
    return next(new ErrorHandler("Invalid Username or Password", 404));

  sendToken(res, user, 200, `Welcome Back, ${user.name}`);
});

const getMyProfile = TryCatch(async (req, res, next) => {
  const user = await User.findById(req.user);

  if (!user) return next(new ErrorHandler("User not found", 404));

  res.status(200).json({
    success: true,
    user,
  });
});

const logout = TryCatch(async (req, res) => {
  return res
    .status(200)
    .cookie(CHATROOM_TOKEN, "", { ...cookieOptions, maxAge: 0 })
    .json({
      success: true,
      message: "Logged out successfully",
    });
});

// const searchUser = TryCatch(async (req, res) => {
//   const { name = "" } = req.query;

//   // Finding All my chats
//   const myChats = await Chat.find({ groupChat: false, members: req.user });

//   //  extracting All Users from my chats means friends or people I have chatted with
//   const allUsersFromMyChats = myChats.flatMap((chat) => chat.members);

//   // Finding all users except me and my friends
//   const allUsersExceptMeAndFriends = await User.find({
//     _id: { $nin: allUsersFromMyChats },
//     name: { $regex: name, $options: "i" },
//   });

//   // Modifying the response
//   const users = allUsersExceptMeAndFriends.map(({ _id, name, avatar }) => ({
//     _id,
//     name,
//     avatar: avatar.url,
//   }));

//   return res.status(200).json({
//     success: true,
//     users,
//   });
// });

const searchUser = TryCatch(async (req, res) => {
  const { name = "" } = req.query;

  // Finding All my chats
  const myChats = await Chat.find({ groupChat: false, members: req.user });

  // Extracting All Users from my chats means friends or people I have chatted with
  const allUsersFromMyChats = myChats.flatMap((chat) => chat.members);

  // Add the current user's ID to the list of users to exclude
  const usersToExclude = [...allUsersFromMyChats, req.user];

  // Finding all users except me and my friends
  const allUsersExceptMeAndFriends = await User.find({
    _id: { $nin: usersToExclude },
    name: { $regex: name, $options: "i" },
  });

  // Modifying the response
  const users = allUsersExceptMeAndFriends.map(({ _id, name, avatar }) => ({
    _id,
    name,
    avatar: avatar.url,
  }));

  return res.status(200).json({
    success: true,
    users,
  });
});

const sendFriendRequest = TryCatch(async (req, res, next) => {
  const { userId } = req.body;

  const request = await Request.findOne({
    $or: [
      { sender: req.user, receiver: userId },
      { sender: userId, receiver: req.user },
    ],
  });

  if (request) return next(new ErrorHandler("Request already sent", 400));

  await Request.create({
    sender: req.user,
    receiver: userId,
  });

  emitEvent(req, NEW_REQUEST, [userId]);

  return res.status(200).json({
    success: true,
    message: "Friend Request Sent",
  });
});

const acceptFriendRequest = TryCatch(async (req, res, next) => {
  const { requestId, accept } = req.body;

  const request = await Request.findById(requestId)
    .populate("sender", "name")
    .populate("receiver", "name");

  if (!request) return next(new ErrorHandler("Request not found", 404));

  if (request.receiver._id.toString() !== req.user.toString())
    return next(
      new ErrorHandler("You are not authorized to accept this request", 401)
    );

  if (!accept) {
    await request.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Friend Request Rejected",
    });
  }

  const members = [request.sender._id, request.receiver._id];

  await Promise.all([
    Chat.create({
      members,
      name: `${request.sender.name}-${request.receiver.name}`,
    }),
    request.deleteOne(),
  ]);

  emitEvent(req, REFETCH_CHATS, members);

  return res.status(200).json({
    success: true,
    message: "Friend Request Accepted",
    senderId: request.sender._id,
  });
});

const getMyNotifications = TryCatch(async (req, res) => {
  const requests = await Request.find({ receiver: req.user }).populate(
    "sender",
    "name avatar"
  );

  const allRequests = requests.map(({ _id, sender }) => ({
    _id,
    sender: {
      _id: sender._id,
      name: sender.name,
      avatar: sender.avatar.url,
    },
  }));

  return res.status(200).json({
    success: true,
    allRequests,
  });
});

const getMyFriends = TryCatch(async (req, res) => {
  const chatId = req.query.chatId;

  const chats = await Chat.find({
    members: req.user,
    groupChat: false,
  }).populate("members", "name avatar");

  const friends = chats.map(({ members }) => {
    const otherUser = getOtherMember(members, req.user);

    return {
      _id: otherUser._id,
      name: otherUser.name,
      avatar: otherUser.avatar.url,
    };
  });

  if (chatId) {
    const chat = await Chat.findById(chatId);

    const availableFriends = friends.filter(
      (friend) => !chat.members.includes(friend._id)
    );

    return res.status(200).json({
      success: true,
      friends: availableFriends,
    });
  } else {
    return res.status(200).json({
      success: true,
      friends,
    });
  }
});

const forgetPassword = async (req, res, next) => {
  try {
    const foundUser = await User.findOne({ email: req.body.email });

    if (!foundUser) {
      console.log("User does not exist");
      return res
        .status(404)
        .json({ message: "User not found with the given email" });
    }

    const token = foundUser.createResetPasswordToken();
    foundUser.passwordResetTokenExpried = Date.now() + 10 * 60 * 1000;
    foundUser.passwordResetToken = token.passwordResetToken;
    await foundUser.save({ validateBeforeSave: false });

    const resetUrl = `${req.protocol}://${req.hostname}:5173/reset-password/${token.resetToken}`;

    const message = `Please reset your password using the link below:\n${resetUrl}\nThis reset link is valid for 10 minutes.`;

    await Email(foundUser.email, "Password Change Request Received", message);

    // await sendEmail({
    //   to: foundUser.email,
    //   subject: "Password Change Request Received",
    //   text: message,
    // });

    return res
      .status(200)
      .json({ status: "success", message: "Email sent successfully", token });
  } catch (err) {
    console.error("Error while sending email:", err);
    return res.status(500).json({ message: "Error while sending email" });
  }
};

const passwordReset = async (req, res, next) => {
  try {
    const token = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");
    console.log(req.params.token);

    console.log(token);

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetTokenExpried: { $gt: Date.now() },
    });
    // console.log(user);

    if (!user) {
      console.log("Token is invalid or expired");
      return res.status(400).json({ message: "Token is invalid or expired" });
    }

    user.password = req.body.password;
    // user.repassword = req.body.repassword;
    user.passwordResetToken = undefined;
    user.passwordResetTokenExpried = undefined;
    user.passwordChangedAt = Date.now();
    await user.save();

    // console.log("Password reset successful");
    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("An error occurred:", error);
    res
      .status(500)
      .json({ message: "An error occurred during password reset" });
  }
};

const updateUserPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user).select("+password");

    const isPasswordMatched = await compare(
      req.body.oldPassword,
      user.password
    );

    if (!isPasswordMatched) {
      return res
        .status(400)
        .json({ success: false, error: "Old password is incorrect" });
    }

    if (req.body.newPassword !== req.body.confirmPassword) {
      return res
        .status(400)
        .json({ success: false, error: "Password does not match" });
    }

    user.password = req.body.newPassword;

    await user.save();
    res
      .status(200)
      .json({ success: false, message: "Password change sucessfull" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};
const updateProfile = TryCatch(async (req, res, next) => {
  const { name, username, bio, email } = req.body;

  const file = req.file;

  if (!file) return next(new ErrorHandler("Please Upload Avatar"));

  const result = await uploadFilesToCloudinary([file]);

  const avatar = {
    public_id: result[0].public_id,
    url: result[0].url,
  };

  const newUserData = {
    name,
    bio,
    username,
    avatar,
    email,
  };

  const user = await User.findByIdAndUpdate(req.user, newUserData, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  res.status(200).json({ success: true, user });
});

const verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res
        .status(400)
        .json({ message: "Empty OTP details are not allowed" });
    }

    const userOTPVerificationRecords = await OTPAuth.find({ userId });

    if (userOTPVerificationRecords.length <= 0) {
      return res.status(400).json({
        message:
          "Account record doesn't exist or has been verified already. Please sign up or log in",
      });
    }

    const { expiresAt, otp: hashedOTP } = userOTPVerificationRecords[0];

    if (expiresAt < Date.now()) {
      await OTPAuth.deleteMany({ userId });
      return res
        .status(400)
        .json({ message: "OTP is invalid or expired. Please try again" });
    }

    const validOTP = await compare(otp, hashedOTP);

    if (!validOTP) {
      return res.status(400).json({ message: "Code is invalid or expired" });
    }

    await User.updateOne({ _id: userId }, { verified: true });
    await OTPAuth.deleteMany({ userId });

    res.json({
      status: "VERIFIED",
      message: "User email verified successfully",
    });
  } catch (error) {
    res.json({
      status: "FAILED",
      message: error.message,
    });
  }
};

// const resendOTP = async (req, res) => {
//   try {
//     const { userId, email } = req.body;
//     if (!userId || !email) {
//       return res.status(400).json({ message: "Empty details are not allowed" });
//     }
//     await OTPAuth.deleteMany({ userId });
//     sendOTPVerification({ _id: userId, email });
//   } catch (error) {
//     res.json({
//       status: "FAILED",
//       message: error.message,
//     });
//   }
// };

export {
  acceptFriendRequest,
  getMyFriends,
  getMyNotifications,
  getMyProfile,
  login,
  logout,
  newUser,
  searchUser,
  sendFriendRequest,
  forgetPassword,
  updateUserPassword,
  passwordReset,
  updateProfile,
  verifyOTP,
};
