import {
  GoogleGenAI,
  Modality,
  type Session,
  type LiveServerMessage,
} from "@google/genai";
import { env } from "../config/env.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export interface GeminiLiveCallbacks {
  onSetupComplete: () => void;
  onAudioData: (base64Pcm24: string) => void;
  onInputTranscription: (text: string, finished: boolean) => void;
  onOutputTranscription: (text: string, finished: boolean) => void;
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onGoAway: (timeLeftMs: number) => void;
  onSessionResumptionUpdate: (handle: string, resumable: boolean) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export async function connectToGemini(opts: {
  systemPrompt: string;
  voiceName: string;
  resumptionHandle?: string;
  callbacks: GeminiLiveCallbacks;
}): Promise<Session> {
  const session = await ai.live.connect({
    model: "gemini-2.5-flash-native-audio-preview-12-2025",
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: opts.voiceName },
        },
      },
      systemInstruction: { parts: [{ text: opts.systemPrompt }] },
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
          endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",
        },
        activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      sessionResumption: opts.resumptionHandle
        ? { handle: opts.resumptionHandle }
        : {},
      contextWindowCompression: {
        slidingWindow: {},
        triggerTokens: 100000,
      },
    },
    callbacks: {
      onopen: () => {
        console.log("[Gemini] Connection opened");
      },
      onmessage: (msg: LiveServerMessage) => {
        handleGeminiMessage(msg, opts.callbacks);
      },
      onerror: (e: ErrorEvent) => {
        console.error("[Gemini] Error:", e.message);
        opts.callbacks.onError(new Error(e.message ?? "Gemini WebSocket error"));
      },
      onclose: (e: CloseEvent) => {
        console.log(`[Gemini] Connection closed (code: ${e.code}, reason: ${e.reason || "none"})`);
        opts.callbacks.onClose();
      },
    },
  });

  return session;
}

function handleGeminiMessage(
  msg: LiveServerMessage,
  cb: GeminiLiveCallbacks
): void {
  // Setup complete
  if (msg.setupComplete) {
    cb.onSetupComplete();
    return;
  }

  // GoAway — connection expiring
  if (msg.goAway) {
    const timeLeftStr = msg.goAway.timeLeft ?? "0s";
    const seconds = parseInt(timeLeftStr.replace("s", ""), 10) || 0;
    cb.onGoAway(seconds * 1000);
    return;
  }

  // Session resumption handle
  if (msg.sessionResumptionUpdate) {
    const update = msg.sessionResumptionUpdate;
    if (update.newHandle) {
      cb.onSessionResumptionUpdate(
        update.newHandle,
        update.resumable ?? false
      );
    }
    return;
  }

  // Server content (audio, transcriptions, turn events)
  const content = msg.serverContent;
  if (!content) return;

  // Audio data from model
  if (content.modelTurn?.parts) {
    for (const part of content.modelTurn.parts) {
      if (
        part.inlineData?.data &&
        part.inlineData.mimeType?.startsWith("audio/")
      ) {
        cb.onAudioData(part.inlineData.data);
      }
    }
  }

  // Input transcription (what user said)
  if (content.inputTranscription?.text !== undefined) {
    cb.onInputTranscription(
      content.inputTranscription.text,
      content.inputTranscription.finished ?? false
    );
  }

  // Output transcription (what model said)
  if (content.outputTranscription?.text !== undefined) {
    cb.onOutputTranscription(
      content.outputTranscription.text,
      content.outputTranscription.finished ?? false
    );
  }

  // Interrupted by user
  if (content.interrupted) {
    cb.onInterrupted();
  }

  // Model finished speaking
  if (content.turnComplete) {
    cb.onTurnComplete();
  }
}

export function sendAudioToGemini(
  session: Session,
  pcm16Base64: string
): void {
  session.sendRealtimeInput({
    audio: {
      data: pcm16Base64,
      mimeType: "audio/pcm;rate=16000",
    },
  });
}

export function sendVideoToGemini(
  session: Session,
  jpegBase64: string
): void {
  session.sendRealtimeInput({
    video: {
      data: jpegBase64,
      mimeType: "image/jpeg",
    },
  });
}

export function closeGeminiSession(session: Session): void {
  try {
    session.close();
  } catch (err) {
    console.error("[Gemini] Error closing session:", err);
  }
}
