import jwt from "jsonwebtoken";
import asyncHandler from "../utils/asyncHandler";
import ApiError from "../utils/ApiError";

const isAuth = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decodedToken.userId;

    next();
  } catch (error) {
    throw new ApiError(401, "Invalid or expired access token");
  }
});

export default isAuth;
