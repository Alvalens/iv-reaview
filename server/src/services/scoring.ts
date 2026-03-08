import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import type {
  TranscriptEntry,
  ScoringResult,
  InterviewType,
  QuestionMedia,
  QuestionScoringResult,
  ScoringContext,
} from "../types/index.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// --- WAV Builder ---

/**
 * Prepend a 44-byte WAV header to raw PCM16 data.
 * Gemini generateContent requires a container format (audio/wav), not raw PCM.
 */
function buildWavBuffer(pcmChunks: Buffer[], sampleRate = 16000): Buffer {
  const pcmData = Buffer.concat(pcmChunks);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;

  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8, "ascii");
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(numChannels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(dataSize, 40);
  pcmData.copy(wav, 44);

  return wav;
}

// --- Weighted Score Calculation (mirrors intervyou) ---

export function calculateWeightedScore(
  content: number,
  delivery: number | null,
  nonVerbal: number | null
): number {
  let score: number;
  if (delivery !== null && nonVerbal !== null) {
    score = content * 0.6 + delivery * 0.25 + nonVerbal * 0.15;
  } else if (delivery !== null) {
    score = content * 0.7 + delivery * 0.3;
  } else if (nonVerbal !== null) {
    score = content * 0.8 + nonVerbal * 0.2;
  } else {
    score = content;
  }
  return Math.round(score * 10) / 10;
}

// --- Null-safe average ---

