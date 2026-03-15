import type { WebSocket } from "ws";
import { prisma } from "../db/prisma.js";
import {
  buildSystemPrompt,
  buildContextMessage,
} from "../services/persona-generator.js";
import {
  connectToGemini,
  sendAudioToGemini,
  sendContextToGemini,
  closeGeminiSession,
  type GeminiLiveCallbacks,
} from "../services/gemini-live.js";
import {
  getActiveSession,
  setActiveSession,
  deleteActiveSession,
  hasActiveSession,
  type ActiveSession,
} from "./session-manager.js";
import type {
  ClientWSMessage,
  ServerWSMessage,
  TranscriptEntry,
  PersonaConfig,
  InterviewType,
} from "../types/index.js";
import { scoreQuestion } from "../services/scoring.js";

function sendToClient(ws: WebSocket, msg: ServerWSMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export async function handleWebSocketConnection(
  ws: WebSocket,
  sessionId: string
): Promise<void> {
  console.log(`[WS] Client connected for session: ${sessionId}`);

  // Guard: no duplicate connections
  if (hasActiveSession(sessionId)) {
    sendToClient(ws, {
      type: "error",
      message: "Session already has an active connection",
    });
    ws.close(4409, "Session already active");
    return;
  }

  // Validate session in DB
  const dbSession = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
  });

  if (!dbSession) {
    sendToClient(ws, { type: "error", message: "Session not found" });
    ws.close(4404, "Session not found");
    return;
  }

  if (dbSession.status !== "CREATED") {
    sendToClient(ws, {
      type: "error",
      message: `Session is in ${dbSession.status} state, expected CREATED`,
    });
    ws.close(4409, "Invalid session state");
    return;
  }

  // Build system instruction (short — persona + rules only)
  // Job description + CV sent separately via sendClientContent after setup
  // to avoid Gemini Live API silent hang bug with long system instructions
  const persona: PersonaConfig = JSON.parse(dbSession.personaConfig);
  const systemPrompt = buildSystemPrompt(persona, {
    jobTitle: dbSession.jobTitle,
    companyName: dbSession.companyName,
    interviewType: dbSession.interviewType as InterviewType,
  });
  const contextMessage = buildContextMessage({
    jobTitle: dbSession.jobTitle,
    companyName: dbSession.companyName,
    jobDescription: dbSession.jobDescription,
    cvContent: dbSession.cvContent ?? undefined,
  });

  // Register active session
  const active: ActiveSession = {
    sessionId,
    clientWs: ws,
    geminiSession: null,
    persona,
    transcript: [],
    startedAt: Date.now(),
    resumptionHandle: null,
    status: "connecting",
    pendingUserText: "",
    pendingModelText: "",
    modelSpeaking: false,
    modelSpeakingTimeout: null,
    currentQuestionIndex: 0,
    currentTurnAudioChunks: [],
    currentTurnVideoSnapshots: [],
    scoringContext: {
      interviewType: dbSession.interviewType as InterviewType,
      jobTitle: dbSession.jobTitle,
      companyName: dbSession.companyName,
      jobDescription: dbSession.jobDescription,
      personaName: persona.name,
      personaStyle: persona.interviewStyle,
      cvContent: dbSession.cvContent ?? undefined,
    },
    audioForwardingEnabled: false,
  };
  setActiveSession(sessionId, active);

  sendToClient(ws, { type: "status", status: "CREATED" });

  // Connect to Gemini Live API
  try {
    const geminiCallbacks = buildGeminiCallbacks(sessionId);
    const geminiSession = await connectToGemini({
      systemPrompt,
      voiceName: persona.voiceName,
      callbacks: geminiCallbacks,
    });
    active.geminiSession = geminiSession;

    // Send job description + CV as context after connection is established.
    // This avoids the Gemini Live API bug where long system instructions
    // cause the model to silently hang in audio-only mode.
    sendContextToGemini(geminiSession, contextMessage);
  } catch (err) {
    console.error(
      `[WS] Failed to connect to Gemini for session ${sessionId}:`,
      err
    );
    sendToClient(ws, {
      type: "error",
      message: "Failed to connect to AI interviewer",
    });
    await cleanupSession(sessionId, "ERROR");
    ws.close(1011, "Gemini connection failed");
    return;
  }

  // Wire client message handlers
  let audioChunkCount = 0;
  let audioByteTotal = 0;
  let lastAudioLogTime = 0;

  // Grace period: don't forward mic audio until model starts speaking or 3s passes.
  // This lets the model process the system prompt and start its greeting
  // without misinterpreting ambient mic noise as "user is speaking".
  setTimeout(() => {
    const s = getActiveSession(sessionId);
    if (s && !s.audioForwardingEnabled) {
      s.audioForwardingEnabled = true;
      console.log(`[WS] Audio forwarding enabled (timeout) for session ${sessionId}`);
    }
  }, 3000);

  ws.on("message", (data, isBinary) => {
    const session = getActiveSession(sessionId);
    if (!session?.geminiSession || session.status !== "live") return;

    if (isBinary) {
      // Binary frame = raw PCM16 audio from client mic
      const buffer = data as Buffer;
      audioChunkCount++;
      audioByteTotal += buffer.length;

      // Grace period: skip forwarding audio until model has started speaking
      if (!session.audioForwardingEnabled) {
        // Still buffer for per-question scoring
        session.currentTurnAudioChunks.push(Buffer.from(buffer));
        return;
      }

      // Audio gating: don't forward mic audio while model is speaking
      // This prevents echo feedback where the model hears its own output
      if (session.modelSpeaking) {
        if (audioChunkCount % 100 === 0) {
          console.log(
            `[WS] Audio gated (model speaking) — chunk #${audioChunkCount}`
          );
        }
        return;
      }

      // Log when audio starts being forwarded after model was speaking
      const lastChunkCount = (session as any).lastGatedChunkCount || 0;
      if (audioChunkCount > lastChunkCount + 10) {
        console.log(
          `[WS] Audio forwarding resumed — chunk #${audioChunkCount} (was gated at #${lastChunkCount})`
        );
      }
      (session as any).lastGatedChunkCount = audioChunkCount;

      // Log first 3 chunks and then every 5 seconds
      const now = Date.now();
      if (audioChunkCount <= 3 || now - lastAudioLogTime > 5000) {
        console.log(
          `[WS] Audio chunk #${audioChunkCount} from client: ${buffer.length} bytes (total: ${audioByteTotal} bytes)`
        );
        lastAudioLogTime = now;
      }

      // Buffer audio for per-question scoring
      session.currentTurnAudioChunks.push(Buffer.from(buffer));

      const base64 = buffer.toString("base64");
      sendAudioToGemini(session.geminiSession, base64);
    } else {
      // Text frame = JSON control message
      try {
        const msg = JSON.parse(data.toString()) as ClientWSMessage;
        handleClientMessage(sessionId, msg);
      } catch {
        console.error(`[WS] Invalid JSON from client`);
      }
    }
  });

  ws.on("close", (code, reason) => {
    console.log(
      `[WS] Client disconnected for session ${sessionId}: ${code} ${reason.toString()}`
    );
    cleanupSession(sessionId, "COMPLETED");
  });

  ws.on("error", (error) => {
    console.error(`[WS] Client WS error for session ${sessionId}:`, error);
    cleanupSession(sessionId, "ERROR");
  });
}

