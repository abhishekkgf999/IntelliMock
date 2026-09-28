import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import User from "../models/user.model.js";
import genToken from "../config/token.js";
import ApiResponse from "../utils/apiResponse.js";

const GoogleAuth = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    throw new ApiError(400, "Username or Email is required");
  }

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      name,
      email,
    });
  }

  const token = await genToken(user._id);

  if (!token) {
    throw new ApiError(500, "");
  }

  const options = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  return res
    .status(200)
    .cookie("token", token, options)
    .json(new ApiResponse(200, { user }, "Google Authentication successful"));
});

const logOut = asyncHandler(async (req, res) => {
  const options = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  };

  res.clearCookie("token", options);

  return res.status(200).json(new ApiResponse(200, {}, "Logout successfully"));
});

export { GoogleAuth, logOut };
