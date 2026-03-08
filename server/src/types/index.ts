// Session status enum
export type SessionStatus =
  | "CREATED"
  | "LIVE"
  | "COMPLETED"
  | "SCORING"
  | "SCORED"
  | "ERROR";

// Interview type
export type InterviewType = "HR" | "TECHNICAL";

// Persona configuration
export interface PersonaConfig {
  id: string;
  name: string;
  title: string;
  company: string;
  personality: string;
  industry: string;
  tone: string;
  voiceName: string;
  interviewStyle: string;
  quirks: string[];
  avatar: {
    emoji: string;
    color: string;
    gradient: string;
  };
}

// Transcript entry (stored as JSON string in DB)
export interface TranscriptEntry {
  role: "user" | "model";
  text: string;
  timestamp: number; // ms since session start
}

// Session creation request
export interface CreateSessionRequest {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  cvContent?: string;
  interviewType: InterviewType;
  personaId: string;
  duration?: number;
}

// Per-question scoring result from Gemini (internal)
export interface QuestionScoringResult {
  contentMark: number;
  deliveryMark: number | null;
  nonVerbalMark: number | null;
  suggestion: string;
  reason: string;
  deliveryFeedback: string | null;
  nonVerbalFeedback: string | null;
  speechMetrics: {
    wordsPerMinute: number;
    fillerCount: number;
    pauseCount: number;
  } | null;
  /** Accurate transcription of user's answer from audio (replaces streaming ASR) */
  transcribedAnswer: string;
}

// Per-question accumulated media during live session (in-memory)
export interface QuestionMedia {
  questionIndex: number;
  question: string;
  answerText: string;
  audioPcmChunks: Buffer[];
  videoSnapshots: string[];
}

// Scoring context cached from DB at session connect time
export interface ScoringContext {
  interviewType: InterviewType;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  personaName: string;
  personaStyle: string;
  cvContent?: string;
}

// Scoring result
export interface ScoringResult {
  overallScore: number;
  contentScore: number;
  deliveryScore: number;
  nonVerbalScore: number | null;
  narrative: string;
  strengths: Array<{ category: string; description: string }>;
  weaknesses: Array<{
    category: string;
    description: string;
    priority: string;
  }>;
  questions: Array<{
    questionIndex: number;
    question: string;
    answer: string;
    contentScore: number;
    deliveryScore: number;
    nonVerbalScore: number | null;
    feedback: string;
    deliveryFeedback: string | null;
    nonVerbalFeedback: string | null;
    speechMetrics: {
      wordsPerMinute: number;
      fillerCount: number;
      pauseCount: number;
    } | null;
  }>;
}

// WebSocket message types (client → server)
export type ClientWSMessage =
  | { type: "audio"; data: string } // base64 PCM16 audio
  | { type: "video"; data: string } // base64 JPEG snapshot
  | { type: "control"; action: "start" | "end" | "pause" | "resume" };

// WebSocket message types (server → client)
export type ServerWSMessage =
  | { type: "audio"; data: string } // base64 PCM16 audio from Gemini
  | { type: "transcript"; entry: TranscriptEntry }
  | { type: "status"; status: SessionStatus }
  | { type: "error"; message: string }
  | { type: "interrupt" } // signals client to clear audio playback buffer
  | { type: "turnComplete" }; // signals model finished speaking
