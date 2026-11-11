import assert from 'node:assert/strict';

// Short endurance regression, not an overnight or physical-device test.
export async function verifyEndurance(sample, seconds = 120) {
  const samples = [];
  const started = Date.now();
  for (let i = 0; i < seconds / 6; i++) {
    await new Promise(resolve => setTimeout(resolve, 6000));
    const signal = await sample();
    assert.equal(signal.state, 'running', JSON.stringify(signal));
    assert.ok(Number.isFinite(signal.output) && signal.input > 0.001 && signal.output > 0.001, JSON.stringify(signal));
    const ratio = signal.output / signal.input;
    assert.ok(ratio > 1.7 && ratio < 2.3, JSON.stringify(signal));
    samples.push({ elapsedMs: Date.now() - started, ...signal });
  }
  return { durationMs: Date.now() - started, samples };
}
