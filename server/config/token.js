import jwt from "jsonwebtoken";

const genToken = (userId) => {
  try {
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY,
    });

    return token;
  } catch (error) {
    console.error("Token generation error: ", error);
    throw new Error("Could not generate token");
  }
};

export default genToken;
