/**
 * AudioWorklet processor for recording mic input as PCM16 @ 16kHz.
 *
 * Receives Float32 audio from getUserMedia (typically 48kHz),
 * downsamples to 16kHz, converts to Int16, and posts to main thread.
 */
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 2048; // frames to accumulate before sending
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // mono

    // Downsample from sampleRate to 16kHz
    const ratio = sampleRate / 16000;
    for (let i = 0; i < channelData.length; i += ratio) {
      const idx = Math.floor(i);
      if (idx < channelData.length) {
        // Float32 → Int16
        const s = Math.max(-1, Math.min(1, channelData[idx]));
        this._buffer.push(s < 0 ? s * 0x8000 : s * 0x7fff);
      }
    }

    if (this._buffer.length >= this._bufferSize) {
      const pcm16 = new Int16Array(this._buffer);
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
      this._buffer = [];
    }

    return true;
  }
}

registerProcessor("pcm-recorder-processor", PCMRecorderProcessor);
