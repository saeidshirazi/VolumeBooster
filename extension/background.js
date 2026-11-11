import { normalizeVolume } from './audio.js';

let creating;
const queues = new Map();
const idle = { active: false, volume: 100, muted: false, protection: true };
async function pageAudio(type, tabId, extra = {}) {
  const results = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN',
    func: async message => {
      const engine = window.__volumeBoosterEngine_v1;
      return typeof engine === 'function' ? engine(message) : null;
    }, args: [{ type, ...extra }]
  });
  return results[0]?.result;
}
async function pageState(tabId) {
  try { return await pageAudio('state', tabId); } catch { return null; }
}
async function hasEngine() {
  return (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length > 0;
}
async function ensureEngine() {
  if (creating) return creating;
  creating = (async () => {
    if (!await hasEngine()) await chrome.offscreen.createDocument({
      url: 'offscreen.html', reasons: ['USER_MEDIA'], justification: 'Process and play the tab audio selected by the user. No recording or upload.'
    });
  })();
  try { await creating; } finally { creating = undefined; }
}
async function audio(type, tabId, extra = {}) {
  const response = await chrome.runtime.sendMessage({ target: 'audio', type, tabId, ...extra });
  if (!response?.ok) throw new Error(response?.error || 'The audio engine is unavailable. Stop and enable again.');
  return response;
}
async function badge(tabId, s) {
  await chrome.action.setBadgeBackgroundColor({ tabId, color: s.muted ? '#65717a' : '#167563' });
  await chrome.action.setBadgeText({ tabId, text: s.active ? (s.muted ? 'M' : `${s.volume}%`) : '' });
}
function serialized(tabId, task) {
  const next = (queues.get(tabId) || Promise.resolve()).catch(() => {}).then(task);
  queues.set(tabId, next);
  next.finally(() => { if (queues.get(tabId) === next) queues.delete(tabId); }).catch(() => {});
  return next;
}
async function handle(message) {
  const { type, tabId } = message;
  if (!Number.isInteger(tabId) || tabId < 0) throw new Error('Select a website tab first.');
  if (type === 'ended') { await badge(tabId, idle); return idle; }
  if (type === 'state') {
    const captured = await hasEngine() ? await audio('state', tabId) : idle;
    if (captured.active) return { ...captured, mode: 'capture' };
    const local = await pageState(tabId);
    const s = local?.active ? local : idle;
    await badge(tabId, s);
    return s;
  }
  if (type === 'start') {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active || !/^https?:\/\//.test(tab.url || '')) throw new Error('Open a regular website tab, then enable VolumeBooster.');
    const requestedVolume = normalizeVolume(message.volume ?? 100);
    const existing = await handle({ type: 'state', tabId });
    if (existing.active) return existing;
    try {
      await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['page-engine.js'] });
      const local = await pageAudio('start', tabId);
      if (local?.active) {
        if (message.volume !== undefined) Object.assign(local, await pageAudio('volume', tabId, { volume: requestedVolume }));
        await badge(tabId, local);
        return local;
      }
    } catch { /* Unsupported/embedded players use explicit tab capture below. */ }
    await ensureEngine();
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    const s = await audio('start', tabId, { streamId, volume: requestedVolume });
    await badge(tabId, s);
    return { ...s, mode: 'capture' };
  }
  const local = await pageState(tabId);
  if (local?.active) {
    const s = await pageAudio(type, tabId, { volume: message.volume, enabled: message.enabled });
    await badge(tabId, s);
    return s;
  }
  if (!await hasEngine()) {
    if (type === 'stop') { await badge(tabId, idle); return idle; }
    throw new Error('Enable VolumeBooster for this tab first.');
  }
  const s = await audio(type, tabId, { volume: message.volume, enabled: message.enabled });
  await badge(tabId, s);
  return { ...s, mode: 'capture' };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.tab || message.target !== 'worker') return;
  serialized(message.tabId, () => handle(message)).then(s => respond({ ok: true, ...s }), e => respond({ ok: false, error: e.message }));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => {
  serialized(tabId, async () => { if (await hasEngine()) await audio('stop', tabId); }).catch(() => {});
});
chrome.commands.onCommand.addListener(async command => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  serialized(tab.id, async () => {
    const s = await handle({ type: 'state', tabId: tab.id });
    if (!s.active) return;
    await handle(command === 'toggle-mute' ? { type: 'mute', tabId: tab.id } : {
      type: 'volume', tabId: tab.id, volume: normalizeVolume(s.volume + (command === 'volume-up' ? 10 : -10))
    });
  }).catch(() => {});
});
