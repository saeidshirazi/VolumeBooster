import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { zipArchive } from '../scripts/archive-files.mjs';

test('release ZIPs use stable timestamps and text endings while preserving binary assets', () => {
  const encoder = new TextEncoder(), binary = new Uint8Array([0, 13, 10, 255]);
  const a = zipArchive({ 'manifest.json': encoder.encode('{}\r\n'), 'icons/icon.png': binary });
  const b = zipArchive({ 'manifest.json': encoder.encode('{}\n'), 'icons/icon.png': binary });
  assert.deepEqual(a, b);
  assert.deepEqual(unzipSync(a)['icons/icon.png'], binary);
});
