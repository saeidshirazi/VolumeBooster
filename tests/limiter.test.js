import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LookaheadLimiter } from '../extension/limiter-core.js';

function render(channels, enabled = true, rate = 48000, block = 128) {
  const limiter = new LookaheadLimiter(rate), length = channels[0].length;
  const output = channels.map(() => new Float32Array(length));
  for (let start = 0; start < length; start += block) {
    limiter.process(channels.map(channel => channel.subarray(start, start + block)), output.map(channel => channel.subarray(start, start + block)), enabled);
  }
  return { output, limiter };
}
test('look-ahead limiter leaves quiet audio linear apart from its declared delay', () => {
  const input = Float32Array.from({ length: 5000 }, (_, i) => Math.sin(i * 0.1) * 0.2);
  const { output, limiter } = render([input]);
  for (let i = limiter.delay; i < input.length; i++) assert.ok(Math.abs(output[0][i] - input[i - limiter.delay]) < 1e-6);
  assert.equal(limiter.meter().reductionDb, 0);
});
test('impulses and loud stereo material stay below the sample ceiling at multiple rates', () => {
  for (const rate of [44100, 48000, 96000, 192000]) {
    const left = Float32Array.from({ length: 8000 }, (_, i) => Math.sin(i * 0.17) * 4);
    const right = Float32Array.from({ length: 8000 }, (_, i) => Math.cos(i * 0.11) * 3);
    left[2000] = 20; right[2200] = -20;
    const { output, limiter } = render([left, right], true, rate);
    assert.ok(output.every(channel => channel.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 0.980001)));
    assert.ok(limiter.meter().reductionDb > 6);
  }
});
test('stereo channels share gain rather than shifting the stereo image', () => {
  const left = Float32Array.from({ length: 5000 }, (_, i) => Math.sin(i * 0.08) * 4);
  const right = Float32Array.from(left, sample => sample * 0.5);
  const { output } = render([left, right]);
  for (let i = 0; i < left.length; i++) assert.ok(Math.abs(output[1][i] - output[0][i] * 0.5) < 1e-6);
});
test('disabling protection is linear and the processor handles silence and invalid samples', () => {
  const input = Float32Array.from({ length: 2000 }, () => 2);
  const { output, limiter } = render([input], false);
  assert.equal(output[0][limiter.delay + 10], 2);
  const bad = new Float32Array([NaN, Infinity, -Infinity, 0]);
  assert.ok(render([bad]).output[0].every(Number.isFinite));
  limiter.resetMeter(); assert.equal(limiter.meter().outputPeak, 0);
});
