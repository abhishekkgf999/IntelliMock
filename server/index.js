import dotenv from "dotenv";
import app from "./app.js";

dotenv.config({ path: "./.env" });

app.listen(process.env.PORT, ()=>{
    console.log(`Server is connected on PORT ${process.env.PORT}`);
})