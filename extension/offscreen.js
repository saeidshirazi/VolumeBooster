import { createAudioGraph, normalizeVolume } from './audio.js';

const sessions = new Map();
const state = s => s ? { active: true, volume: s.volume, muted: s.muted, protection: s.protection } : { active: false, volume: 100, muted: false, protection: true };

async function stop(tabId) {
  const s = sessions.get(tabId);
  if (!s) return;
  sessions.delete(tabId);
  s.graph.dispose();
  s.stream.getTracks().forEach(track => track.stop());
  await s.context.close();
}

async function handle(message) {
  const { type, tabId } = message;
  if (type === 'state') return state(sessions.get(tabId));
  if (type === 'stop') { await stop(tabId); return state(); }
  if (type === 'start') {
    if (sessions.has(tabId)) return state(sessions.get(tabId));
    let stream, context, timer;
    let expired = false;
    try {
      const acquisition = navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: message.streamId } }, video: false
      });
      acquisition.then(lateStream => {
        if (expired) lateStream.getTracks().forEach(t => t.stop());
      }, () => {});
      stream = await Promise.race([acquisition, new Promise((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(new Error('Audio capture timed out. Please try again.')); }, 8000);
      })]);
      clearTimeout(timer);
      context = new AudioContext({ latencyHint: 'interactive' });
      const volume = normalizeVolume(message.volume ?? 100);
      const graph = createAudioGraph(context, stream, volume);
      await context.resume();
      if (context.state !== 'running') throw new Error('Chrome paused the audio engine. Stop and enable again.');
      const session = { stream, context, graph, volume, muted: false, protection: true };
      sessions.set(tabId, session);
      stream.getTracks().forEach(track => track.addEventListener('ended', () => {
        if (sessions.get(tabId) !== session) return;
        stop(tabId).finally(() => chrome.runtime.sendMessage({ target: 'worker', type: 'ended', tabId }).catch(() => {}));
      }, { once: true }));
      return state(session);
    } catch (error) {
      clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
      await context?.close();
      throw error;
    }
  }
  const s = sessions.get(tabId);
  if (!s) throw new Error('Open VolumeBooster and enable this tab first.');
  if (type === 'volume') s.volume = normalizeVolume(message.volume);
  else if (type === 'mute') s.muted = !s.muted;
  else if (type === 'protection') {
    s.protection = Boolean(message.enabled);
    s.graph.setProtection(s.protection);
  } else throw new Error('Unknown audio command.');
  s.graph.setVolume(s.volume, s.muted);
  if (s.context.state === 'suspended') await s.context.resume();
  return state(s);
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message.target !== 'audio') return;
  handle(message).then(data => respond({ ok: true, ...data }), error => respond({ ok: false, error: error.message }));
  return true;
});
