import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudioGraph, normalizeVolume, resumeAudio } from '../extension/audio.js';

test('a stalled audio resume reports an actionable error instead of waiting forever', async () => {
  await assert.rejects(resumeAudio({ state: 'suspended', resume: () => new Promise(() => {}) }, 10), /Audio could not start/);
});

test('volume is clamped, rounded, and rejects invalid messages', () => {
  assert.equal(normalizeVolume(-5), 0);
  assert.equal(normalizeVolume(900), 400);
  assert.equal(normalizeVolume(149.7), 150);
  for (const value of [NaN, Infinity, '200', undefined, null]) assert.throws(() => normalizeVolume(value));
});
test('audio routes through protection, ramps gain, and disconnects on stop', () => {
  const nodes = [];
  function node() {
    const n = { connections: [], disconnects: 0, connect(other) { this.connections.push(other); }, disconnect() { this.connections = []; this.disconnects++; } };
    nodes.push(n); return n;
  }
  const calls = [];
  const context = {
    currentTime: 5, destination: {}, createMediaStreamSource: node,
    createGain: () => Object.assign(node(), { gain: { value: 1, cancelScheduledValues: t => calls.push(['cancel', t]), setTargetAtTime: (...args) => calls.push(args) } }),
    createDynamicsCompressor: () => Object.assign(node(), Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(k => [k, { value: 0 }])))
  };
  const graph = createAudioGraph(context, {}, 200);
  const [source, gain, compressor] = nodes;
  assert.equal(gain.gain.value, 2);
  assert.deepEqual(source.connections, [gain]);
  assert.deepEqual(gain.connections, [compressor]);
  assert.deepEqual(compressor.connections, [context.destination]);
  graph.setVolume(300);
  assert.deepEqual(calls.at(-1), [3, 5, 0.025]);
  graph.setVolume(300, true);
  assert.deepEqual(calls.at(-1), [0, 5, 0.025]);
  graph.setProtection(false);
  assert.deepEqual(gain.connections, [context.destination]);
  assert.deepEqual(compressor.connections, []);
  graph.setProtection(true);
  graph.dispose();
  assert.ok(nodes.every(n => n.connections.length === 0));
});
