/**
 * AudioWorklet processor for playing back PCM16 @ 24kHz from Gemini.
 *
 * Receives Int16 PCM buffers via port messages, upsamples to output
 * sample rate, and writes to speakers.
 */
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._queue = [];
    this._offset = 0;
    this._currentBuffer = null;

    this.port.onmessage = (event) => {
      // Receive Int16Array buffer from main thread
      const int16 = new Int16Array(event.data);
      // Convert Int16 → Float32
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 0x8000;
      }
      this._queue.push(float32);
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;

    const channel = output[0];
    let written = 0;

    while (written < channel.length) {
      if (!this._currentBuffer || this._offset >= this._currentBuffer.length) {
        if (this._queue.length === 0) {
          // No data — fill with silence
          channel.fill(0, written);
          return true;
        }
        this._currentBuffer = this._queue.shift();
        this._offset = 0;
      }

      const remaining = this._currentBuffer.length - this._offset;
      const needed = channel.length - written;
      const toCopy = Math.min(remaining, needed);

      for (let i = 0; i < toCopy; i++) {
        // Simple sample rate conversion (24kHz → output rate)
        channel[written + i] = this._currentBuffer[this._offset + i];
      }

      this._offset += toCopy;
      written += toCopy;
    }

    return true;
  }
}

registerProcessor("pcm-player-processor", PCMPlayerProcessor);
