import { Router, type Request, type Response } from "express";
import { prisma } from "../db/prisma.js";
import { aggregateSessionScores } from "../services/scoring.js";
import type { InterviewType } from "../types/index.js";

export const scoringRouter = Router();

// POST /api/sessions/:id/score — Aggregate per-question scores + generate narrative
scoringRouter.post("/:id/score", async (req: Request, res: Response) => {
  const sessionId = req.params.id as string;

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Already scored — return cached data
  if (session.status === "SCORED") {
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
        contentScore: q.contentScore ?? 0,
        deliveryScore: q.deliveryScore ?? 0,
        nonVerbalScore: q.nonVerbalScore,
        feedback: q.feedback ?? "",
        deliveryFeedback: q.deliveryFeedback,
        nonVerbalFeedback: q.nonVerbalFeedback,
        speechMetrics: q.speechMetrics
          ? JSON.parse(q.speechMetrics as string)
          : null,
      })),
    });
    return;
  }

  if (session.status !== "COMPLETED" && session.status !== "SCORING") {
    res.status(400).json({
      error: `Session is in ${session.status} state, expected COMPLETED`,
    });
    return;
  }

  // Check if per-question scores exist (fire-and-forget scoring may still be running)
  const scoredQuestions = await prisma.interviewQuestion.count({
    where: {
      interviewSessionId: sessionId,
      contentScore: { not: null },
    },
  });

  if (scoredQuestions === 0) {
    // Per-question scoring still in progress — tell client to poll
    res.status(202).json({
      status: "scoring_in_progress",
      message: "Per-question scoring is still running. Retry in a few seconds.",
      scoredCount: 0,
    });
    return;
  }

  // Set status to SCORING
  await prisma.interviewSession.update({
    where: { id: sessionId },
    data: { status: "SCORING" },
  });

  try {
    const persona = JSON.parse(session.personaConfig);
    const scoringContext = {
      interviewType: session.interviewType as InterviewType,
      jobTitle: session.jobTitle,
      companyName: session.companyName,
      jobDescription: session.jobDescription,
      personaName: persona.name,
      personaStyle: persona.interviewStyle ?? "Standard professional interview",
      cvContent: session.cvContent ?? undefined,
    };

    console.log(
      `[Scoring] Aggregating ${scoredQuestions} scored questions for session ${sessionId}`
    );

    const result = await aggregateSessionScores(sessionId, scoringContext);

    // Save aggregated scores to session
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

    console.log(
      `[Scoring] Aggregation complete for session ${sessionId}: overall=${result.overallScore}`
    );

    res.json(result);
  } catch (err) {
    console.error(`[Scoring] Aggregation failed for session ${sessionId}:`, err);

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