function avg(values: (number | null)[]): number {
  const nums = values.filter((v): v is number => v !== null && v !== undefined);
  if (nums.length === 0) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function avgOrNull(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null && v !== undefined);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

// --- Per-Question Scoring Schema ---

const questionScoringSchema = {
  type: Type.OBJECT,
  properties: {
    contentMark: {
      type: Type.NUMBER,
      description: "Content quality score 1-10",
    },
    deliveryMark: {
      type: Type.NUMBER,
      description: "Delivery/speech score 1-10 (0 if no audio provided)",
    },
    nonVerbalMark: {
      type: Type.NUMBER,
      description:
        "Non-verbal communication score 1-10 (0 if no video provided)",
    },
    suggestion: {
      type: Type.STRING,
      description: "One-line actionable improvement tip",
    },
    reason: {
      type: Type.STRING,
      description: "Why this score and suggestion",
    },
    deliveryFeedback: {
      type: Type.STRING,
      description: "Specific speech delivery observations",
    },
    nonVerbalFeedback: {
      type: Type.STRING,
      description: "Specific body language observations",
    },
    speechMetrics: {
      type: Type.OBJECT,
      properties: {
        wordsPerMinute: {
          type: Type.NUMBER,
          description: "Estimated words per minute",
        },
        fillerCount: {
          type: Type.NUMBER,
          description: "Number of filler words (um, uh, like, you know)",
        },
        pauseCount: {
          type: Type.NUMBER,
          description: "Number of notable pauses",
        },
      },
      required: ["wordsPerMinute", "fillerCount", "pauseCount"],
    },
    transcribedAnswer: {
      type: Type.STRING,
      description:
        "Accurate word-for-word transcription of the candidate's spoken answer from the audio",
    },
  },
  required: [
    "contentMark",
    "deliveryMark",
    "suggestion",
    "reason",
    "deliveryFeedback",
    "speechMetrics",
    "transcribedAnswer",
  ],
};

// --- Per-Question Prompt ---

function buildQuestionScoringPrompt(
  media: QuestionMedia,
  ctx: ScoringContext
): string {
  const hasAudio = media.audioPcmChunks.length > 0;
  const hasVideo = media.videoSnapshots.length > 0;

  let prompt = `You are an expert interview evaluator. Score this single interview answer.

## Context
Position: ${ctx.jobTitle} at ${ctx.companyName}
Interview Type: ${ctx.interviewType}
Interviewer Style: ${ctx.personaStyle}

## Scoring Rubric
Use the full 1-10 range honestly. A good, relevant answer with examples scores 7+. An exceptional answer with depth and specifics scores 9+. Vague or generic answers cap at 5-6.

Job Description (excerpt): ${ctx.jobDescription.substring(0, 1500)}`;

  if (ctx.cvContent) {
    prompt += `\nCandidate CV (excerpt): ${ctx.cvContent.substring(0, 1000)}`;
  }

  prompt += `

## Question & Answer
**Interviewer:** ${media.question}
**Candidate:** ${media.answerText}

## Scoring Dimensions
- 1-2: Very Poor  3-4: Poor  5-6: Average  7-8: Strong  9-10: Excellent

**Content (1-10):** Relevance, depth, use of examples, structure, domain knowledge.`;

  if (hasAudio) {
    prompt += `
**Delivery (1-10):** Analyze the provided audio. Evaluate vocal clarity, confidence, pace, filler word usage (um, uh, like), articulation, and pauses. Provide specific speechMetrics.`;
  } else {
    prompt += `
**Delivery:** No audio provided — set deliveryMark to 0 and deliveryFeedback to "No audio available".`;
  }

  if (hasVideo) {
    prompt += `
**Non-Verbal (1-10):** Analyze the provided video snapshots. Evaluate eye contact (relative to camera), posture, facial expression, gestures, and overall presence.`;
  } else {
    prompt += `
**Non-Verbal:** No video provided — set nonVerbalMark to 0 and nonVerbalFeedback to "No video available".`;
  }

  prompt += `

  
**Transcription:** Listen to the audio carefully and provide an accurate, word-for-word transcription of what the candidate actually said in the "transcribedAnswer" field. The text under "Candidate:" above is from streaming ASR and may be inaccurate — use the audio as the source of truth.`;

  return prompt;
}

// --- Fire-and-Forget Per-Question Scoring ---

export async function scoreQuestion(
  sessionId: string,
  media: QuestionMedia,
  scoringContext: ScoringContext
): Promise<void> {
  const hasAudio = media.audioPcmChunks.length > 0;
  const hasVideo = media.videoSnapshots.length > 0;

  console.log(
    `[Scoring] Q${media.questionIndex} starting: audio=${hasAudio} (${media.audioPcmChunks.length} chunks), video=${hasVideo} (${media.videoSnapshots.length} snapshots)`
  );

  // Build multimodal content parts
  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  // Text prompt
  parts.push({ text: buildQuestionScoringPrompt(media, scoringContext) });

  // Audio WAV
  if (hasAudio) {
    const wavBuffer = buildWavBuffer(media.audioPcmChunks);
    parts.push({
      inlineData: {
        mimeType: "audio/wav",
        data: wavBuffer.toString("base64"),
      },
    });
  }

  // Video JPEG snapshots
  for (const snap of media.videoSnapshots) {
    parts.push({
      inlineData: { mimeType: "image/jpeg", data: snap },
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: questionScoringSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from scoring model");
  }

  const raw = JSON.parse(text) as QuestionScoringResult;

  // Server-side enforcement: null out dimensions for missing media
  const deliveryMark = hasAudio ? raw.deliveryMark : null;
  const nonVerbalMark = hasVideo ? raw.nonVerbalMark : null;
  const deliveryFeedback = hasAudio ? raw.deliveryFeedback : null;
  const nonVerbalFeedback = hasVideo ? raw.nonVerbalFeedback : null;
  const speechMetrics = hasAudio ? raw.speechMetrics : null;

  // Use accurate transcription from scoring model instead of streaming ASR
  const accurateAnswer = raw.transcribedAnswer || media.answerText;

  // Upsert to DB
  await prisma.interviewQuestion.upsert({
    where: {
      interviewSessionId_questionIndex: {
        interviewSessionId: sessionId,
        questionIndex: media.questionIndex,
      },
    },
    create: {
      interviewSessionId: sessionId,
      questionIndex: media.questionIndex,
      question: media.question,
      answer: accurateAnswer,
      contentScore: raw.contentMark,
      deliveryScore: deliveryMark,
      nonVerbalScore: nonVerbalMark,
      feedback: raw.suggestion,
      deliveryFeedback,
      nonVerbalFeedback,
      speechMetrics: speechMetrics ? JSON.stringify(speechMetrics) : null,
    },
    update: {
      question: media.question,
      answer: accurateAnswer,
      contentScore: raw.contentMark,
      deliveryScore: deliveryMark,
      nonVerbalScore: nonVerbalMark,
      feedback: raw.suggestion,
      deliveryFeedback,
      nonVerbalFeedback,
      speechMetrics: speechMetrics ? JSON.stringify(speechMetrics) : null,
    },
  });

  console.log(
    `[Scoring] Q${media.questionIndex} done: content=${raw.contentMark}, delivery=${deliveryMark}, nonVerbal=${nonVerbalMark}, transcribed=${accurateAnswer.length} chars`
  );
}

// --- Narrative Schema ---

const narrativeSchema = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.STRING,
      description: "2-3 paragraph performance summary",
    },
    strengths: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["category", "description"],
      },
    },
    weaknesses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          description: { type: Type.STRING },
          priority: { type: Type.STRING },
        },
        required: ["category", "description", "priority"],
      },
    },
  },
  required: ["narrative", "strengths", "weaknesses"],
};

