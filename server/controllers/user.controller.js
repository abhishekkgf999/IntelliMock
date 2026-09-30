import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    throw new ApiError(401, "Unauthorized request");
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User does not exists");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User fetched successfully"));
});

export { getCurrentUser };
