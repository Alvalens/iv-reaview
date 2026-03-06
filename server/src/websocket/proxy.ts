import type { WebSocket } from "ws";
import { prisma } from "../db/prisma.js";
import { buildSystemPrompt } from "../services/persona-generator.js";
import {
  connectToGemini,
  sendAudioToGemini,
  sendVideoToGemini,
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

  // Build system prompt from persona + job context
  const persona: PersonaConfig = JSON.parse(dbSession.personaConfig);
  const systemPrompt = buildSystemPrompt(persona, {
    jobTitle: dbSession.jobTitle,
    companyName: dbSession.companyName,
    jobDescription: dbSession.jobDescription,
    interviewType: dbSession.interviewType as InterviewType,
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

  ws.on("message", (data, isBinary) => {
    const session = getActiveSession(sessionId);
    if (!session?.geminiSession || session.status !== "live") return;

    if (isBinary) {
      // Binary frame = raw PCM16 audio from client mic
      const buffer = data as Buffer;
      audioChunkCount++;
      audioByteTotal += buffer.length;

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

      // Log first 3 chunks and then every 5 seconds
      const now = Date.now();
      if (audioChunkCount <= 3 || now - lastAudioLogTime > 5000) {
        console.log(
          `[WS] Audio chunk #${audioChunkCount} from client: ${buffer.length} bytes (total: ${audioByteTotal} bytes)`
        );
        lastAudioLogTime = now;
      }

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
      sendVideoToGemini(session.geminiSession, msg.data);
      break;

    case "control":
      if (msg.action === "end") {
        console.log(`[WS] Client requested end for session ${sessionId}`);
        cleanupSession(sessionId, "COMPLETED");
      }
      break;
  }
}

function buildGeminiCallbacks(sessionId: string): GeminiLiveCallbacks {
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

      session.pendingUserText += text;

      if (finished && session.pendingUserText.trim()) {
        const entry: TranscriptEntry = {
          role: "user",
          text: session.pendingUserText.trim(),
          timestamp: Date.now() - session.startedAt,
        };
        session.transcript.push(entry);
        sendToClient(session.clientWs, { type: "transcript", entry });
        session.pendingUserText = "";
      }
    },

    onOutputTranscription: (text: string, finished: boolean) => {
      const session = getActiveSession(sessionId);
      if (!session) return;

      session.pendingModelText += text;

      if (finished && session.pendingModelText.trim()) {
        const fullText = session.pendingModelText.trim();
        const entry: TranscriptEntry = {
          role: "model",
          text: fullText,
          timestamp: Date.now() - session.startedAt,
        };
        session.transcript.push(entry);
        sendToClient(session.clientWs, { type: "transcript", entry });
        session.pendingModelText = "";

        // Check for end keyword
        if (fullText.includes("END_INTERVIEW")) {
          console.log(
            `[Gemini] END_INTERVIEW detected for session ${sessionId}`
          );
          cleanupSession(sessionId, "COMPLETED");
        }
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

      session.pendingModelText = "";
      sendToClient(session.clientWs, { type: "interrupt" });
    },

    onTurnComplete: () => {
      const session = getActiveSession(sessionId);
      if (!session) return;

      // Model finished speaking — ungate mic after a short delay
      // to let residual echo from speakers die down
      if (session.modelSpeakingTimeout) {
        clearTimeout(session.modelSpeakingTimeout);
      }
      session.modelSpeakingTimeout = setTimeout(() => {
        session.modelSpeaking = false;
        session.modelSpeakingTimeout = null;
        console.log(`[WS] Audio gate lifted for session ${sessionId}`);
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

      // Expected close during cleanup
      if (session.status === "ending" || session.status === "closed") return;

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
      jobDescription: dbSession.jobDescription,
      interviewType: dbSession.interviewType as InterviewType,
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