function handleClientMessage(
  sessionId: string,
  msg: ClientWSMessage
): void {
  const session = getActiveSession(sessionId);
  if (!session?.geminiSession) return;

  switch (msg.type) {
    case "audio":
      // Audio sent as JSON base64 (alternative to binary frames)
      sendAudioToGemini(session.geminiSession, msg.data);
      break;

    case "video":
      // Accumulate video snapshots for per-question scoring (cap at 5 per turn)
      if (session.currentTurnVideoSnapshots.length < 5) {
        session.currentTurnVideoSnapshots.push(msg.data);
      }
      break;

    case "control":
      if (msg.action === "end") {
        console.log(`[WS] Client requested end for session ${sessionId}`);
        cleanupSession(sessionId, "COMPLETED");
      }
      break;
  }
}

// Flush accumulated user transcription text as a transcript entry
function flushPendingUserText(sessionId: string): void {
  const session = getActiveSession(sessionId);
  if (!session || !session.pendingUserText.trim()) return;

  const entry: TranscriptEntry = {
    role: "user",
    text: session.pendingUserText.trim(),
    timestamp: Date.now() - session.startedAt,
  };
  session.transcript.push(entry);
  sendToClient(session.clientWs, { type: "transcript", entry });
  console.log(
    `[Transcript] User (${session.transcript.length}): "${entry.text.slice(0, 80)}..."`
  );
  session.pendingUserText = "";
}

