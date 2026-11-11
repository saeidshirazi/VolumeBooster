import { normalizeVolume } from './audio.js';
import { createSiteSettings } from './site-settings.js';
const api = browser;
const siteSettings = createSiteSettings(api);
const idle = { active: false, volume: 100, muted: false, protection: true };
const queues = new Map();

async function page(type, tabId, extra = {}) {
  const results = await api.scripting.executeScript({
    target: { tabId }, world: 'MAIN',
    func: async message => typeof window.__volumeBoosterEngine_v1 === 'function' ? window.__volumeBoosterEngine_v1(message) : null,
    args: [{ type, ...extra }]
  });
  if (results[0]?.error) throw new Error(results[0].error.message || 'The audio processor could not start.');
  return results[0]?.result;
}
async function badge(tabId, state) {
  await api.action.setBadgeBackgroundColor({ tabId, color: state.muted ? '#65717a' : '#167563' });
  await api.action.setBadgeText({ tabId, text: state.active ? state.muted ? 'M' : `${state.volume}%` : '' });
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
  if (type === 'state') {
    const state = await page('state', tabId).catch(() => null);
    const result = state?.active ? state : idle;
    await badge(tabId, result);
    return siteSettings.describe(tabId, result);
  }
  if (type === 'remember') {
    const current = await handle({ type: 'state', tabId });
    if (message.enabled === true) await siteSettings.remember(tabId, current);
    else if (message.enabled === false) await siteSettings.forget(tabId);
    else throw new Error('Invalid remember setting.');
    return siteSettings.describe(tabId, current);
  }
  if (type === 'start') {
    const saved = await siteSettings.get(tabId);
    const volume = normalizeVolume(message.volume ?? saved?.volume ?? 100);
    const tab = await api.tabs.get(tabId);
    if (!tab.active || !/^https?:\/\//.test(tab.url || '')) throw new Error('Open a regular website tab first.');
    await api.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['page-engine.js'] });
    const state = await page('start', tabId, { volume, protection: saved?.protection !== false });
    if (!state?.active) throw new Error('This player cannot be boosted in Firefox. Play a compatible audio/video element first. Protected and non-CORS players are not supported.');
    const result = await page('volume', tabId, { volume });
    await badge(tabId, result);
    await siteSettings.persist(tabId, result);
    return siteSettings.describe(tabId, result);
  }
  const current = await page('state', tabId).catch(() => null);
  if (!current?.active) {
    if (type === 'stop') { await badge(tabId, idle); return idle; }
    throw new Error('Enable VolumeBooster for this tab first.');
  }
  const state = await page(type, tabId, { volume: message.volume === undefined ? undefined : normalizeVolume(message.volume), enabled: message.enabled });
  await badge(tabId, state);
  await siteSettings.persist(tabId, state);
  return siteSettings.describe(tabId, state);
}

api.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== api.runtime.id || message.target !== 'worker') return undefined;
  if (sender.tab && !sender.url?.startsWith(api.runtime.getURL(''))) {
    if (message.type !== 'restore' || sender.frameId !== 0) return undefined;
    return serialized(sender.tab.id, async () => {
      const saved = await siteSettings.forSender(sender);
      if (!saved) return { active: false };
      const state = await page('restore', sender.tab.id, { volume: saved.volume, protection: saved.protection });
      if (state) await badge(sender.tab.id, state);
      return state || { active: false };
    }).then(state => ({ ok: true, ...state }), error => ({ ok: false, error: error.message }));
  }
  return serialized(message.tabId, () => handle(message)).then(state => ({ ok: true, ...state }), error => ({ ok: false, error: error.message }));
});
api.commands.onCommand.addListener(async command => {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  serialized(tab.id, async () => {
    const state = await handle({ type: 'state', tabId: tab.id });
    if (!state.active) return;
    return handle(command === 'toggle-mute' ? { type: 'mute', tabId: tab.id } : {
      type: 'volume', tabId: tab.id, volume: normalizeVolume(state.volume + (command === 'volume-up' ? 10 : -10))
    });
  }).catch(() => {});
});
