// Injected only into a tab the user explicitly enables. Never requests a media
// URL or changes crossOrigin: doing so can break playback or trigger a reload.
(() => {
  const key = '__volumeBoosterEngine_v1';
  if (window[key]) return;
  let context, output, observer, volume = 100, muted = false, protection = true, active = false, autoSuppressed = false;
  const nodes = new Map();
  async function resumeOutput() {
    let timer;
    try {
      await Promise.race([
        context.resume(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Audio could not start. Play the site audio, check your output device, and try again.')), 5000); })
      ]);
      if (context.state !== 'running') throw new Error('The browser paused audio. Play the site audio and try again.');
    } finally { clearTimeout(timer); }
  }
  function eligible(media) {
    if (media.mediaKeys || !media.currentSrc) return false;
    try { return new URL(media.currentSrc, location.href).origin === location.origin || media.crossOrigin !== null; }
    catch { return false; }
  }
  function apply() {
    if (!output) return;
    output.setVolume(active ? volume : 100, active && muted);
    output.setProtection(active && protection);
  }
  function attach() {
    for (const media of document.querySelectorAll('video,audio')) {
      if (nodes.has(media) || !eligible(media)) continue;
      try {
        const source = context.createMediaElementSource(media);
        source.connect(output.gain); nodes.set(media, source);
      } catch {
        // A player may already belong to the website's own AudioContext.
        // Never replace the player or interrupt its existing audio graph.
      }
    }
  }
  function state() { return { active, volume: active ? volume : 100, muted: active && muted, protection: active ? protection : true, mode: 'page', processor: output?.mode }; }
  window[key] = async message => {
    if (message.type === 'state') return state();
    if (message.type === 'meter') return active && output ? output.meter() : { outputPeak: 0, rms: 0, reductionDb: 0 };
    if (message.type === 'start' || message.type === 'restore') {
      if (message.type === 'restore' && autoSuppressed) return { ...state(), paused: true };
      if (message.type === 'start') autoSuppressed = false;
      if (!active) {
        const candidates = [...document.querySelectorAll('video,audio')].filter(eligible);
        if (!candidates.length) return { active: false, unavailable: true };
        context ||= new AudioContext({ latencyHint: 'interactive' });
        try { await resumeOutput(); }
        catch (error) {
          if (!nodes.size) { context.close().catch(() => {}); context = undefined; }
          throw error;
        }
        output ||= await globalThis.__volumeBoosterOutputFactory_v1(context, message.workletURL);
        active = true;
        volume = typeof message.volume === 'number' && Number.isFinite(message.volume) ? Math.round(Math.min(400, Math.max(0, message.volume))) : 100;
        muted = false; protection = message.protection !== false;
        attach();
        if (!nodes.size) { active = false; return { active: false, unavailable: true }; }
        apply();
        observer ||= new MutationObserver(() => { if (active) attach(); });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        document.addEventListener('loadedmetadata', attach, true);
      }
      return state();
    }
    if (message.type === 'stop') {
      autoSuppressed = true;
      active = false; observer?.disconnect();
      document.removeEventListener('loadedmetadata', attach, true);
      apply();
      // MediaElementSource is a one-time attachment. Keep a unity-gain path
      // alive after Stop so the website remains audible until it unloads.
      return state();
    }
    if (!active) throw new Error('Enable this tab first.');
    if (message.type === 'volume') {
      if (typeof message.volume !== 'number' || !Number.isFinite(message.volume)) throw new Error('Invalid volume.');
      volume = Math.round(Math.max(0, Math.min(400, message.volume)));
    } else if (message.type === 'mute') muted = !muted;
    else if (message.type === 'protection') protection = Boolean(message.enabled);
    else throw new Error('Unknown audio command.');
    apply();
    await resumeOutput();
    return state();
  };
})();
