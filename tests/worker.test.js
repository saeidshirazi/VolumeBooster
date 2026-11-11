import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeVolume } from '../extension/audio.js';
import { createSiteSettings } from '../extension/site-settings.js';

async function setup({ restoreSaved = false } = {}) {
  let listener, commandListener, removedListener, contexts = false, creations = 0, captures = 0;
  const sessions = new Map(), badges = new Map();
  const idle = { active: false, volume: 100, muted: false, protection: true };
  const chrome = {
    runtime: {
      id: 'test', getContexts: async () => contexts ? [{}] : [], onMessage: { addListener: fn => { listener = fn; } },
      sendMessage: async m => {
        let s = sessions.get(m.tabId) || { ...idle };
        if (m.type === 'start') { await new Promise(r => setTimeout(r, 5)); s = { ...idle, active: true, volume: m.volume }; sessions.set(m.tabId, s); }
        if (m.type === 'stop') { sessions.delete(m.tabId); s = { ...idle }; }
        if (m.type === 'volume') s.volume = m.volume;
        if (m.type === 'mute') s.muted = !s.muted;
        return { ok: true, ...s };
      }
    },
    offscreen: { createDocument: async () => { creations++; await new Promise(r => setTimeout(r, 5)); contexts = true; } },
    tabCapture: { getMediaStreamId: async () => { captures++; return 'stream'; } },
    action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async ({ tabId, text }) => badges.set(tabId, text) },
    tabs: { get: async id => ({ id, active: true, url: id === 99 ? 'chrome://settings/' : 'https://example.com/' }), query: async () => [{ id: 1 }], onRemoved: { addListener: fn => { removedListener = fn; } } },
    commands: { onCommand: { addListener: fn => { commandListener = fn; } } }
  };
  const code = (await readFile(new URL('../extension/background.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');
  vm.runInNewContext(code, { chrome, normalizeVolume, createSiteSettings: api => ({ ...createSiteSettings(api), ...(restoreSaved ? { forSender: async () => ({ volume: 200, protection: true }) } : {}) }), console });
  const send = (type, tabId = 1, extra = {}, sender = { id: 'test' }) => new Promise(resolve => {
    const handled = listener({ target: 'worker', type, tabId, ...extra }, sender, resolve);
    if (!handled) resolve(undefined);
  });
  return { send, sessions, badges, command: commandListener, removed: removedListener, counts: () => ({ creations, captures }) };
}

test('start is serialized per tab, offscreen creation is shared across tabs', async () => {
  const env = await setup();
  const states = await Promise.all([env.send('start'), env.send('start'), env.send('start', 2)]);
  assert.ok(states.every(s => s.ok && s.active));
  assert.deepEqual(env.counts(), { creations: 1, captures: 2 });
  await env.send('volume', 1, { volume: 250 });
  assert.equal((await env.send('state')).volume, 250);
  assert.equal((await env.send('state', 2)).volume, 100);
  assert.equal(env.badges.get(1), '250%');
  await env.send('mute');
  assert.equal(env.badges.get(1), 'M');
  await env.send('stop');
  assert.equal((await env.send('state')).active, false);
  assert.equal(env.badges.get(1), '');
});

test('a remembered site never starts a second direct processor over active capture', async () => {
  const env = await setup({ restoreSaved: true });
  await env.send('start', 1, { volume: 250 });
  const restored = await env.send('restore', 1, {}, { id: 'test', tab: { id: 1 }, frameId: 0, url: 'https://example.com/' });
  assert.equal(restored.ok, true);
  assert.equal(restored.mode, 'capture');
  assert.equal((await env.send('state')).volume, 250);
  assert.equal(env.counts().captures, 1);
});
test('rejects browser pages, foreign senders, and page-script requests', async () => {
  const env = await setup();
  assert.equal((await env.send('start', 99)).ok, false);
  assert.equal((await env.send('start', -1)).ok, false);
  assert.equal(await env.send('start', 1, {}, { id: 'foreign' }), undefined);
  assert.equal(await env.send('start', 1, {}, { id: 'test', tab: { id: 1 } }), undefined);
  assert.equal((await env.send('volume', 1, { volume: 200 })).ok, false);
});
test('shortcuts clamp volume and closed tabs release sessions', async () => {
  const env = await setup();
  await env.send('start', 1, { volume: 400 });
  await env.command('volume-up');
  // A state request waits for the per-tab shortcut operation.
  assert.equal((await env.send('state')).volume, 400);
  await env.command('volume-down');
  assert.equal((await env.send('state')).volume, 390);
  env.removed(1);
  await env.send('state');
  assert.equal(env.sessions.size, 0);
});
