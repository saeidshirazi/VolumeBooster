export function normalizeVolume(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid volume.');
  return Math.round(Math.min(400, Math.max(0, value)));
}

export function createAudioGraph(context, stream, volume = 100, protection = true) {
  const source = context.createMediaStreamSource(stream);
  const gain = context.createGain();
  const compressor = context.createDynamicsCompressor();
  // A gentle peak compressor reduces harsh peaks. It is not a brick-wall limiter.
  compressor.threshold.value = -3;
  compressor.knee.value = 6;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;
  gain.gain.value = normalizeVolume(volume) / 100;
  source.connect(gain);
  let protectedOutput;
  function setProtection(enabled) {
    if (protectedOutput === enabled) return;
    gain.disconnect();
    compressor.disconnect();
    if (enabled) { gain.connect(compressor); compressor.connect(context.destination); }
    else gain.connect(context.destination);
    protectedOutput = enabled;
  }
  setProtection(protection);
  return {
    setVolume(value, muted = false) {
      const time = context.currentTime;
      gain.gain.cancelScheduledValues(time);
      gain.gain.setTargetAtTime(muted ? 0 : normalizeVolume(value) / 100, time, 0.025);
    },
    setProtection,
    dispose() { source.disconnect(); gain.disconnect(); compressor.disconnect(); }
  };
}
