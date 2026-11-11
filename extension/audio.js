export function normalizeVolume(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid volume.');
  return Math.round(Math.min(400, Math.max(0, value)));
}

export async function resumeAudio(context, timeout = 5000) {
  let timer;
  try {
    await Promise.race([
      context.resume(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Audio could not start. Play the site audio, check your output device, and try again.')), timeout); })
    ]);
    if (context.state !== 'running') throw new Error('The browser paused audio. Play the site audio and try again.');
  } finally { clearTimeout(timer); }
}

export async function createAudioGraph(context, stream, volume = 100, protection = true, workletURL) {
  const output = await globalThis.__volumeBoosterOutputFactory_v1(context, workletURL);
  const source = context.createMediaStreamSource(stream);
  output.gain.gain.value = normalizeVolume(volume) / 100;
  source.connect(output.gain); output.setProtection(protection);
  return {
    setVolume: (value, muted = false) => output.setVolume(normalizeVolume(value), muted),
    setProtection: output.setProtection,
    meter: output.meter,
    mode: output.mode,
    dispose() { source.disconnect(); output.dispose(); }
  };
}
