import { Router, type Request, type Response } from "express";
import { prisma } from "../db/prisma.js";
import { scoreInterview } from "../services/scoring.js";
import type {
  TranscriptEntry,
  Difficulty,
  InterviewType,
} from "../types/index.js";

export const scoringRouter = Router();

// POST /api/sessions/:id/score — Trigger post-session scoring
scoringRouter.post("/:id/score", async (req: Request, res: Response) => {
  const sessionId = req.params.id as string;

  // 1. Fetch session from DB
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.status === "SCORED") {
    // Already scored — return existing scores
    const questions = await prisma.interviewQuestion.findMany({
      where: { interviewSessionId: sessionId },
      orderBy: { questionIndex: "asc" },
    });
    res.json({
      overallScore: session.overallScore,
      contentScore: session.contentScore,
      deliveryScore: session.deliveryScore,
      nonVerbalScore: session.nonVerbalScore,
      narrative: session.narrative,
      strengths: session.strengths ? JSON.parse(session.strengths) : [],
      weaknesses: session.weaknesses ? JSON.parse(session.weaknesses) : [],
      questions: questions.map((q) => ({
        questionIndex: q.questionIndex,
        question: q.question,
        answer: q.answer,
        contentScore: q.contentScore,
        deliveryScore: q.deliveryScore,
        nonVerbalScore: q.nonVerbalScore,
        feedback: q.feedback,
      })),
    });
    return;
  }

  if (session.status !== "COMPLETED") {
    res.status(400).json({
      error: `Session is in ${session.status} state, expected COMPLETED`,
    });
    return;
  }

  if (!session.transcript) {
    res.status(400).json({ error: "Session has no transcript" });
    return;
  }

  // 2. Set status to SCORING
  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { status: "SCORING" },
  });

  try {
    const transcript: TranscriptEntry[] = JSON.parse(session.transcript);
    const persona = JSON.parse(session.personaConfig);

    // 3. Call scoring service
    console.log(
      `[Scoring] Starting scoring for session ${sessionId} (${transcript.length} transcript entries)`
    );

    const result = await scoreInterview({
      transcript,
      difficulty: persona.difficulty as Difficulty,
      interviewType: session.interviewType as InterviewType,
      jobTitle: session.jobTitle,
      companyName: session.companyName,
      jobDescription: session.jobDescription,
      personaName: persona.name,
      cvContent: session.cvContent ?? undefined,
    });

    console.log(
      `[Scoring] Completed for session ${sessionId}: overall=${result.overallScore}, ${result.questions.length} questions`
    );

    // 4. Save scores to DB
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: "SCORED",
        overallScore: result.overallScore,
        contentScore: result.contentScore,
        deliveryScore: result.deliveryScore,
        nonVerbalScore: result.nonVerbalScore,
        narrative: result.narrative,
        strengths: JSON.stringify(result.strengths),
        weaknesses: JSON.stringify(result.weaknesses),
      },
    });

    // 5. Save per-question scores
    for (const q of result.questions) {
      await prisma.interviewQuestion.create({
        data: {
          interviewSessionId: sessionId,
          questionIndex: q.questionIndex,
          question: q.question,
          answer: q.answer,
          contentScore: q.contentScore,
          deliveryScore: q.deliveryScore,
          nonVerbalScore: q.nonVerbalScore,
          feedback: q.feedback,
        },
      });
    }

    // 6. Return scores
    res.json(result);
  } catch (err) {
    console.error(`[Scoring] Failed for session ${sessionId}:`, err);

    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { status: "ERROR" },
    });

    res.status(500).json({
      error: "Scoring failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
