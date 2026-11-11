import { mkdir, readFile, writeFile, cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { browserManifest, targets } from './browser-manifest.mjs';

export async function build(target) {
  const configuration = targets[target];
  if (!configuration) throw new Error(`Unknown browser target: ${target}`);
  const base = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  base.version = pkg.version;
  const output = path.resolve(configuration.folder);
  if (!output.startsWith(path.resolve('.') + path.sep)) throw new Error('Build output must stay inside the project');
  const staging = await mkdtemp(path.join(tmpdir(), 'volumebooster-build-'));
  try {
    await cp('extension', staging, { recursive: true });
    if (target === 'firefox') {
      await cp(path.join(staging, 'firefox-background.js'), path.join(staging, 'background.js'));
      await rm(path.join(staging, 'offscreen.js'));
      await rm(path.join(staging, 'offscreen.html'));
    }
    await rm(path.join(staging, 'firefox-background.js'));
    await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(browserManifest(base, target), null, 2) + '\n');
    await writeFile(path.join(staging, 'browser-config.js'), `export const browserConfig = ${JSON.stringify({ target, ...configuration })};\n`);
    await cp('LICENSE', path.join(staging, 'LICENSE'));
    // Each output contains only the reviewed runtime inventory. No stale file
    // can enter the new release archive when a previous output is refreshed.
    await mkdir(output, { recursive: true });
    for (const entry of await readdir(output)) {
      const resolved = path.resolve(output, entry);
      if (!resolved.startsWith(output + path.sep)) throw new Error('Unsafe build output path');
      await rm(resolved, { recursive: true, force: true });
    }
    await cp(staging, output, { recursive: true });
  } finally {
    if (staging.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(staging).startsWith('volumebooster-build-')) {
      await rm(staging, { recursive: true, force: true });
    }
  }
  console.log(`Built ${configuration.name}: ${output}`);
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv.find(arg => arg.startsWith('--target='))?.split('=')[1];
  for (const name of target ? [target] : Object.keys(targets)) await build(name);
}
