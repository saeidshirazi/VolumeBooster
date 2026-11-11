import { normalizeVolume } from './audio.js';
import { createSiteSettings } from './site-settings.js';
const chrome = globalThis.browser || globalThis.chrome;
const siteSettings = createSiteSettings(chrome);

let creating;
const queues = new Map();
const idle = { active: false, volume: 100, muted: false, protection: true };
async function pageAudio(type, tabId, extra = {}) {
  const results = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN',
    func: async message => {
      const engine = window.__volumeBoosterEngine_v1;
      return typeof engine === 'function' ? engine(message) : null;
    }, args: [{ type, ...extra, ...(['start', 'restore'].includes(type) ? { workletURL: chrome.runtime.getURL('limiter-worklet.js') } : {}) }]
  });
  if (results[0]?.error) throw new Error(results[0].error.message || 'The audio processor could not start.');
  return results[0]?.result;
}
async function pageState(tabId) {
  try {
    let state = await pageAudio('state', tabId);
    if (!state) {
      await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['audio-output.js', 'page-engine.js'] });
      state = await pageAudio('state', tabId);
    }
    return state;
  } catch { return null; }
}
async function hasEngine() {
  if (!chrome.offscreen || !chrome.runtime.getContexts) return false;
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
    if (captured.active) return siteSettings.describe(tabId, { ...captured, mode: 'capture' });
    const local = await pageState(tabId);
    const s = local || idle;
    await badge(tabId, s);
    return siteSettings.describe(tabId, s);
  }
  if (type === 'meter') {
    const local = await pageState(tabId);
    if (local?.active) return pageAudio('meter', tabId);
    return await hasEngine() ? audio('meter', tabId) : { outputPeak: 0, rms: 0, reductionDb: 0 };
  }
  if (type === 'remember') {
    const current = await handle({ type: 'state', tabId });
    if (message.enabled === true) await siteSettings.remember(tabId, current);
    else if (message.enabled === false) await siteSettings.forget(tabId);
    else throw new Error('Invalid remember setting.');
    return siteSettings.describe(tabId, current);
  }
  if (type === 'start') {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active || !/^https?:\/\//.test(tab.url || '')) throw new Error('Open a regular website tab, then enable VolumeBooster.');
    const saved = await siteSettings.get(tabId);
    const requestedVolume = normalizeVolume(message.volume ?? saved?.volume ?? 100);
    const protection = saved?.protection !== false;
    const existing = await handle({ type: 'state', tabId });
    if (existing.active) return existing;
    try {
      await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['audio-output.js', 'page-engine.js'] });
      const local = await pageAudio('start', tabId, { volume: requestedVolume, protection });
      if (local?.active) {
        if (message.volume !== undefined) Object.assign(local, await pageAudio('volume', tabId, { volume: requestedVolume }));
        await badge(tabId, local);
        await siteSettings.persist(tabId, local);
        return siteSettings.describe(tabId, local);
      }
    } catch { /* Unsupported/embedded players use explicit tab capture below. */ }
    if (!chrome.tabCapture?.getMediaStreamId || !chrome.offscreen) {
      throw new Error('This player cannot be boosted in Firefox. Play a compatible audio/video element first. Protected and non-CORS players are not supported.');
    }
    await ensureEngine();
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    let s = await audio('start', tabId, { streamId, volume: requestedVolume });
    if (!protection) s = await audio('protection', tabId, { enabled: false });
    await badge(tabId, s);
    await siteSettings.persist(tabId, s);
    return siteSettings.describe(tabId, { ...s, mode: 'capture' });
  }
  const local = await pageState(tabId);
  if (local?.active) {
    const s = await pageAudio(type, tabId, { volume: message.volume, enabled: message.enabled });
    await badge(tabId, s);
    await siteSettings.persist(tabId, s);
    return siteSettings.describe(tabId, s);
  }
  if (!await hasEngine()) {
    if (type === 'stop') { await badge(tabId, idle); return idle; }
    throw new Error('Enable VolumeBooster for this tab first.');
  }
  const s = await audio(type, tabId, { volume: message.volume, enabled: message.enabled });
  if (type === 'stop') await pageAudio('stop', tabId).catch(() => {});
  await badge(tabId, s);
  await siteSettings.persist(tabId, s);
  return siteSettings.describe(tabId, { ...s, mode: 'capture' });
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message.target !== 'worker') return;
  if (sender.tab) {
    if (message.type !== 'restore' || sender.frameId !== 0) return;
    serialized(sender.tab.id, async () => {
      const saved = await siteSettings.forSender(sender);
      if (!saved) return { active: false };
      if (await hasEngine()) {
        const captured = await audio('state', sender.tab.id);
        if (captured.active) return { ...captured, mode: 'capture' };
      }
      const state = await pageAudio('restore', sender.tab.id, { volume: saved.volume, protection: saved.protection });
      if (state) await badge(sender.tab.id, state);
      return state || { active: false };
    }).then(state => respond({ ok: true, ...state }), error => respond({ ok: false, error: error.message }));
    return true;
  }
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