// Flush accumulated model transcription text as a transcript entry
function flushPendingModelText(sessionId: string): void {
  const session = getActiveSession(sessionId);
  if (!session || !session.pendingModelText.trim()) return;

  const fullText = session.pendingModelText.trim();
  const entry: TranscriptEntry = {
    role: "model",
    text: fullText,
    timestamp: Date.now() - session.startedAt,
  };
  session.transcript.push(entry);
  sendToClient(session.clientWs, { type: "transcript", entry });
  console.log(
    `[Transcript] Model (${session.transcript.length}): "${fullText.slice(0, 80)}..."`
  );
  session.pendingModelText = "";

  // Detect completed Q&A pair and fire per-question scoring
  // Pattern: model question (has "?") → user answer → model next turn (current)
  const t = session.transcript;
  if (t.length >= 3) {
    const modelQuestion = t[t.length - 3];
    const userAnswer = t[t.length - 2];
    if (
      modelQuestion.role === "model" &&
      modelQuestion.text.includes("?") &&
      userAnswer.role === "user"
    ) {
      const qi = session.currentQuestionIndex;
      const media = {
        questionIndex: qi,
        question: modelQuestion.text,
        answerText: userAnswer.text,
        audioPcmChunks: [...session.currentTurnAudioChunks],
        videoSnapshots: [...session.currentTurnVideoSnapshots],
      };
      session.currentQuestionIndex++;
      session.currentTurnAudioChunks = [];
      session.currentTurnVideoSnapshots = [];

      // Fire-and-forget per-question scoring
      scoreQuestion(sessionId, media, session.scoringContext).catch((err) =>
        console.error(`[Scoring] Q${qi} failed:`, err)
      );
    }
  }

  // Check for end keyword
  if (fullText.includes("END_INTERVIEW")) {
    console.log(
      `[Gemini] END_INTERVIEW detected for session ${sessionId}`
    );
    cleanupSession(sessionId, "COMPLETED");
  }
}

