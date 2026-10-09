// Capture mono PCM in 100ms chunks. Resample the device's actual sample rate,
// rather than assuming getUserMedia honors its requested sample rate.
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new ArrayBuffer(1600 * 2);
    this.view = new DataView(this.chunk);
    this.count = 0;
    this.phase = 0;
    this.sum = 0;
    this.samples = 0;
    this.stopped = false;
    this.port.onmessage = ({ data }) => {
      if (data === "stop") {
        this.stopped = true;
        this.flush();
        this.port.postMessage({ stopped: true });
      }
    };
  }

  flush() {
    if (!this.count) return;
    const pcm = this.chunk.slice(0, this.count * 2);
    this.port.postMessage({ pcm }, [pcm]);
    this.count = 0;
  }

  process(inputs) {
    if (this.stopped) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let mono = 0;
      for (const channel of channels) mono += channel[i] / channels.length;
      this.sum += mono;
      this.samples++;
      this.phase += 16000;
      while (this.phase >= sampleRate) {
        this.phase -= sampleRate;
        const sample = Math.max(-1, Math.min(1, this.sum / this.samples));
        this.view.setInt16(this.count * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
        this.count++;
        if (this.count === 1600) this.flush();
      }
      if (this.phase < 16000) {
        this.sum = 0;
        this.samples = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-capture", PcmCapture);
