/**
 * AudioWorklet processor for recording mic input as PCM16 @ 16kHz.
 *
 * Matches Google's official live-api-web-console implementation:
 * - Pre-allocated Int16Array(2048) buffer
 * - Sends ~8 times/second at 16kHz (every 128ms)
 * - AudioContext should be created at 16kHz so browser handles resampling
 */
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Int16Array(2048);
    this._writeIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // mono

    for (let i = 0; i < channelData.length; i++) {
      // Float32 → Int16 (Int16Array auto-clamps)
      this._buffer[this._writeIndex++] = channelData[i] * 32768;

      if (this._writeIndex >= this._buffer.length) {
        // Send a copy (slice creates new backing ArrayBuffer)
        const chunk = this._buffer.slice(0, this._writeIndex);
        this.port.postMessage(chunk.buffer, [chunk.buffer]);
        this._writeIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor("pcm-recorder-processor", PCMRecorderProcessor);