function buildGeminiCallbacks(sessionId: string): GeminiLiveCallbacks {
  let inputTranscriptCount = 0;
  let outputTranscriptCount = 0;

  return {
    onSetupComplete: () => {
      const session = getActiveSession(sessionId);
      if (!session) return;

      console.log(`[Gemini] Setup complete for session ${sessionId}`);
      session.status = "live";
      session.startedAt = Date.now();

      // Update DB status
      prisma.interviewSession
        .update({
          where: { id: sessionId },
          data: { status: "LIVE", startedAt: new Date() },
        })
        .catch((err: unknown) =>
          console.error("[DB] Failed to update session to LIVE:", err)
        );

      sendToClient(session.clientWs, { type: "status", status: "LIVE" });
    },

    onAudioData: (base64Pcm24: string) => {
      const session = getActiveSession(sessionId);
      if (!session) return;

      // Enable audio forwarding once model starts speaking (grace period over)
      if (!session.audioForwardingEnabled) {
        session.audioForwardingEnabled = true;
        console.log(`[WS] Audio forwarding enabled (model spoke) for session ${sessionId}`);
      }

      // Mark model as speaking — gates client mic audio to prevent echo
      session.modelSpeaking = true;
      if (session.modelSpeakingTimeout) {
        clearTimeout(session.modelSpeakingTimeout);
        session.modelSpeakingTimeout = null;
      }

      // Decode base64 to binary buffer, send as binary frame
      const buffer = Buffer.from(base64Pcm24, "base64");
      if (session.clientWs.readyState === session.clientWs.OPEN) {
        session.clientWs.send(buffer);
      }
    },

    onInputTranscription: (text: string, finished: boolean) => {
      const session = getActiveSession(sessionId);
      if (!session) return;

      inputTranscriptCount++;
      // Log ALL input transcriptions to debug delays
      console.log(
        `[Gemini] InputTranscription #${inputTranscriptCount}: "${text.slice(0, 50)}..." finished=${finished}`
      );

      session.pendingUserText += text;

      // Flush if API sends finished flag (may or may not happen per API version)
      if (finished) {
        console.log(`[Gemini] User speech finished, flushing transcription`);
        flushPendingUserText(sessionId);
      }
    },

    onOutputTranscription: (text: string, finished: boolean) => {
      const session = getActiveSession(sessionId);
      if (!session) return;

      outputTranscriptCount++;
      if (outputTranscriptCount <= 5) {
        console.log(
          `[Gemini] OutputTranscription #${outputTranscriptCount}: "${text}" finished=${finished}`
        );
      }

      // When model starts outputting text, flush any pending user text first
      // (the user finished speaking and now the model is responding)
      if (session.pendingUserText.trim()) {
        flushPendingUserText(sessionId);
      }

      session.pendingModelText += text;

      // Send real-time partial transcription to client
      const partialEntry: TranscriptEntry = {
        role: "model",
        text: session.pendingModelText,
        timestamp: Date.now() - session.startedAt,
        partial: true,
      };
      sendToClient(session.clientWs, { type: "transcript", entry: partialEntry });

      // Flush if API sends finished flag
      if (finished) {
        flushPendingModelText(sessionId);
      }
    },

    onInterrupted: () => {
      const session = getActiveSession(sessionId);
      if (!session) return;

      // User interrupted — immediately ungate mic audio
      session.modelSpeaking = false;
      if (session.modelSpeakingTimeout) {
        clearTimeout(session.modelSpeakingTimeout);
        session.modelSpeakingTimeout = null;
      }

      // Flush any partial model text before clearing
      flushPendingModelText(sessionId);
      session.pendingModelText = "";

      // Discard partial audio/video for this interrupted turn
      session.currentTurnAudioChunks = [];
      session.currentTurnVideoSnapshots = [];

      sendToClient(session.clientWs, { type: "interrupt" });
    },

    onTurnComplete: () => {
      const session = getActiveSession(sessionId);
      if (!session) return;

      // Flush any remaining pending transcription text
      // This is the primary flush mechanism per Google's recommendation:
      // buffer streaming chunks and flush on turnComplete
      flushPendingUserText(sessionId);
      flushPendingModelText(sessionId);

      // Model finished speaking — ungate mic after a short delay
      // to let residual echo from speakers die down
      if (session.modelSpeakingTimeout) {
        clearTimeout(session.modelSpeakingTimeout);
      }
      console.log(`[WS] AI finished speaking, will lift audio gate in 300ms`);
      session.modelSpeakingTimeout = setTimeout(() => {
        session.modelSpeaking = false;
        session.modelSpeakingTimeout = null;
        console.log(`[WS] Audio gate LIFTED for session ${sessionId}`);
      }, 300);

      sendToClient(session.clientWs, { type: "turnComplete" });
    },

    onGoAway: (timeLeftMs: number) => {
      const session = getActiveSession(sessionId);
      if (!session) return;

      console.log(
        `[Gemini] GoAway for session ${sessionId}, ${timeLeftMs}ms remaining`
      );

      if (session.resumptionHandle) {
        attemptReconnect(sessionId, session.resumptionHandle);
      } else {
        console.warn("[Gemini] No resumption handle available");
      }
    },

    onSessionResumptionUpdate: (handle: string, resumable: boolean) => {
      const session = getActiveSession(sessionId);
      if (!session) return;

      if (resumable) {
        session.resumptionHandle = handle;
      }
    },

    onError: (error: Error) => {
      const session = getActiveSession(sessionId);
      if (!session) return;

      console.error(`[Gemini] Error for session ${sessionId}:`, error);
      sendToClient(session.clientWs, {
        type: "error",
        message: "AI connection error",
      });

      if (session.resumptionHandle && session.status === "live") {
        attemptReconnect(sessionId, session.resumptionHandle);
      } else {
        cleanupSession(sessionId, "ERROR");
      }
    },

    onClose: () => {
      const session = getActiveSession(sessionId);
      if (!session) return;

      // Expected close during cleanup or already reconnecting
      if (session.status === "ending" || session.status === "closed" || session.status === "reconnecting") {
        console.log(`[Gemini] Connection closed (expected, status=${session.status}) for session ${sessionId}`);
        return;
      }

      console.log(
        `[Gemini] Unexpected close for session ${sessionId}`
      );

      if (session.resumptionHandle) {
        attemptReconnect(sessionId, session.resumptionHandle);
      } else {
        cleanupSession(sessionId, "ERROR");
      }
    },
  };
}

