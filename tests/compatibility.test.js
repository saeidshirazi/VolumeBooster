import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageSupport, playbackStatus, errorAdvice } from '../extension/compatibility.js';

test('browser pages and protected extension stores are not advertised as boostable', () => {
  for (const url of ['chrome://settings', 'edge://extensions', 'brave://settings', 'about:addons', 'file:///movie.mp4', 'https://chromewebstore.google.com/detail/example']) assert.equal(pageSupport(url).supported, false);
  assert.equal(pageSupport('https://addons.mozilla.org/firefox', 'firefox').supported, false);
  assert.equal(pageSupport('https://www.youtube.com/watch?v=example').supported, true);
  assert.match(playbackStatus({ active: true }, { page: { supported: false } }).hint, /Turn off boost/);
});
test('compatibility guidance distinguishes native, capture, fallback and paused output', () => {
  const base = { active: true, mode: 'page', volume: 200, processor: 'lookahead', audioState: 'running' };
  assert.match(playbackStatus(base).label, /fullscreen available/);
  assert.match(playbackStatus({ ...base, mode: 'capture' }).hint, /F11/);
  assert.match(playbackStatus({ ...base, processor: 'ceiling' }).label, /fallback/);
  assert.equal(playbackStatus({ ...base, audioState: 'suspended' }).retry, true);
  assert.match(playbackStatus({ ...base, active: false, paused: true, remembered: true }).hint, /reload/);
});
test('restricted Firefox players get a clear limitation instead of capture instructions', () => {
  const status = playbackStatus({ active: false, support: { reason: 'cross-origin' } }, { capture: false });
  assert.match(status.label, /restricted in Firefox/);
  assert.ok(!status.hint.includes('F11'));
  assert.match(playbackStatus({ active: false, support: { reason: 'no-media' } }, { capture: false }).label, /Waiting/);
});
test('errors produce concrete output, permission, conflict and update recovery guidance', () => {
  assert.equal(errorAdvice('Audio could not start.').code, 'output');
  assert.equal(errorAdvice('Cannot access contents of this URL.').code, 'permission');
  assert.equal(errorAdvice('Cannot capture a tab with an active stream').code, 'conflict');
  assert.equal(errorAdvice('Unknown audio command.').code, 'connection');
  assert.match(errorAdvice('This player cannot be boosted; non-CORS sources are not supported.', false).hint, /Firefox/);
});