// --- Aggregation (replaces old scoreInterview for the endpoint) ---

export async function aggregateSessionScores(
  sessionId: string,
  scoringContext: ScoringContext
): Promise<ScoringResult> {
  const questions = await prisma.interviewQuestion.findMany({
    where: { interviewSessionId: sessionId },
    orderBy: { questionIndex: "asc" },
  });

  if (questions.length === 0) {
    throw new Error("No per-question scores available");
  }

  // Average across all questions
  const overallContent = avg(questions.map((q) => q.contentScore));
  const overallDelivery = avgOrNull(questions.map((q) => q.deliveryScore));
  const overallNonVerbal = avgOrNull(questions.map((q) => q.nonVerbalScore));
  const overallScore = calculateWeightedScore(
    overallContent,
    overallDelivery,
    overallNonVerbal
  );

  // Build narrative prompt from per-question data
  const qaBlock = questions
    .map((q) => {
      let block = `Q${q.questionIndex + 1}: ${q.question}\nAnswer: ${q.answer.substring(0, 300)}`;
      block += `\nScores: Content=${q.contentScore ?? "N/A"}/10`;
      if (q.deliveryScore !== null) block += `, Delivery=${q.deliveryScore}/10`;
      if (q.nonVerbalScore !== null)
        block += `, NonVerbal=${q.nonVerbalScore}/10`;
      if (q.feedback) block += `\nSuggestion: ${q.feedback}`;
      if (q.deliveryFeedback) block += `\nDelivery: ${q.deliveryFeedback}`;
      if (q.nonVerbalFeedback) block += `\nNon-verbal: ${q.nonVerbalFeedback}`;
      return block;
    })
    .join("\n\n");

  const narrativePrompt = `You are an expert interview coach. Generate a performance summary for this ${scoringContext.interviewType} interview.

Position: ${scoringContext.jobTitle} at ${scoringContext.companyName}
Interviewer: ${scoringContext.personaName} (${scoringContext.personaStyle})
Overall Score: ${overallScore}/10

## Per-Question Results
${qaBlock}

Write a constructive 2-3 paragraph narrative. Identify 2-4 strengths and 2-4 areas to improve with categories ("content", "delivery", "non-verbal", or "general") and priority ("high", "medium", "low").`;

  const narrativeResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: narrativePrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: narrativeSchema,
    },
  });

  const narrativeText = narrativeResponse.text;
  if (!narrativeText) {
    throw new Error("Empty narrative response");
  }

  const narrative = JSON.parse(narrativeText) as {
    narrative: string;
    strengths: Array<{ category: string; description: string }>;
    weaknesses: Array<{
      category: string;
      description: string;
      priority: string;
    }>;
  };

  return {
    overallScore,
    contentScore: overallContent,
    deliveryScore: overallDelivery ?? overallContent,
    nonVerbalScore: overallNonVerbal,
    narrative: narrative.narrative,
    strengths: narrative.strengths,
    weaknesses: narrative.weaknesses,
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
  };
}

// --- Legacy: Transcript-only scoring (fallback for old sessions) ---

interface QAPair {
  questionIndex: number;
  question: string;
  answer: string;
}

export function parseTranscriptToQA(entries: TranscriptEntry[]): QAPair[] {
  const pairs: QAPair[] = [];
  let currentQuestion: string | null = null;
  let currentAnswer: string[] = [];
  let questionIndex = 0;

  for (const entry of entries) {
    if (entry.role === "model") {
      if (currentQuestion && currentAnswer.length > 0) {
        pairs.push({
          questionIndex,
          question: currentQuestion,
          answer: currentAnswer.join(" "),
        });
        questionIndex++;
        currentAnswer = [];
      }
      const text = entry.text.trim();
      if (text.includes("?")) {
        currentQuestion = text;
      } else if (!currentQuestion) {
        continue;
      }
    } else if (entry.role === "user" && currentQuestion) {
      currentAnswer.push(entry.text.trim());
    }
  }

  if (currentQuestion && currentAnswer.length > 0) {
    pairs.push({
      questionIndex,
      question: currentQuestion,
      answer: currentAnswer.join(" "),
    });
  }

  return pairs;
}
