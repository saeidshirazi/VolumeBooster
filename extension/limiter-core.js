// Sample-peak look-ahead limiter. Shared by the worklet and numerical tests.
export class LookaheadLimiter {
  constructor(rate, ceiling = 0.98) {
    this.delay = Math.max(1, Math.round(rate * 0.005));
    this.length = this.delay + 1;
    this.ceiling = ceiling;
    this.release = Math.exp(-1 / (rate * 0.08));
    this.buffers = [];
    this.peakValues = new Float64Array(this.length + 1);
    this.peakIndices = new Float64Array(this.length + 1);
    this.head = 0; this.tail = 0; this.position = 0; this.frame = 0; this.gain = 1;
    this.resetMeter();
  }
  resetMeter() { this.inputPeak = 0; this.outputPeak = 0; this.minGain = 1; }
  meter() { return { inputPeak: this.inputPeak, outputPeak: this.outputPeak, reductionDb: Math.max(0, -20 * Math.log10(Math.max(this.minGain, 1e-12))) }; }
  process(input, output, enabled = true) {
    const channels = output.length;
    if (!channels) return;
    if (this.buffers.length !== channels) {
      this.buffers = Array.from({ length: channels }, () => new Float32Array(this.length));
      this.head = this.tail = this.position = this.frame = 0; this.gain = 1;
    }
    const capacity = this.peakValues.length;
    for (let i = 0; i < output[0].length; i++) {
      let peak = 0;
      for (let channel = 0; channel < channels; channel++) {
        const sample = (input[channel] || input[0])?.[i] || 0;
        const finite = Number.isFinite(sample) ? sample : 0;
        this.buffers[channel][this.position] = finite;
        peak = Math.max(peak, Math.abs(finite));
      }
      const cutoff = this.frame - this.delay;
      while (this.head < this.tail && this.peakIndices[this.head % capacity] < cutoff) this.head++;
      while (this.tail > this.head && this.peakValues[(this.tail - 1) % capacity] <= peak) this.tail--;
      this.peakValues[this.tail % capacity] = peak; this.peakIndices[this.tail % capacity] = this.frame; this.tail++;
      const maximum = this.peakValues[this.head % capacity];
      const target = enabled && maximum > this.ceiling ? this.ceiling / maximum : 1;
      this.gain = !enabled || target < this.gain ? target : target + (this.gain - target) * this.release;
      const read = (this.position + 1) % this.length;
      for (let channel = 0; channel < channels; channel++) {
        const delayed = this.buffers[channel][read] * this.gain;
        const sample = enabled ? Math.min(this.ceiling, Math.max(-this.ceiling, delayed)) : delayed;
        output[channel][i] = sample;
        this.outputPeak = Math.max(this.outputPeak, Math.abs(sample));
      }
      this.inputPeak = Math.max(this.inputPeak, peak); this.minGain = Math.min(this.minGain, this.gain);
      this.position = read; this.frame++;
    }
  }
}
