import { Router } from "express";
import { GoogleAuth, logOut } from "../controllers/auth.controller.js";

const authRouter = Router();

authRouter.route("/google").post(GoogleAuth);
authRouter.route("/logout").get(logOut);

export default authRouter;
