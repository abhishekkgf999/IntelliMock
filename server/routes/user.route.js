import { Router } from "express";
import isAuth from "../middlewares/isAuth.js";
import { getCurrentUser } from "../controllers/user.controller.js";

const userRouter = Router();

userRouter.route("/current-user").get(isAuth, getCurrentUser);

export default userRouter;
