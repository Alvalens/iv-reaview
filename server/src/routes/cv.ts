import { Router, type Request, type Response, type Router as RouterType } from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { authMiddleware } from "../middleware/auth.js";
import { aiApiLimiter } from "../middleware/rate-limit.js";

export const cvRouter: RouterType = Router();

// Apply auth middleware to all CV routes
cvRouter.use(authMiddleware);

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted"));
    }
  },
});

// POST /api/cv/extract — Upload PDF CV and extract text via Gemini
// Rate limited since this endpoint calls Gemini AI API
cvRouter.post("/extract", aiApiLimiter, upload.single("file"), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No PDF file uploaded" });
    return;
  }

  console.log(`[CV] Extracting text from PDF: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB)`);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Extract the text content from this PDF CV/resume and format it as clean Markdown.

Rules:
1. Preserve all information — do not summarize or omit anything.
2. Use proper Markdown headings (## for sections like Experience, Education, Skills).
3. Use bullet points for list items.
4. Keep dates and locations in their original format.
5. If the CV is not in English, keep the original language.
6. If the uploaded file is NOT a CV/resume, respond with exactly: "not a cv"
7. Do not add commentary — just return the formatted Markdown content.`,
            },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: file.buffer.toString("base64"),
              },
            },
          ],
        },
      ],
    });

    const content = response.text;
    if (!content) {
      res.status(500).json({ error: "Empty response from extraction model" });
      return;
    }

    if (content.trim().toLowerCase() === "not a cv") {
      res.status(400).json({ error: "The uploaded file does not appear to be a CV/resume" });
      return;
    }

    console.log(`[CV] Extracted ${content.length} chars from ${file.originalname}`);
    res.json({ content });
  } catch (err) {
    console.error("[CV] Extraction failed:", err);
    res.status(500).json({
      error: "CV extraction failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
