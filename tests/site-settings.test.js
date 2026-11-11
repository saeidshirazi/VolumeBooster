import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSiteSettings, siteIdentity } from '../extension/site-settings.js';

function fixture({ granted = true, stored = {}, incognito = false } = {}) {
  const data = structuredClone(stored), registrations = new Map(), permissions = new Set(granted ? ['https://example.com/*'] : []);
  let removed;
  const api = {
    runtime: {},
    tabs: { get: async id => ({ url: id === 2 ? 'https://other.example/video' : id === 3 ? 'https://example.com:8443/watch' : 'https://example.com/watch?private=query', incognito }) },
    storage: { local: {
      get: async key => key === null ? { ...data } : { [key]: data[key] },
      set: async values => Object.assign(data, structuredClone(values)),
      remove: async key => { delete data[key]; }
    } },
    permissions: {
      contains: async ({ origins }) => origins.every(origin => permissions.has(origin)),
      remove: async ({ origins }) => { origins.forEach(origin => permissions.delete(origin)); },
      onRemoved: { addListener(fn) { removed = fn; } }
    },
    scripting: {
      getRegisteredContentScripts: async ({ ids } = {}) => [...registrations.values()].filter(script => !ids || ids.includes(script.id)),
      registerContentScripts: async scripts => scripts.forEach(script => { assert.ok(!registrations.has(script.id)); registrations.set(script.id, script); }),
      unregisterContentScripts: async ({ ids }) => ids.forEach(id => registrations.delete(id))
    }
  };
  return { api, data, permissions, registrations, removed: () => removed() };
}

test('site memory is opt-in and stores only exact origins, volume and protection', async () => {
  const f = fixture(), settings = createSiteSettings(f.api);
  assert.equal(await settings.get(1), null);
  await settings.remember(1, { volume: 225, protection: false, muted: true });
  assert.deepEqual(f.data, { 'remembered-site:https://example.com': { volume: 225, protection: false } });
  assert.equal(f.registrations.size, 2);
  assert.ok([...f.registrations.values()].every(script => script.matches[0] === 'https://example.com/*' && script.persistAcrossSessions));
  assert.equal((await settings.get(1)).volume, 225);
  assert.equal(await settings.get(2), null);
  assert.equal(await settings.get(3), null, 'a different port is a different saved origin');
});
test('remembering fails without site permission or in private windows', async () => {
  for (const options of [{ granted: false }, { incognito: true }]) {
    const f = fixture(options), settings = createSiteSettings(f.api);
    await assert.rejects(settings.remember(1, { volume: 200 }), /access|private/);
    assert.deepEqual(f.data, {});
    assert.equal(f.registrations.size, 0);
  }
});
test('automatic restoration rejects foreign origins, frames and private tabs', async () => {
  const f = fixture(), settings = createSiteSettings(f.api);
  await settings.remember(1, { volume: 200 });
  assert.equal((await settings.forSender({ tab: { id: 1 }, frameId: 0, url: 'https://example.com/next' })).volume, 200);
  for (const sender of [
    { tab: { id: 1 }, frameId: 1, url: 'https://example.com/next' },
    { tab: { id: 1 }, frameId: 0, url: 'https://other.example/' },
    { tab: { id: 2 }, frameId: 0, url: 'https://example.com/' }
  ]) assert.equal(await settings.forSender(sender), null);
});
test('volume updates persist, Stop leaves the preference, Forget removes data and permission', async () => {
  const f = fixture(), settings = createSiteSettings(f.api);
  await settings.remember(1, { volume: 150 });
  await settings.persist(1, { active: true, volume: 275, protection: false, muted: true });
  await settings.persist(1, { active: false, volume: 100, protection: true });
  assert.equal((await settings.get(1)).volume, 275);
  await settings.forget(1);
  assert.deepEqual(f.data, {}); assert.equal(f.registrations.size, 0); assert.equal(f.permissions.size, 0);
});
test('saved sites re-register after background restart and revocation removes stale grants', async () => {
  const f = fixture({ stored: { 'remembered-site:https://example.com': { volume: 180, protection: true } } });
  const settings = createSiteSettings(f.api);
  await settings.ready;
  assert.equal(f.registrations.size, 2);
  f.permissions.clear(); f.removed();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(await settings.get(1), null);
  assert.deepEqual(f.data, {}); assert.equal(f.registrations.size, 0);
});
test('origin parsing rejects browser pages and omits paths, queries and credentials', () => {
  assert.deepEqual(siteIdentity('https://name:password@example.com:8443/path?q=secret'), { origin: 'https://example.com:8443', pattern: 'https://example.com/*' });
  assert.throws(() => siteIdentity('chrome://settings'));
});
