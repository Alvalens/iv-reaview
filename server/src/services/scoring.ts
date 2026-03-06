import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../config/env.js";
import type {
  TranscriptEntry,
  Difficulty,
  ScoringResult,
  InterviewType,
} from "../types/index.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// --- Transcript Parser ---

interface QAPair {
  questionIndex: number;
  question: string;
  answer: string;
}

/**
 * Parse raw transcript entries into question-answer pairs.
 * Strategy: model turns ending with "?" are questions; subsequent user turns are answers.
 * Multiple user turns before the next question are concatenated.
 */
export function parseTranscriptToQA(
  entries: TranscriptEntry[]
): QAPair[] {
  const pairs: QAPair[] = [];
  let currentQuestion: string | null = null;
  let currentAnswer: string[] = [];
  let questionIndex = 0;

  for (const entry of entries) {
    if (entry.role === "model") {
      // If we have a pending Q&A, save it before starting a new question
      if (currentQuestion && currentAnswer.length > 0) {
        pairs.push({
          questionIndex,
          question: currentQuestion,
          answer: currentAnswer.join(" "),
        });
        questionIndex++;
        currentAnswer = [];
      }

      // Check if this model turn contains a question
      const text = entry.text.trim();
      if (text.includes("?")) {
        currentQuestion = text;
      } else if (!currentQuestion) {
        // Opening statement / small talk — skip
        continue;
      }
      // If model speaks without a question after a Q&A pair,
      // it might be a follow-up or transition — treat as new context
    } else if (entry.role === "user" && currentQuestion) {
      currentAnswer.push(entry.text.trim());
    }
  }

  // Save last Q&A pair
  if (currentQuestion && currentAnswer.length > 0) {
    pairs.push({
      questionIndex,
      question: currentQuestion,
      answer: currentAnswer.join(" "),
    });
  }

  return pairs;
}

// --- Scoring Schema (Gemini structured output) ---

const scoringResponseSchema = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER, description: "Overall score 1-10" },
    contentScore: {
      type: Type.NUMBER,
      description: "Content quality score 1-10",
    },
    deliveryScore: {
      type: Type.NUMBER,
      description: "Delivery/communication score 1-10",
    },
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
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionIndex: { type: Type.NUMBER },
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
          contentScore: { type: Type.NUMBER },
          deliveryScore: { type: Type.NUMBER },
          feedback: { type: Type.STRING },
        },
        required: [
          "questionIndex",
          "question",
          "answer",
          "contentScore",
          "deliveryScore",
          "feedback",
        ],
      },
    },
  },
  required: [
    "overallScore",
    "contentScore",
    "deliveryScore",
    "narrative",
    "strengths",
    "weaknesses",
    "questions",
  ],
};

// --- Scoring Prompt ---

function buildScoringPrompt(opts: {
  difficulty: Difficulty;
  interviewType: InterviewType;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  personaName: string;
  cvContent?: string;
  qaPairs: QAPair[];
}): string {
  const difficultyRubric: Record<Difficulty, string> = {
    easy: "Standard rubric — good, relevant answers score 7+. Be encouraging but honest.",
    medium:
      "Moderate rubric — needs strong specifics and clear examples for 7+. Fair but thorough.",
    hard: "Demanding rubric — needs excellent, well-structured answers with depth for 7+. Critical and exacting.",
  };

  const qaBlock = opts.qaPairs
    .map(
      (qa) =>
        `### Question ${qa.questionIndex + 1}\n**Interviewer:** ${qa.question}\n**Candidate:** ${qa.answer}`
    )
    .join("\n\n");

  let prompt = `You are an expert interview evaluator. Analyze this ${opts.interviewType} interview for a ${opts.jobTitle} position at ${opts.companyName}.

## Scoring Rubric
${difficultyRubric[opts.difficulty]}

Difficulty level: ${opts.difficulty}
Interviewer: ${opts.personaName}

## Job Description
${opts.jobDescription}`;

  if (opts.cvContent) {
    prompt += `

## Candidate's CV
${opts.cvContent}`;
  }

  prompt += `

## Interview Transcript (Q&A Pairs)

${qaBlock}

## Scoring Instructions

Score each dimension on a 1-10 scale:
- **Content (1-10)**: Relevance, depth, use of examples, structure, domain knowledge
- **Delivery (1-10)**: Clarity of expression, confidence, conciseness, filler word usage, pace

For each question, provide:
- Content score and delivery score (1-10 each)
- Specific actionable feedback

Overall scores should reflect the weighted average:
- Content: 70%, Delivery: 30%

Provide 2-4 strengths and 2-4 weaknesses with categories ("content", "delivery", or "general") and priority levels ("high", "medium", "low").

Write a 2-3 paragraph narrative summary that is constructive and actionable.`;

  return prompt;
}

// --- Main Scoring Function ---

export async function scoreInterview(opts: {
  transcript: TranscriptEntry[];
  difficulty: Difficulty;
  interviewType: InterviewType;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  personaName: string;
  cvContent?: string;
}): Promise<ScoringResult> {
  const qaPairs = parseTranscriptToQA(opts.transcript);

  if (qaPairs.length === 0) {
    throw new Error("No question-answer pairs found in transcript");
  }

  const prompt = buildScoringPrompt({
    difficulty: opts.difficulty,
    interviewType: opts.interviewType,
    jobTitle: opts.jobTitle,
    companyName: opts.companyName,
    jobDescription: opts.jobDescription,
    personaName: opts.personaName,
    cvContent: opts.cvContent,
    qaPairs,
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: scoringResponseSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from scoring model");
  }

  const result = JSON.parse(text) as ScoringResult;

  // Ensure nonVerbalScore is null (no video in current version)
  result.nonVerbalScore = null;
  for (const q of result.questions) {
    q.nonVerbalScore = null;
  }

  return result;
}
