import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeVolume } from '../extension/audio.js';
import { createSiteSettings } from '../extension/site-settings.js';

async function setup({ supported = true } = {}) {
  let listener;
  const idle = { active: false, volume: 100, muted: false, protection: true, mode: 'page' };
  const states = new Map(), badges = new Map();
  const browser = {
    runtime: { id: 'firefox-test', getURL: name => `moz-extension://test/${name}`, onMessage: { addListener(fn) { listener = fn; } } },
    action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async ({ tabId, text }) => badges.set(tabId, text) },
    commands: { onCommand: { addListener() {} } },
    tabs: { get: async id => ({ id, active: true, url: id === 99 ? 'about:config' : 'https://example.com' }) },
    scripting: { executeScript: async options => {
      if (options.files) return [];
      const [message] = options.args;
      let state = states.get(options.target.tabId) || { ...idle };
      if (message.type === 'start' && supported) { state.active = true; states.set(options.target.tabId, state); }
      if (message.type === 'volume') state.volume = message.volume;
      if (message.type === 'mute') state.muted = !state.muted;
      if (message.type === 'stop') state.active = false;
      return [{ result: { ...state } }];
    } }
  };
  const code = (await readFile(new URL('../extension/firefox-background.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');
  vm.runInNewContext(code, { browser, normalizeVolume, createSiteSettings });
  return { badges, send: (type, tabId = 1, extra = {}, sender = { id: 'firefox-test' }) => listener({ type, tabId, target: 'worker', ...extra }, sender) };
}
test('Firefox native worker supports independent sessions without Chromium APIs', async () => {
  const env = await setup();
  assert.equal((await env.send('start', 1, { volume: 200 })).volume, 200);
  assert.equal((await env.send('start', 2, { volume: 150 })).volume, 150);
  assert.equal((await env.send('mute')).muted, true);
  assert.equal(env.badges.get(1), 'M');
  assert.equal((await env.send('state', 2)).volume, 150);
  await env.send('stop');
  assert.equal((await env.send('state')).active, false);
});
test('Firefox reports unsupported media without pretending capture is available', async () => {
  const env = await setup({ supported: false });
  const result = await env.send('start');
  assert.equal(result.ok, false);
  assert.match(result.error, /not supported/);
  assert.equal((await env.send('state')).active, false);
});
test('Firefox rejects invalid input, internal pages, and content-script commands', async () => {
  const env = await setup();
  assert.equal((await env.send('start', -1)).ok, false);
  assert.equal((await env.send('start', 99)).ok, false);
  assert.equal((await env.send('start', 1, { volume: NaN })).ok, false);
  assert.equal(env.send('start', 1, {}, { id: 'firefox-test', tab: { id: 1 }, url: 'https://example.com' }), undefined);
});
