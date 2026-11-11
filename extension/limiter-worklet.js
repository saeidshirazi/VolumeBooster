import { LookaheadLimiter } from './limiter-core.js';

class VolumeBoosterLimiter extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'protection', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' }]; }
  constructor() {
    super();
    this.limiter = new LookaheadLimiter(sampleRate);
    this.port.onmessage = event => {
      if (event.data?.type === 'meter') this.port.postMessage(this.limiter.meter());
      if (event.data?.type === 'meter' || event.data?.type === 'reset-meter') this.limiter.resetMeter();
    };
  }
  process(inputs, outputs, parameters) {
    this.limiter.process(inputs[0] || [], outputs[0] || [], parameters.protection[0] >= 0.5);
    return true;
  }
}
registerProcessor('volumebooster-limiter', VolumeBoosterLimiter);
