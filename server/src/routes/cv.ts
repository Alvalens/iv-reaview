import { Router, type Request, type Response } from "express";

export const cvRouter = Router();

// POST /api/cv/extract — Upload and extract text from CV PDF
cvRouter.post("/extract", async (_req: Request, res: Response) => {
  // TODO: Implement CV PDF upload + Gemini extraction
  // Will use multer for file upload and Gemini Flash Lite for text extraction
  res.status(501).json({ error: "Not implemented yet" });
});
