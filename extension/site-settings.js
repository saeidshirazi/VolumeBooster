import { normalizeVolume } from './audio.js';

export function siteIdentity(url) {
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Only websites can be remembered.');
  return { origin: parsed.origin, pattern: `${parsed.protocol}//${parsed.hostname}/*` };
}

export function createSiteSettings(api) {
  const prefix = 'remembered-site:';
  const available = Boolean(api.storage?.local && api.permissions?.contains && api.scripting?.registerContentScripts);
  let pending = Promise.resolve();
  function serial(task) {
    const next = pending.catch(() => {}).then(task);
    pending = next.catch(() => {});
    return next;
  }
  async function ids(origin) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(origin));
    const token = Array.from(new Uint8Array(digest)).slice(0, 12).map(byte => byte.toString(16).padStart(2, '0')).join('');
    return [`vb-main-${token}`, `vb-restore-${token}`];
  }
  async function records() {
    const stored = await api.storage.local.get(null);
    return Object.entries(stored).filter(([key]) => key.startsWith(prefix));
  }
  async function register(origin) {
    const { pattern } = siteIdentity(origin);
    const names = await ids(origin);
    const existing = await api.scripting.getRegisteredContentScripts({ ids: names });
    const present = new Set(existing.map(script => script.id));
    const scripts = [
      { id: names[0], js: ['page-engine.js'], world: 'MAIN', runAt: 'document_start' },
      { id: names[1], js: ['restore-bridge.js'], world: 'ISOLATED', runAt: 'document_idle' }
    ].filter(script => !present.has(script.id)).map(script => ({ ...script, matches: [pattern], allFrames: false, persistAcrossSessions: true }));
    if (scripts.length) await api.scripting.registerContentScripts(scripts);
  }
  async function unregister(origin) {
    const registered = await api.scripting.getRegisteredContentScripts({ ids: await ids(origin) });
    if (registered.length) await api.scripting.unregisterContentScripts({ ids: registered.map(script => script.id) });
  }
  async function reconcile() {
    const expected = new Set();
    for (const [key, value] of await records()) {
      const origin = key.slice(prefix.length);
      try {
        const { pattern } = siteIdentity(origin);
        normalizeVolume(value.volume);
        if (!await api.permissions.contains({ origins: [pattern] })) throw new Error('Site access was removed.');
        await register(origin);
        (await ids(origin)).forEach(id => expected.add(id));
      } catch { await api.storage.local.remove(key); }
    }
    const old = (await api.scripting.getRegisteredContentScripts()).filter(script => /^(vb-main-|vb-restore-)/.test(script.id) && !expected.has(script.id));
    if (old.length) await api.scripting.unregisterContentScripts({ ids: old.map(script => script.id) });
  }
  const ready = available ? serial(reconcile) : Promise.resolve();
  // A failed storage/registration operation must remain visible to callers.
  ready.catch(() => {});

  async function get(tabId) {
    if (!available) return null;
    await ready;
    const tab = await api.tabs.get(tabId);
    if (tab.incognito || !tab.url) return null;
    let site;
    try { site = siteIdentity(tab.url); } catch { return null; }
    const key = prefix + site.origin;
    const value = (await api.storage.local.get(key))[key];
    if (!value || !await api.permissions.contains({ origins: [site.pattern] })) return null;
    return { ...site, volume: normalizeVolume(value.volume), protection: value.protection !== false };
  }
  async function remember(tabId, state) {
    if (!available) throw new Error('Site settings are unavailable. Reload the extension.');
    await ready;
    return serial(async () => {
      const tab = await api.tabs.get(tabId);
      if (tab.incognito) throw new Error('Site settings are not saved in private windows.');
      const site = siteIdentity(tab.url);
      if (!await api.permissions.contains({ origins: [site.pattern] })) throw new Error('Allow access to this site to remember its volume.');
      await register(site.origin);
      try { await api.storage.local.set({ [prefix + site.origin]: { volume: normalizeVolume(state.volume), protection: state.protection !== false } }); }
      catch (error) { await unregister(site.origin); throw error; }
      return site;
    });
  }
  async function persist(tabId, state) {
    const existing = await get(tabId);
    if (!existing || !state.active) return;
    await ready;
    return serial(() => api.storage.local.set({ [prefix + existing.origin]: { volume: normalizeVolume(state.volume), protection: state.protection !== false } }));
  }
  async function forget(tabId) {
    if (!available) return;
    await ready;
    return serial(async () => {
      const tab = await api.tabs.get(tabId), site = siteIdentity(tab.url);
      await unregister(site.origin);
      await api.storage.local.remove(prefix + site.origin);
      const shared = (await records()).some(([key]) => siteIdentity(key.slice(prefix.length)).pattern === site.pattern);
      if (!shared) await api.permissions.remove({ origins: [site.pattern] });
    });
  }
  async function describe(tabId, state) {
    const saved = await get(tabId);
    return { ...state, ...(!state.active && saved ? { volume: saved.volume, protection: saved.protection } : {}), remembered: Boolean(saved) };
  }
  async function forSender(sender) {
    if (!sender.tab || sender.frameId !== 0) return null;
    const saved = await get(sender.tab.id);
    if (!saved) return null;
    try { return siteIdentity(sender.url).origin === saved.origin ? saved : null; } catch { return null; }
  }
  api.permissions?.onRemoved?.addListener(() => { if (available) ready.then(() => serial(reconcile)).catch(() => {}); });
  api.runtime.onStartup?.addListener(() => { if (available) ready.then(() => serial(reconcile)).catch(() => {}); });
  return { ready, get, remember, persist, forget, describe, forSender };
}
