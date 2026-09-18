import dotenv from "dotenv";
import app from "./app.js";
import connectDb from "./config/connectDb.js";

dotenv.config({ path: "./.env" });

connectDb()
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`Server is running at port: ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB Connection FAILED: ", error);
  });