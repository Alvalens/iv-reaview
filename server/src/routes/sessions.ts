import { Router, type Request, type Response } from "express";
import { prisma } from "../db/prisma.js";
import { getPersona, generateRandomPersona } from "../services/persona-generator.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import type { CreateSessionRequest } from "../types/index.js";

export const sessionsRouter = Router();

// Apply auth middleware to all session routes
sessionsRouter.use(authMiddleware);

// POST /api/sessions — Create a new interview session
sessionsRouter.post("/", async (req: AuthRequest, res: Response) => {
  // Explicitly check for authenticated user
  if (!req.user || !req.user.userId) {
    res.status(500).json({ error: "Authenticated user context is missing" });
    return;
  }

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

  let selectedPersona;

  if (body.personaId === "random") {
    try {
      selectedPersona = await generateRandomPersona();
    } catch (err) {
      console.error("[Sessions] Random persona generation failed, falling back to predefined:", err);
      // Fallback: randomly pick from predefined personas
      const predefined = ["sarah", "david", "maya"];
      const fallbackId = predefined[Math.floor(Math.random() * predefined.length)];
      selectedPersona = getPersona(fallbackId)!;
    }
  } else {
    selectedPersona = getPersona(body.personaId);
    if (!selectedPersona) {
      res.status(400).json({ error: "Invalid personaId" });
      return;
    }
  }

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
      userId: req.user.userId,
    },
  });

  res.status(201).json(session);
});

// GET /api/sessions/:id — Get session details
sessionsRouter.get("/:id", async (req: AuthRequest, res: Response) => {
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
