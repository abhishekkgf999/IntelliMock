import fs from "fs";
import { askAi } from "../services/openRouter.service.js";
import User from "../models/user.model.js";
import Interview from "../models/interview.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { extractTextFromPdf } from "../utils/extractTextFromPdf.js";

const analyzeResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Resume required");
  }

  const filepath = req.file?.path;

  try {
    const fileBuffer = await fs.promises.readFile(filepath);
    const resumeText = await extractTextFromPdf(fileBuffer);

    if (!resumeText?.trim()) {
      throw new ApiError(400, "Unable to extract text from resume");
    }

    const message = [
      {
        role: "system",
        content: `Extract structured data from resume. Return strictly JSON:
          {
            "role": "string",
            "experience": "string",
            "projects": ["project1","project2"],
            "skills": ["skill1","skill2"]
          }`,
      },
      { role: "user", content: resumeText },
    ];

    const aiResponse = await askAi(message);
    let parsed;
    try {
      parsed = JSON.parse(aiResponse);
    } catch {
      const match = aiResponse.match(/\{[\s\S]*\}/);

      if (!match) {
        throw new ApiError(502, "AI returned an invalid response");
      }

      try {
        parsed = JSON.parse(match[0]);
      } catch {
        throw new ApiError(502, "AI returned invalid JSON");
      }
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ApiError(502, "AI returned an invalid data structure");
    }

    res.status(200).json(
      new ApiResponse(
        200,
        {
          role: typeof parsed.role === "string" ? parsed.role : "",
          experience:
            typeof parsed.experience === "string" ? parsed.experience : "",
          projects: Array.isArray(parsed.projects) ? parsed.projects : [],
          skills: Array.isArray(parsed.skills) ? parsed.skills : [],
          resumeText,
        },
        "Resume analyzed successfully",
      ),
    );
  } finally {
    await fs.promises.unlink(filepath).catch((error) => {
      console.error("Failed to delete temporary resume:", error.message);
    });
  }
});

const generateQuestion = asyncHandler(async (req, res) => {
  let { role, experience, mode, resumeText, projects, skills } = req.body;
  role = role?.trim();
  experience = experience?.trim();
  mode = mode?.trim();

  if (!role || !experience || !mode) {
    throw new ApiError(400, "Role, Experience and Mode are required.");
  }

  const user = await User.findById(req.userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.credits < 5) {
    throw new ApiError(403, "Not enough credits. Minimum 5 required.");
  }

  const projectText =
    Array.isArray(projects) && projects.length ? projects.join(", ") : "None";

  const skillsText =
    Array.isArray(skills) && skills.length ? skills.join(", ") : "None";

  const safeResume = resumeText?.trim() || "None";

  const messages = [
    {
      role: "system",
      content: `You are a real human interviewer. Generate exactly 5 interview questions.
        Rules:
        - Each question 15-25 words
        - One sentence per line
        - No numbering`,
    },
    {
      role: "user",
      content: `Role:${role}
                Experience:${experience}
                InterviewMode:${mode}
                Projects:${projectText}
                Skills:${skillsText}
                Resume:${safeResume}`,
    },
  ];

  const aiResponse = await askAi(messages);

  if (!aiResponse?.trim()) {
    throw new ApiError(502, "AI returned empty response.");
  }

  const questionsArray = aiResponse
    .split("\n")
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .map((q) => q.replace(/^\d+[\.\)]\s*/, ""))
    .filter((q) => q.length > 0)
    .slice(0, 5);

  if (questionsArray.length !== 5) {
    throw new ApiError(502, "AI failed to generate exactly 5 questions.");
  }

  const interview = await Interview.create({
    userId: user._id,
    role,
    experience,
    mode,
    resumeText: safeResume,
    questions: questionsArray.map((q, index) => ({
      question: q,
      difficulty: ["easy", "easy", "medium", "medium", "hard"][index],
      timeLimit: [60, 60, 90, 90, 120][index],
    })),
  });

  if (!interview) {
    throw new ApiError(500, "Failed to create interview");
  }

  user.credits -= 5;
  await user.save();

  res.status(200).json(
    new ApiResponse(
      200,
      {
        interviewId: interview._id,
        creditLeft: user.credits,
        userName: user.name,
        questions: interview.questions || [],
      },
      "Interview created successfully",
    ),
  );
});

