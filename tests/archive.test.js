import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { zipArchive } from '../scripts/archive-files.mjs';
import { execFileSync } from 'node:child_process';

test('release ZIPs use stable timestamps and text endings while preserving binary assets', () => {
  const encoder = new TextEncoder(), binary = new Uint8Array([0, 13, 10, 255]);
  const a = zipArchive({ 'manifest.json': encoder.encode('{}\r\n'), 'icons/icon.png': binary });
  const b = zipArchive({ 'manifest.json': encoder.encode('{}\n'), 'icons/icon.png': binary });
  assert.deepEqual(a, b);
  assert.deepEqual(unzipSync(a)['icons/icon.png'], binary);
});

test('archive hashes are identical across UTC and non-UTC build timezones', () => {
  const source = `import { zipArchive } from ${JSON.stringify(new URL('../scripts/archive-files.mjs', import.meta.url).href)}; process.stdout.write(Buffer.from(zipArchive({'test.js':new TextEncoder().encode('hello\\n')})).toString('hex'));`;
  const build = TZ => execFileSync(process.execPath, ['--input-type=module', '-e', source], { env: { ...process.env, TZ }, encoding: 'utf8' });
  const utc = build('UTC');
  assert.equal(build('America/Toronto'), utc);
  assert.equal(build('Pacific/Honolulu'), utc);
  assert.equal(build('Asia/Tokyo'), utc);
});
