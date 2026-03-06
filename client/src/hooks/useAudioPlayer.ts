import { useCallback, useRef } from "react";

export function useAudioPlayer() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);

  const init = useCallback(async () => {
    if (audioCtxRef.current) return;

    const audioCtx = new AudioContext({ sampleRate: 24000 });
    audioCtxRef.current = audioCtx;

    await audioCtx.audioWorklet.addModule("/pcm-player-processor.js");

    const workletNode = new AudioWorkletNode(audioCtx, "pcm-player-processor");
    workletNodeRef.current = workletNode;

    workletNode.connect(audioCtx.destination);
  }, []);

  const play = useCallback((pcm16Data: ArrayBuffer) => {
    const node = workletNodeRef.current;
    if (!node) return;
    // Transfer the buffer to the worklet for zero-copy
    node.port.postMessage(pcm16Data, [pcm16Data]);
  }, []);

  const clear = useCallback(() => {
    const node = workletNodeRef.current;
    if (!node) return;
    node.port.postMessage("clear");
  }, []);

  const stop = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  return { init, play, clear, stop };
}
