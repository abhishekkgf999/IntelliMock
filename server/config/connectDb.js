import mongoose from "mongoose";

const connectDb = async () => {
  try {
    const connectionInstance = await mongoose.connect(process.env.MONGODB_URI);
    console.log(
      `\n MongoDB connected !! DB Host ${connectionInstance.connection.host}`,
    );
  } catch (error) {
    console.error("MongoDB Connection FAILED: ", error);
  }
};

export default connectDb;