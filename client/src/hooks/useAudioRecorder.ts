import { useCallback, useRef, useState } from "react";

interface UseAudioRecorderOptions {
  onAudioData: (pcm16: ArrayBuffer) => void;
}

export function useAudioRecorder({ onAudioData }: UseAudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const start = useCallback(async () => {
    if (audioCtxRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.current = stream;

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    await audioCtx.audioWorklet.addModule("/pcm-recorder-processor.js");

    const source = audioCtx.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(audioCtx, "pcm-recorder-processor");
    workletNodeRef.current = workletNode;

    workletNode.port.onmessage = (event: MessageEvent) => {
      onAudioDataRef.current(event.data as ArrayBuffer);
    };

    source.connect(workletNode);
    // Connect to destination to keep the audio graph alive
    workletNode.connect(audioCtx.destination);

    setIsRecording(true);
    setIsMuted(false);
  }, []);

  const stop = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsRecording(false);
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }, []);

  return { start, stop, isRecording, isMuted, toggleMute };
}