const submitAnswer = asyncHandler(async (req, res) => {
  const { interviewId, questionIndex, answer, timeTaken } = req.body;

  if (!interviewId || !Number.isInteger(questionIndex) || questionIndex < 0) {
    throw new ApiError(
      400,
      "Valid interview ID and question index are required.",
    );
  }

  if (!Number.isFinite(timeTaken) || timeTaken < 0) {
    throw new ApiError(400, "Valid time taken is required.");
  }

  const interview = await Interview.findById(interviewId);

  if (!interview) {
    throw new ApiError(404, "Interview not found");
  }

  const questions = interview.questions || [];
  const question = questions[questionIndex];

  if (!question) {
    throw new ApiError(404, "Question not found");
  }

  if (typeof answer !== "string" || !answer.trim()) {
    question.score = 0;
    question.feedback = "You did not submit an answer";
    question.answer = "";
    await interview.save();
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { feedback: question.feedback },
          "Answer submitted successfully",
        ),
      );
  }

  if (timeTaken > question.timeLimit) {
    question.score = 0;
    question.feedback = "Time limit exceeded.";
    question.answer = answer;
    await interview.save();
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { feedback: question.feedback },
          "Answer submitted successfully",
        ),
      );
  }

  const messages = [
    {
      role: "system",
      content: `You are a professional human interviewer evaluating a candidate's answer in a real interview.

Evaluate naturally and fairly, like a real person would.

Score the answer in these areas (strictly from 0 to 10):
1. Confidence – Does the answer sound clear, confident, and well-presented? (0 to 10)
2. Communication – Is the language simple, clear, and easy to understand? (0 to 10)
3. Correctness – Is the answer accurate, relevant, and complete? (0 to 10)

Rules:
- Be realistic and unbiased.
- Do not give random high scores.
- If the answer is weak, score low.
- If the answer is strong and detailed, score high.
- Consider clarity, structure, and relevance.

Calculate:
finalScore = average of confidence, communication, and correctness (rounded to nearest whole number, strictly between 0 and 10).

Feedback Rules:
- Write natural human feedback.
- 10 to 15 words only.
- Sound like real interview feedback.
- Can suggest improvement if needed.
- Do NOT repeat the question.
- Do NOT explain scoring.
- Keep tone professional and honest.

Return ONLY valid JSON in this format:
{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalScore": number,
  "feedback": "short human feedback"
}

All scores must strictly be numbers between 0 and 10.`,
    },
    {
      role: "user",
      content: `Question: ${question.question}
Answer: ${answer.trim()}`,
    },
  ];

  const aiResponse = await askAi(messages);

  let parsed;

  try {
    parsed = JSON.parse(aiResponse);
  } catch {
    const match = aiResponse.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new ApiError(502, "AI returned an invalid evaluation response");
    }

    try {
      parsed = JSON.parse(match[0]);
    } catch {
      throw new ApiError(502, "AI returned invalid JSON");
    }
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !["confidence", "communication", "correctness", "finalScore"].every(
      (key) =>
        typeof parsed[key] === "number" &&
        Number.isFinite(parsed[key]) &&
        parsed[key] >= 0,
    ) ||
    typeof parsed.feedback !== "string" ||
    !parsed.feedback.trim()
  ) {
    throw new ApiError(502, "AI returned an invalid evaluation structure");
  }

  const clampScore = (val) => {
    let num = Number(val);
    if (!Number.isFinite(num) || num < 0) return 0;
    if (num > 10) num = num / 10;
    return Math.min(10, Math.max(0, Number(num.toFixed(1))));
  };

  question.answer = answer;
  question.confidence = clampScore(parsed.confidence);
  question.communication = clampScore(parsed.communication);
  question.correctness = clampScore(parsed.correctness);
  question.score = clampScore(parsed.finalScore);
  question.feedback = parsed.feedback;

  await interview.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { feedback: parsed.feedback },
        "Answer submitted successfully",
      ),
    );
});

const getHistory = asyncHandler(async (req, res) => {
  const interviews = await Interview.find({ userId: req.userId })
    .sort({ createdAt: -1 })
    .select("role experience mode finalScore status questions createdAt");

  return res
    .status(200)
    .json(new ApiResponse(200, { interviews }, "History fetched successfully"));
});

