import { Router } from "express";
import isAuth from "../middlewares/isAuth.js";
import { upload } from "../middlewares/multer.js";
import {
  analyzeResume,
  finishInterview,
  generateQuestion,
  submitAnswer,
  getHistory,
  getMyInterviews,
  getInterviewReport,
} from "../controllers/interview.controller.js";

const interviewRouter = Router();

interviewRouter.route("/resume").post(isAuth, upload.single("resume"), analyzeResume);
interviewRouter.route("/generate-questions").post(isAuth, generateQuestion);
interviewRouter.route("/submit-answer").post(isAuth, submitAnswer);
interviewRouter.route("/finish").post(isAuth, finishInterview);
interviewRouter.route("/history").get(isAuth, getHistory);

interviewRouter.get("/get-interview", isAuth, getMyInterviews);
interviewRouter.get("/report/:id", isAuth, getInterviewReport);

export default interviewRouter;