async function attemptReconnect(
  sessionId: string,
  handle: string
): Promise<void> {
  const session = getActiveSession(sessionId);
  if (!session) return;

  // Prevent duplicate reconnects (GoAway + onClose both fire)
  if (session.status === "reconnecting" || session.status === "ending" || session.status === "closed") {
    console.log(`[Gemini] Skipping reconnect — session ${sessionId} already ${session.status}`);
    return;
  }

  session.status = "reconnecting";
  console.log(`[Gemini] Attempting reconnect for session ${sessionId}`);

  // Close old Gemini session
  if (session.geminiSession) {
    closeGeminiSession(session.geminiSession);
    session.geminiSession = null;
  }

  try {
    const dbSession = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });
    if (!dbSession) throw new Error("Session not found in DB");

    const systemPrompt = buildSystemPrompt(session.persona, {
      jobTitle: dbSession.jobTitle,
      companyName: dbSession.companyName,
      interviewType: dbSession.interviewType as InterviewType,
    });
    const contextMsg = buildContextMessage({
      jobTitle: dbSession.jobTitle,
      companyName: dbSession.companyName,
      jobDescription: dbSession.jobDescription,
      cvContent: dbSession.cvContent ?? undefined,
    });

    const geminiCallbacks = buildGeminiCallbacks(sessionId);
    const newGeminiSession = await connectToGemini({
      systemPrompt,
      voiceName: session.persona.voiceName,
      resumptionHandle: handle,
      callbacks: geminiCallbacks,
    });

    session.geminiSession = newGeminiSession;
    sendContextToGemini(newGeminiSession, contextMsg);
    // onSetupComplete will fire and set status back to "live"
  } catch (err) {
    console.error(
      `[Gemini] Reconnect failed for session ${sessionId}:`,
      err
    );
    sendToClient(session.clientWs, {
      type: "error",
      message: "Reconnection failed",
    });
    cleanupSession(sessionId, "ERROR");
  }
}

async function cleanupSession(
  sessionId: string,
  finalStatus: "COMPLETED" | "ERROR"
): Promise<void> {
  const session = getActiveSession(sessionId);
  if (!session || session.status === "closed") return;

  session.status = "ending";
  console.log(
    `[WS] Cleaning up session ${sessionId} → ${finalStatus}`
  );

  // Clear audio gate timeout
  if (session.modelSpeakingTimeout) {
    clearTimeout(session.modelSpeakingTimeout);
    session.modelSpeakingTimeout = null;
  }

  // Close Gemini connection
  if (session.geminiSession) {
    closeGeminiSession(session.geminiSession);
    session.geminiSession = null;
  }

  // Flush any remaining pending transcription text before saving
  flushPendingUserText(sessionId);
  flushPendingModelText(sessionId);

  // Score the last Q&A pair if it wasn't captured by the normal turn detection
  // (session ended before model could ask the next question)
  const t = session.transcript;
  if (t.length >= 2) {
    const last = t[t.length - 1];
    const prev = t[t.length - 2];
    if (
      last.role === "user" &&
      prev.role === "model" &&
      prev.text.includes("?") &&
      session.currentTurnAudioChunks.length > 0
    ) {
      const qi = session.currentQuestionIndex;
      const media = {
        questionIndex: qi,
        question: prev.text,
        answerText: last.text,
        audioPcmChunks: [...session.currentTurnAudioChunks],
        videoSnapshots: [...session.currentTurnVideoSnapshots],
      };
      session.currentTurnAudioChunks = [];
      session.currentTurnVideoSnapshots = [];

      scoreQuestion(sessionId, media, session.scoringContext).catch((err) =>
        console.error(`[Scoring] Q${qi} (cleanup) failed:`, err)
      );
    }
  }

  // Save transcript to DB
  try {
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: finalStatus,
        endedAt: new Date(),
        transcript: JSON.stringify(session.transcript),
      },
    });
    console.log(
      `[DB] Session ${sessionId} saved with ${session.transcript.length} transcript entries`
    );
  } catch (err) {
    console.error(`[DB] Failed to save session ${sessionId}:`, err);
  }

  // Notify client
  sendToClient(session.clientWs, { type: "status", status: finalStatus });

  // Close client WS
  if (session.clientWs.readyState === session.clientWs.OPEN) {
    session.clientWs.close(1000, finalStatus);
  }

  session.status = "closed";
  deleteActiveSession(sessionId);
}
