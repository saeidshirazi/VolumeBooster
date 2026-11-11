import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import assert from 'node:assert/strict';
import path from 'node:path';
import { targets } from './browser-manifest.mjs';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const output = path.join('release', process.argv.includes('--public') ? 'public' : 'local', `v${version}`);
const checksums = [];
for (const target of [...Object.keys(targets), 'source', 'store-assets']) {
  const suffix = target === 'firefox' ? 'firefox-unsigned.xpi' : `${target}.zip`;
  const name = `volumebooster-${version}-${suffix}`;
  const bytes = await readFile(path.join(output, name));
  const files = unzipSync(bytes), names = Object.keys(files);
  assert.ok(names.length > 0);
  assert.ok(!names.some(file => /(^|\/)(node_modules|\.git|test-results|release|dist(?:-\w+)?|\.env)(\/|$)/.test(file)));
  assert.ok(names.includes('LICENSE'));
  if (target === 'store-assets') {
    assert.ok(names.includes('STORE-SUBMISSION.md') && names.includes('PRIVACY.md'));
    for (const [name, width, height] of [
      ['icon-128', 128, 128], ['edge-icon-300', 300, 300], ['screenshot-1280x800', 1280, 800], ['promo-440x280', 440, 280], ['marquee-1400x560', 1400, 560]
    ]) {
      const png = Buffer.from(files[`assets/${name}.png`] || []);
      assert.equal(png.readUInt32BE(16), width); assert.equal(png.readUInt32BE(20), height);
    }
  } else if (target === 'source') {
    for (const required of ['README.md', 'PRIVACY.md', 'scripts/build.mjs', 'package-lock.json', 'extension/page-engine.js']) assert.ok(names.includes(required), required);
  } else {
    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    assert.equal(manifest.version, version);
    assert.equal(manifest.homepage_url, 'https://github.com/saeidshirazi/VolumeBooster');
    assert.equal(manifest.host_permissions, undefined);
    assert.ok(!manifest.permissions.includes('tabs'));
    for (const required of ['popup.html', 'popup.js', 'page-engine.js', 'browser-config.js', 'icons/128.png', 'site-settings.js', 'restore-bridge.js', 'audio-output.js', 'limiter-worklet.js', 'limiter-core.js', 'compatibility.js']) assert.ok(names.includes(required), required);
    assert.ok(manifest.permissions.includes('storage'));
    assert.deepEqual(manifest.optional_host_permissions, ['http://*/*', 'https://*/*']);
    assert.deepEqual(manifest.web_accessible_resources[0].resources, ['limiter-worklet.js', 'limiter-core.js']);
    const config = strFromU8(files['browser-config.js']);
    assert.ok(config.includes(`"target":"${target}"`));
    if (target === 'firefox') {
      assert.deepEqual(manifest.background.scripts, ['background.js']);
      assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions, { required: ['none'] });
      assert.ok(!manifest.permissions.includes('tabCapture') && !manifest.permissions.includes('offscreen'));
      assert.ok(!names.includes('offscreen.js') && !names.includes('offscreen.html'));
    } else {
      assert.equal(manifest.background.service_worker, 'background.js');
      assert.ok(manifest.permissions.includes('tabCapture'));
    }
  }
  checksums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
  console.log(`Verified ${name}: ${names.length} files`);
}
const checksumText = checksums.join('\n') + '\n';
const checksumFile = path.join(output, 'SHA256SUMS.txt');
if (process.argv.includes('--public')) {
  try { await writeFile(checksumFile, checksumText, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; assert.equal(await readFile(checksumFile, 'utf8'), checksumText); }
} else await writeFile(checksumFile, checksumText);
