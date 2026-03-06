// Session status
export type SessionStatus =
  | "CREATED"
  | "LIVE"
  | "COMPLETED"
  | "SCORING"
  | "SCORED"
  | "ERROR";

export type InterviewType = "HR" | "TECHNICAL";
export type Difficulty = "easy" | "medium" | "hard";

// Persona config (mirrors server type)
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

// Transcript entry
export interface TranscriptEntry {
  role: "user" | "model";
  text: string;
  timestamp: number;
}

// Interview session from API
export interface InterviewSession {
  id: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  cvContent: string | null;
  interviewType: InterviewType;
  personaId: string;
  personaName: string;
  personaConfig: string;
  voiceName: string;
  status: SessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  duration: number;
  transcript: string | null;
  overallScore: number | null;
  contentScore: number | null;
  deliveryScore: number | null;
  nonVerbalScore: number | null;
  narrative: string | null;
  strengths: string | null;
  weaknesses: string | null;
  questions: InterviewQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface InterviewQuestion {
  id: string;
  questionIndex: number;
  question: string;
  answer: string;
  contentScore: number | null;
  deliveryScore: number | null;
  nonVerbalScore: number | null;
  feedback: string | null;
}

// Scoring result from POST /api/sessions/:id/score
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
  }>;
}