const finishInterview = asyncHandler(async (req, res) => {
  const { interviewId } = req.body;

  if (!interviewId) {
    throw new ApiError(400, "Interview ID is required");
  }

  const interview = await Interview.findById(interviewId);

  if (!interview) {
    throw new ApiError(400, "Failed to find Interview");
  }

  const questions = interview.questions || [];
  const totalQuestions = questions.length;

  const clampScore = (val) => {
    let num = Number(val);
    if (!Number.isFinite(num) || num < 0) return 0;
    if (num > 10) num = num / 10;
    return Math.min(10, Math.max(0, Number(num.toFixed(1))));
  };

  let totalScore = 0;
  let totalConfidence = 0;
  let totalCommunication = 0;
  let totalCorrectness = 0;

  questions.forEach((q) => {
    totalScore += clampScore(q.score);
    totalConfidence += clampScore(q.confidence);
    totalCommunication += clampScore(q.communication);
    totalCorrectness += clampScore(q.correctness);
  });

  const finalScore = totalQuestions ? totalScore / totalQuestions : 0;

  const avgConfidence = totalQuestions ? totalConfidence / totalQuestions : 0;

  const avgCommunication = totalQuestions
    ? totalCommunication / totalQuestions
    : 0;

  const avgCorrectness = totalQuestions ? totalCorrectness / totalQuestions : 0;

  interview.finalScore = Number(finalScore.toFixed(1));
  interview.status = "completed";
  
  await interview.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        finalScore: Number(finalScore.toFixed(1)),
        confidence: Number(avgConfidence.toFixed(1)),
        communication: Number(avgCommunication.toFixed(1)),
        correctness: Number(avgCorrectness.toFixed(1)),
        questionWiseScore: questions.map((q) => ({
          question: q.question,
          score: clampScore(q.score),
          feedback: q.feedback || "",
          confidence: clampScore(q.confidence),
          communication: clampScore(q.communication),
          correctness: clampScore(q.correctness),
        })),
      },
      "Interview finished sucessfully",
    ),
  );
});

const getMyInterviews = asyncHandler(async (req, res) => {
  const interviews = await Interview.find({ userId: req.userId })
    .sort({ createdAt: -1 })
    .select("role experience mode finalScore status createdAt");

  const normalizedInterviews = interviews.map((item) => {
    const rawScore = Number(item.finalScore) || 0;
    const finalScore = rawScore > 10 ? Number((rawScore / 10).toFixed(1)) : Number(rawScore.toFixed(1));
    return {
      ...item.toObject(),
      finalScore,
    };
  });

  return res.status(200).json(normalizedInterviews);
});

const getInterviewReport = asyncHandler(async (req, res) => {
  const interview = await Interview.findById(req.params.id);

  if (!interview) {
    throw new ApiError(404, "Interview not found");
  }

  const questions = interview.questions || [];
  const totalQuestions = questions.length;

  const clampScore = (val) => {
    let num = Number(val);
    if (!Number.isFinite(num) || num < 0) return 0;
    if (num > 10) num = num / 10;
    return Math.min(10, Math.max(0, Number(num.toFixed(1))));
  };

  let totalConfidence = 0;
  let totalCommunication = 0;
  let totalCorrectness = 0;
  let totalScore = 0;

  questions.forEach((q) => {
    totalScore += clampScore(q.score);
    totalConfidence += clampScore(q.confidence);
    totalCommunication += clampScore(q.communication);
    totalCorrectness += clampScore(q.correctness);
  });

  const avgConfidence = totalQuestions
    ? totalConfidence / totalQuestions
    : 0;

  const avgCommunication = totalQuestions
    ? totalCommunication / totalQuestions
    : 0;

  const avgCorrectness = totalQuestions
    ? totalCorrectness / totalQuestions
    : 0;

  const calculatedFinalScore = totalQuestions ? totalScore / totalQuestions : 0;
  const rawFinalScore = interview.finalScore != null ? interview.finalScore : calculatedFinalScore;

  return res.status(200).json({
    finalScore: clampScore(rawFinalScore),
    confidence: Number(avgConfidence.toFixed(1)),
    communication: Number(avgCommunication.toFixed(1)),
    correctness: Number(avgCorrectness.toFixed(1)),
    questionWiseScore: questions.map((q) => {
      const plain = q.toObject ? q.toObject() : q;
      return {
        ...plain,
        score: clampScore(plain.score),
        confidence: clampScore(plain.confidence),
        communication: clampScore(plain.communication),
        correctness: clampScore(plain.correctness),
      };
    }),
  });
});

export {
  analyzeResume,
  generateQuestion,
  submitAnswer,
  getHistory,
  getMyInterviews,
  getInterviewReport,
  finishInterview,
};
