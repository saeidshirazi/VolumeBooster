import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function setup({ src = 'blob:https://example.com/media', crossOrigin = null, drm = false, hangResume = false } = {}) {
  const media = { currentSrc: src, crossOrigin, mediaKeys: drm ? {} : null };
  const values = [], gains = [];
  let sourceCount = 0, contexts = 0;
  function node() { return { connect() {}, disconnect() {} }; }
  class AudioContext {
    state = 'running'; currentTime = 0; destination = {};
    constructor() { contexts++; }
    async resume() { if (hangResume) return new Promise(() => {}); }
    async close() { this.state = 'closed'; }
    createMediaElementSource() { sourceCount++; return node(); }
    createGain() {
      const n = { ...node(), gain: { cancelScheduledValues() {}, setTargetAtTime(value) { values.push(value); } } };
      gains.push(n); return n;
    }
    createDynamicsCompressor() { return { ...node(), ...Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k => [k, { value: 0 }])) }; }
  }
  const window = {};
  const code = await readFile(new URL('../extension/page-engine.js', import.meta.url), 'utf8');
  vm.runInNewContext(code, {
    window, URL, AudioContext, clearTimeout,
    __volumeBoosterOutputFactory_v1: async context => {
      const gain = context.createGain();
      return { gain, mode: 'lookahead', setVolume: (volume, muted) => gain.gain.setTargetAtTime(muted ? 0 : volume / 100), setProtection() {}, meter: () => ({ outputPeak: 0 }) };
    },
    setTimeout: (callback, delay) => setTimeout(callback, hangResume ? 10 : delay),
    MutationObserver: class { observe() {} disconnect() {} },
    location: { href: 'https://example.com/watch', origin: 'https://example.com' },
    document: { documentElement: {}, querySelectorAll: () => [media], addEventListener() {}, removeEventListener() {} }
  });
  return { send: (type, extra = {}) => window.__volumeBoosterEngine_v1({ type, ...extra }), values, counts: () => ({ contexts, sourceCount }) };
}
test('native engine refuses unsafe cross-origin and protected media before attaching', async () => {
  for (const options of [{ src: 'https://other.com/music.mp3' }, { drm: true }]) {
    const env = await setup(options);
    assert.equal((await env.send('start')).unavailable, true);
    assert.deepEqual(env.counts(), { contexts: 0, sourceCount: 0 });
  }
});

test('a stalled native audio output fails before attaching or silencing the player', async () => {
  const env = await setup({ hangResume: true });
  await assert.rejects(env.send('start'), /Audio could not start/);
  assert.equal(env.counts().sourceCount, 0);
  assert.equal((await env.send('state')).active, false);
});
test('native engine preserves gain/mute state and Stop restores a live unity path', async () => {
  const env = await setup();
  assert.equal((await env.send('start')).mode, 'page');
  await env.send('volume', { volume: 250 });
  assert.equal(env.values.at(-1), 2.5);
  await env.send('mute');
  assert.equal(env.values.at(-1), 0);
  await env.send('volume', { volume: 300 });
  assert.equal(env.values.at(-1), 0);
  await env.send('mute');
  assert.equal(env.values.at(-1), 3);
  await env.send('stop');
  assert.equal(env.values.at(-1), 1);
  assert.equal((await env.send('state')).active, false);
  await env.send('start');
  assert.deepEqual(env.counts(), { contexts: 1, sourceCount: 1 });
  assert.equal((await env.send('volume', { volume: 999 })).volume, 400);
});
test('explicit CORS media can use the native path', async () => {
  const env = await setup({ src: 'https://cdn.example.com/video.mp4', crossOrigin: 'anonymous' });
  assert.equal((await env.send('start')).active, true);
});

test('automatic restore uses the saved level and respects Stop until explicit re-enable', async () => {
  const env = await setup();
  assert.equal((await env.send('restore', { volume: 240, protection: false })).volume, 240);
  await env.send('stop');
  assert.equal((await env.send('restore', { volume: 240 })).active, false);
  assert.equal(env.values.at(-1), 1);
  assert.equal((await env.send('start', { volume: 180 })).volume, 180);
});
