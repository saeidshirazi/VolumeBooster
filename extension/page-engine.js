// Injected only into a tab the user explicitly enables. Never requests a media
// URL or changes crossOrigin: doing so can break playback or trigger a reload.
(() => {
  const key = '__volumeBoosterEngine_v1';
  if (window[key]) return;
  let context, observer, volume = 100, muted = false, protection = true, active = false;
  const nodes = new Map();
  function eligible(media) {
    if (media.mediaKeys || !media.currentSrc) return false;
    try { return new URL(media.currentSrc, location.href).origin === location.origin || media.crossOrigin !== null; }
    catch { return false; }
  }
  function apply(node) {
    node.gain.gain.cancelScheduledValues(context.currentTime);
    node.gain.gain.setTargetAtTime(active ? (muted ? 0 : volume / 100) : 1, context.currentTime, 0.025);
    const soften = active && protection;
    if (node.soften === soften) return;
    node.gain.disconnect(); node.compressor.disconnect();
    if (soften) { node.gain.connect(node.compressor); node.compressor.connect(context.destination); }
    else node.gain.connect(context.destination);
    node.soften = soften;
  }
  function attach() {
    for (const media of document.querySelectorAll('video,audio')) {
      if (nodes.has(media) || !eligible(media)) continue;
      try {
        const source = context.createMediaElementSource(media);
        const gain = context.createGain(), compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -3; compressor.knee.value = 6; compressor.ratio.value = 12;
        compressor.attack.value = 0.003; compressor.release.value = 0.15;
        const node = { source, gain, compressor, soften: undefined };
        source.connect(gain); nodes.set(media, node); apply(node);
      } catch {
        // A player may already belong to the website's own AudioContext.
        // Never replace the player or interrupt its existing audio graph.
      }
    }
  }
  function state() { return { active, volume: active ? volume : 100, muted: active && muted, protection: active ? protection : true, mode: 'page' }; }
  window[key] = async message => {
    if (message.type === 'state') return state();
    if (message.type === 'start') {
      if (!active) {
        const candidates = [...document.querySelectorAll('video,audio')].filter(eligible);
        if (!candidates.length) return { active: false, unavailable: true };
        context ||= new AudioContext({ latencyHint: 'interactive' });
        await context.resume();
        if (context.state !== 'running') return { active: false, unavailable: true };
        active = true; volume = 100; muted = false; protection = true;
        attach();
        if (!nodes.size) { active = false; return { active: false, unavailable: true }; }
        nodes.forEach(apply);
        observer ||= new MutationObserver(() => { if (active) attach(); });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        document.addEventListener('loadedmetadata', attach, true);
      }
      return state();
    }
    if (message.type === 'stop') {
      active = false; observer?.disconnect();
      document.removeEventListener('loadedmetadata', attach, true);
      nodes.forEach(apply);
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
    nodes.forEach(apply);
    await context.resume();
    return state();
  };
})();
