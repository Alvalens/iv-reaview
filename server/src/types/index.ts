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

// Difficulty level
export type Difficulty = "easy" | "medium" | "hard";

// Persona configuration
export interface PersonaConfig {
  id: string;
  name: string;
  title: string;
  company: string;
  personality: string;
  industry: string;
  difficulty: Difficulty;
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

// Scoring result
export interface ScoringResult {
  overallScore: number;
  contentScore: number;
  deliveryScore: number;
  nonVerbalScore: number;
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
    nonVerbalScore: number;
    feedback: string;
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
