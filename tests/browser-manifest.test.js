import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { browserManifest, targets } from '../scripts/browser-manifest.mjs';

const base = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
test('Chromium manifests retain capture and offscreen with no broad host access', () => {
  for (const target of ['chrome', 'edge', 'brave']) {
    const manifest = browserManifest(base, target);
    assert.equal(manifest.background.service_worker, 'background.js');
    assert.ok(manifest.permissions.includes('tabCapture') && manifest.permissions.includes('offscreen'));
    assert.equal(manifest.host_permissions, undefined);
    assert.ok(targets[target].shortcuts.startsWith(`${target}://`));
  }
});
test('Firefox has a native background, stable identity, and no unsupported permissions', () => {
  const manifest = browserManifest(base, 'firefox');
  assert.deepEqual(manifest.background, { scripts: ['background.js'], type: 'module' });
  assert.deepEqual(manifest.permissions, ['activeTab', 'scripting']);
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions, { required: ['none'] });
  assert.match(manifest.browser_specific_settings.gecko.id, /@/);
  assert.equal(manifest.minimum_chrome_version, undefined);
  assert.ok(base.permissions.includes('tabCapture'), 'base manifest must not be mutated');
});
test('unknown build targets fail instead of producing a mislabeled package', () => {
  assert.throws(() => browserManifest(base, 'unknown'));
});
