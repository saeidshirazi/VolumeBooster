import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeVolume, resumeAudio } from '../extension/audio.js';

async function setup({ failCapture = false, failResume = false } = {}) {
  let listener, ended, acquisitions = 0, trackStops = 0, closes = 0, disposals = 0;
  const notices = [];
  const stream = { getTracks: () => [{ stop() { trackStops++; }, addEventListener(type, fn) { ended = fn; } }] };
  class AudioContext {
    state = 'suspended';
    async resume() { if (failResume) throw new Error('Device unavailable'); this.state = 'running'; }
    async close() { this.state = 'closed'; closes++; }
  }
  const code = (await readFile(new URL('../extension/offscreen.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');
  vm.runInNewContext(code, {
    AudioContext, normalizeVolume, resumeAudio, setTimeout, clearTimeout,
    createAudioGraph: async () => ({ setVolume() {}, setProtection() {}, meter: () => ({ outputPeak: 0 }), dispose() { disposals++; } }),
    navigator: { mediaDevices: { getUserMedia: async () => { acquisitions++; if (failCapture) throw new Error('Capture blocked'); return stream; } } },
    chrome: { runtime: { id: 'test', getURL: name => name, onMessage: { addListener: fn => { listener = fn; } }, sendMessage: async m => { notices.push(m); } } }
  });
  const send = (type, extra = {}) => new Promise(resolve => listener({ target: 'audio', tabId: 1, type, ...extra }, { id: 'test' }, resolve));
  return { send, ended: () => ended(), notices, counts: () => ({ acquisitions, trackStops, closes, disposals }) };
}
test('offscreen session keeps mute volume, avoids duplicate capture, and releases tracks', async () => {
  const env = await setup();
  assert.equal((await env.send('start', { streamId: 'valid', volume: 150 })).volume, 150);
  await env.send('start', { streamId: 'unused' });
  assert.equal(env.counts().acquisitions, 1);
  assert.equal((await env.send('mute')).muted, true);
  assert.equal((await env.send('volume', { volume: 200 })).muted, true);
  assert.equal((await env.send('mute')).volume, 200);
  await env.send('stop');
  assert.equal((await env.send('state')).active, false);
  assert.deepEqual(env.counts(), { acquisitions: 1, trackStops: 1, closes: 1, disposals: 1 });
});
test('capture and audio-device failures do not leave a silent captured tab', async () => {
  const blocked = await setup({ failCapture: true });
  assert.equal((await blocked.send('start')).error, 'Capture blocked');
  assert.equal((await blocked.send('state')).active, false);
  const broken = await setup({ failResume: true });
  assert.equal((await broken.send('start')).error, 'Device unavailable');
  assert.equal((await broken.send('state')).active, false);
  assert.equal(broken.counts().trackStops, 1);
  assert.equal(broken.counts().closes, 1);
});
test('browser ending capture cleans up and clears worker badge', async () => {
  const env = await setup();
  await env.send('start');
  env.ended();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal((await env.send('state')).active, false);
  assert.equal(env.notices[0].type, 'ended');
  assert.equal(env.counts().closes, 1);
});
