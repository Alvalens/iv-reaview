import { Router, type Request, type Response } from "express";

export const scoringRouter = Router();

// POST /api/sessions/:id/score — Trigger post-session scoring
scoringRouter.post("/:id/score", async (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Implement scoring pipeline
  // 1. Fetch session + transcript from DB
  // 2. Send transcript to Gemini 2.5 Pro with structured output schema
  // 3. Parse scores and save to DB
  // 4. Return scores to client

  res.status(501).json({ error: "Scoring not implemented yet", sessionId: id });
});
