import { Router, type Request, type Response } from "express";
import { prisma } from "../db/prisma.js";
import { getPersona } from "../services/persona-generator.js";
import type { CreateSessionRequest } from "../types/index.js";

export const sessionsRouter = Router();

// POST /api/sessions — Create a new interview session
sessionsRouter.post("/", async (req: Request, res: Response) => {
  const body = req.body as CreateSessionRequest;

  if (!body.jobTitle || !body.companyName || !body.jobDescription) {
    res.status(400).json({ error: "Missing required fields: jobTitle, companyName, jobDescription" });
    return;
  }

  if (!body.interviewType || !["HR", "TECHNICAL"].includes(body.interviewType)) {
    res.status(400).json({ error: "interviewType must be 'HR' or 'TECHNICAL'" });
    return;
  }

  if (!body.personaId) {
    res.status(400).json({ error: "personaId is required" });
    return;
  }

  const persona = getPersona(body.personaId);
  if (!persona && body.personaId !== "random") {
    res.status(400).json({ error: "Invalid personaId" });
    return;
  }

  // TODO: Handle random persona generation via Gemini API
  const selectedPersona = persona ?? getPersona("sarah")!;

  const session = await prisma.interviewSession.create({
    data: {
      jobTitle: body.jobTitle,
      companyName: body.companyName,
      jobDescription: body.jobDescription,
      cvContent: body.cvContent ?? null,
      interviewType: body.interviewType,
      personaId: selectedPersona.id,
      personaName: selectedPersona.name,
      personaConfig: JSON.stringify(selectedPersona),
      voiceName: selectedPersona.voiceName,
      duration: body.duration ?? 600,
    },
  });

  res.status(201).json(session);
});

// GET /api/sessions/:id — Get session details
sessionsRouter.get("/:id", async (req: Request, res: Response) => {
  const session = await prisma.interviewSession.findUnique({
    where: { id: req.params.id as string },
    include: { questions: true },
  });

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(session);
});
