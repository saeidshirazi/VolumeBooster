// One output graph mixes all selected media before limiting. Classic script so
// the same bundled implementation runs in MAIN world and the offscreen page.
(() => {
  if (globalThis.__volumeBoosterOutputFactory_v1) return;
  globalThis.__volumeBoosterOutputFactory_v1 = async (context, workletURL) => {
    const gain = context.createGain(), input = context.createAnalyser(), output = context.createAnalyser();
    input.fftSize = output.fftSize = 1024;
    let processor, mode = 'lookahead', enabled = true, cached = {}, meterStarted = false, lastMeter = -1;
    const nodes = [gain, input, output];
    try {
      if (!context.audioWorklet || !workletURL) throw new Error('Worklets are unavailable.');
      let timer;
      try {
        await Promise.race([
          context.audioWorklet.addModule(workletURL),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Audio processor loading timed out.')), 3000); })
        ]);
      } finally { clearTimeout(timer); }
      processor = new AudioWorkletNode(context, 'volumebooster-limiter');
      processor.port.onmessage = event => { cached = event.data; };
      nodes.push(processor);
      input.connect(processor); processor.connect(output);
    } catch {
      // CSP and older implementations may prevent loading a worklet in a page.
      // A transparent-centre soft ceiling keeps playback and bounds output.
      mode = 'ceiling';
      const headroom = context.createGain(), soft = context.createWaveShaper(), ceiling = context.createWaveShaper();
      headroom.gain.value = 1 / 8;
      const curve = new Float32Array(65537), final = new Float32Array(65537);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1, amplitude = Math.abs(x * 8);
        curve[i] = Math.sign(x) * (amplitude <= 0.85 ? amplitude : 0.85 + 0.13 * Math.tanh((amplitude - 0.85) / 0.13));
        final[i] = Math.max(-0.98, Math.min(0.98, x));
      }
      soft.curve = curve; soft.oversample = '4x'; ceiling.curve = final;
      input.connect(headroom); headroom.connect(soft); soft.connect(ceiling); ceiling.connect(output);
      processor = { headroom, soft, ceiling }; nodes.push(headroom, soft, ceiling);
    }
    gain.connect(input); output.connect(context.destination);
    const samples = new Float32Array(1024);
    function sample(analyser) {
      analyser.getFloatTimeDomainData(samples);
      let peak = 0, sum = 0;
      for (const value of samples) { peak = Math.max(peak, Math.abs(value)); sum += value * value; }
      return { peak, rms: Math.sqrt(sum / samples.length) };
    }
    return {
      gain, mode,
      setVolume(volume, muted = false) {
        gain.gain.cancelScheduledValues(context.currentTime);
        gain.gain.setTargetAtTime(muted ? 0 : volume / 100, context.currentTime, 0.025);
      },
      setProtection(value) {
        enabled = Boolean(value);
        if (mode === 'lookahead') processor.parameters.get('protection').setValueAtTime(enabled ? 1 : 0, context.currentTime);
        else {
          input.disconnect(); processor.ceiling.disconnect();
          if (enabled) { input.connect(processor.headroom); processor.ceiling.connect(output); }
          else input.connect(output);
        }
      },
      meter() {
        if (context.state !== 'running') return { inputPeak: 0, outputPeak: 0, rms: 0, reductionDb: 0, processor: mode, protection: enabled, audioState: context.state };
        if (context.currentTime - lastMeter > 0.5) { cached = {}; meterStarted = false; }
        lastMeter = context.currentTime;
        const incoming = sample(input), outgoing = sample(output);
        if (mode === 'lookahead') {
          processor.port.postMessage({ type: meterStarted ? 'meter' : 'reset-meter' }); meterStarted = true;
        }
        const reductionDb = mode === 'lookahead' ? cached.reductionDb || 0 : outgoing.peak > 1e-6 ? Math.max(20 * Math.log10(Math.max(incoming.peak, 1e-9) / outgoing.peak), 0) : 0;
        return { inputPeak: Math.max(incoming.peak, cached.inputPeak || 0), outputPeak: Math.max(outgoing.peak, cached.outputPeak || 0), rms: outgoing.rms, reductionDb: enabled ? reductionDb : 0, processor: mode, protection: enabled, audioState: context.state };
      },
      dispose() { nodes.forEach(node => node.disconnect()); if (mode === 'lookahead') processor.port.close(); }
    };
  };
})();
