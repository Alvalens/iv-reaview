import type { Session } from "@google/genai";
import type WebSocket from "ws";
import type {
  PersonaConfig,
  TranscriptEntry,
  ScoringContext,
} from "../types/index.js";

export interface ActiveSession {
  sessionId: string;
  clientWs: WebSocket;
  geminiSession: Session | null;
  persona: PersonaConfig;
  transcript: TranscriptEntry[];
  startedAt: number;
  resumptionHandle: string | null;
  status: "connecting" | "live" | "reconnecting" | "ending" | "closed";
  pendingUserText: string;
  pendingModelText: string;
  /** True while Gemini is producing audio — used to gate client mic audio */
  modelSpeaking: boolean;
  modelSpeakingTimeout: ReturnType<typeof setTimeout> | null;
  /** Per-question scoring: tracks current Q&A pair index */
  currentQuestionIndex: number;
  /** PCM16 audio chunks captured during current user turn */
  currentTurnAudioChunks: Buffer[];
  /** JPEG base64 snapshots for current user turn, max 5 */
  currentTurnVideoSnapshots: string[];
  /** Cached job/persona context for fire-and-forget scoring calls */
  scoringContext: ScoringContext;
  /** Grace period: don't forward mic audio until model starts speaking */
  audioForwardingEnabled: boolean;
  /** Session timeout timers */
  sessionTimeout: ReturnType<typeof setTimeout> | null;
  warningTimeout: ReturnType<typeof setTimeout> | null;
  /** Interval for sending time updates to client */
  timerInterval: ReturnType<typeof setInterval> | null;
  /** Flag to indicate this is the last question (due to time warning or AI signals) */
  isLastQuestion: boolean;
}

const activeSessions = new Map<string, ActiveSession>();

export function getActiveSession(
  sessionId: string
): ActiveSession | undefined {
  return activeSessions.get(sessionId);
}

export function setActiveSession(
  sessionId: string,
  session: ActiveSession
): void {
  activeSessions.set(sessionId, session);
}

export function deleteActiveSession(sessionId: string): void {
  activeSessions.delete(sessionId);
}

export function hasActiveSession(sessionId: string): boolean {
  return activeSessions.has(sessionId);
}
