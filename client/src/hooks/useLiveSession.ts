import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionStatus, TranscriptEntry } from "@/lib/types";

/**
 * AudioStreamer — ported from Google's official live-api-web-console.
 * Buffers incoming PCM16 24kHz audio and schedules precise playback.
 *
 * Key design choices (matching official):
 * - 7680-sample buffer size (~320ms at 24kHz)
 * - 100ms initial buffer before first playback
 * - 200ms schedule-ahead time
 * - GainNode for smooth fade-out on stop
 * - setInterval(100ms) when queue is empty, setTimeout when queue has items
 * - isStreamComplete flag to distinguish "waiting for more" vs "done"
 */
class AudioStreamer {
  private ctx: AudioContext;
  private gainNode: GainNode;
  private queue: Float32Array[] = [];
  private isPlaying = false;
  private isStreamComplete = false;
  private scheduledTime = 0;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private endOfQueueSource: AudioBufferSourceNode | null = null;

  private readonly SAMPLE_RATE = 24000;
  private readonly BUFFER_SIZE = 7680;
  private readonly SCHEDULE_AHEAD_TIME = 0.2;
  private readonly INITIAL_BUFFER_TIME = 0.1;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);
  }

  addPCM16(pcm16Data: ArrayBuffer): void {
    this.isStreamComplete = false;

    // Little-endian PCM16 → Float32 (matching official DataView approach)
    const view = new DataView(pcm16Data);
    const numSamples = pcm16Data.byteLength / 2;
    const float32 = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      float32[i] = view.getInt16(i * 2, true) / 32768;
    }

    // Split into manageable chunks
    let buf = float32;
    while (buf.length >= this.BUFFER_SIZE) {
      this.queue.push(buf.slice(0, this.BUFFER_SIZE));
      buf = buf.slice(this.BUFFER_SIZE);
    }
    if (buf.length > 0) {
      this.queue.push(buf);
    }

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.scheduledTime = this.ctx.currentTime + this.INITIAL_BUFFER_TIME;
      this.scheduleNextBuffer();
    }
  }

  private scheduleNextBuffer(): void {
    const SCHEDULE_AHEAD = this.SCHEDULE_AHEAD_TIME;

    while (
      this.queue.length > 0 &&
      this.scheduledTime < this.ctx.currentTime + SCHEDULE_AHEAD
    ) {
      const audioData = this.queue.shift()!;
      const audioBuffer = this.ctx.createBuffer(
        1,
        audioData.length,
        this.SAMPLE_RATE
      );
      audioBuffer.getChannelData(0).set(audioData);

      const source = this.ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode);

      // Track end-of-queue source for onComplete detection (matching official)
      if (this.queue.length === 0) {
        if (this.endOfQueueSource) {
          this.endOfQueueSource.onended = null;
        }
        this.endOfQueueSource = source;
        source.onended = () => {
          if (!this.queue.length && this.endOfQueueSource === source) {
            this.endOfQueueSource = null;
          }
        };
      }

      const startTime = Math.max(this.scheduledTime, this.ctx.currentTime);
      source.start(startTime);
      this.scheduledTime = startTime + audioBuffer.duration;
    }

    // Re-scheduling logic (matching official exactly)
    if (this.queue.length === 0) {
      if (this.isStreamComplete) {
        this.isPlaying = false;
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = null;
        }
      } else {
        // Queue empty but stream not complete — poll for new data
        if (!this.checkInterval) {
          this.checkInterval = setInterval(() => {
            if (this.queue.length > 0) {
              this.scheduleNextBuffer();
            }
          }, 100);
        }
      }
    } else {
      // Queue still has items — schedule check when current audio ends
      const nextCheckTime =
        (this.scheduledTime - this.ctx.currentTime) * 1000;
      setTimeout(
        () => this.scheduleNextBuffer(),
        Math.max(0, nextCheckTime - 50)
      );
    }
  }

  /** Stop playback (used on interrupt — matches official demo's interrupt handler) */
  stop(): void {
    this.isPlaying = false;
    this.isStreamComplete = true;
    this.queue = [];
    this.scheduledTime = this.ctx.currentTime;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Fade out to avoid click, then recreate GainNode (matching official)
    this.gainNode.gain.linearRampToValueAtTime(
      0,
      this.ctx.currentTime + 0.1
    );
    setTimeout(() => {
      if (this.ctx.state !== "closed") {
        this.gainNode.disconnect();
        this.gainNode = this.ctx.createGain();
        this.gainNode.connect(this.ctx.destination);
      }
    }, 200);
  }

  /** Resume after suspend (matching official) */
  async resume(): Promise<void> {
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    this.isStreamComplete = false;
    this.scheduledTime = this.ctx.currentTime + this.INITIAL_BUFFER_TIME;
    this.gainNode.gain.setValueAtTime(1, this.ctx.currentTime);
  }

  /** Full teardown */
  destroy(): void {
    this.stop();
    setTimeout(() => {
      this.ctx.close().catch(() => {});
    }, 300);
  }
}

