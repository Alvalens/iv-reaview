import type { Session } from "@google/genai";
import type WebSocket from "ws";
import type { PersonaConfig, TranscriptEntry } from "../types/index.js";

export interface ActiveSession {
  sessionId: string;
  clientWs: WebSocket;
  geminiSession: Session | null;
  persona: PersonaConfig;
  transcript: TranscriptEntry[];
  startedAt: number;
  resumptionHandle: string | null;
  status: "connecting" | "live" | "ending" | "closed";
  pendingUserText: string;
  pendingModelText: string;
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