export function useLiveSession(sessionId: string) {
  const [status, setStatus] = useState<SessionStatus>("CREATED");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Recorder refs — store all audio nodes to prevent GC
  const recorderCtxRef = useRef<AudioContext | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recorderWorkletRef = useRef<AudioWorkletNode | null>(null);

  // Player ref
  const streamerRef = useRef<AudioStreamer | null>(null);

  const endSession = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "control", action: "end" }));
    }
  }, []);

  const toggleMute = useCallback(() => {
    const stream = recorderStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${location.host}/ws/interview/${sessionId}`;
    console.log("[LiveSession] Connecting to", wsUrl);

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    // --- RECORDER (matching official Google demo) ---
    let audioChunkCount = 0;

    async function startRecorder() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        recorderStreamRef.current = stream;

        // Create context at 16kHz — browser handles resampling (matching official)
        const ctx = new AudioContext({ sampleRate: 16000 });
        recorderCtxRef.current = ctx;

        // Ensure context is running (can be suspended without user gesture)
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        console.log(
          "[LiveSession] Recorder AudioContext created, actual sampleRate:",
          ctx.sampleRate,
          "state:",
          ctx.state
        );

        await ctx.audioWorklet.addModule("/pcm-recorder-processor.js");
        if (cancelled) return;

        const source = ctx.createMediaStreamSource(stream);
        const worklet = new AudioWorkletNode(
          ctx,
          "pcm-recorder-processor"
        );

        // Store refs to prevent garbage collection of audio nodes
        recorderSourceRef.current = source;
        recorderWorkletRef.current = worklet;

        worklet.port.onmessage = (event: MessageEvent) => {
          const currentWs = wsRef.current;
          if (currentWs && currentWs.readyState === WebSocket.OPEN) {
            const buf = event.data as ArrayBuffer;
            currentWs.send(buf);

            // Log periodically to verify audio keeps flowing
            audioChunkCount++;
            if (
              audioChunkCount <= 3 ||
              audioChunkCount % 50 === 0 // ~every 6.4s at 16kHz/2048
            ) {
              console.log(
                `[LiveSession] Audio chunk #${audioChunkCount}, size: ${buf.byteLength} bytes`
              );
            }
          }
        };

        source.connect(worklet);
        // Do NOT connect worklet to destination — prevents echo
        console.log("[LiveSession] Recorder started successfully");
      } catch (err) {
        console.error("[LiveSession] Recorder failed:", err);
      }
    }

    // --- PLAYER (AudioStreamer — matching official Google demo) ---
    async function initPlayer() {
      if (streamerRef.current) return;
      const ctx = new AudioContext();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      streamerRef.current = new AudioStreamer(ctx);
      console.log(
        "[LiveSession] Player initialized, sampleRate:",
        ctx.sampleRate
      );
    }

    // --- WS MESSAGE HANDLERS ---
    ws.onmessage = async (event: MessageEvent) => {
      if (cancelled) return;

      if (event.data instanceof ArrayBuffer) {
        streamerRef.current?.addPCM16(event.data);
        return;
      }

      try {
        const msg = JSON.parse(event.data as string);
        switch (msg.type) {
          case "status":
            console.log("[LiveSession] Status:", msg.status);
            setStatus(msg.status as SessionStatus);
            if (msg.status === "LIVE") {
              await initPlayer();
              await startRecorder();
              startTimeRef.current = Date.now();
              timerRef.current = setInterval(() => {
                setElapsedMs(Date.now() - startTimeRef.current);
              }, 1000);
            }
            if (msg.status === "COMPLETED" || msg.status === "ERROR") {
              cleanup();
            }
            break;
          case "transcript":
            setTranscript((prev) => [
              ...prev,
              msg.entry as TranscriptEntry,
            ]);
            break;
          case "interrupt":
            // Matching official demo: call stop() on interrupt
            // addPCM16() will auto-restart playback when new audio arrives
            streamerRef.current?.stop();
            break;
          case "error":
            console.error("[LiveSession] Error:", msg.message);
            setError(msg.message as string);
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      console.log("[LiveSession] WS closed");
    };

    ws.onerror = () => {
      console.error("[LiveSession] WS error");
      setError("WebSocket connection error");
    };

    function cleanup() {
      cancelled = true;

      // Timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Recorder — disconnect nodes before closing context
      if (recorderSourceRef.current) {
        recorderSourceRef.current.disconnect();
        recorderSourceRef.current = null;
      }
      if (recorderWorkletRef.current) {
        recorderWorkletRef.current.disconnect();
        recorderWorkletRef.current = null;
      }
      if (recorderStreamRef.current) {
        recorderStreamRef.current.getTracks().forEach((t) => t.stop());
        recorderStreamRef.current = null;
      }
      if (recorderCtxRef.current) {
        recorderCtxRef.current.close().catch(() => {});
        recorderCtxRef.current = null;
      }

      // Player
      if (streamerRef.current) {
        streamerRef.current.destroy();
        streamerRef.current = null;
      }

      // WS
      const currentWs = wsRef.current;
      if (currentWs && currentWs.readyState === WebSocket.OPEN) {
        currentWs.close();
      }
      wsRef.current = null;
    }

    return cleanup;
  }, [sessionId]);

  return {
    status,
    transcript,
    error,
    isMuted,
    toggleMute,
    endSession,
    elapsedMs,
  };
}
