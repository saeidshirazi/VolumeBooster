import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from './build.mjs';
import { targets } from './browser-manifest.mjs';
import { archiveFiles, zipArchive } from './archive-files.mjs';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const publicBuild = process.argv.includes('--public');
const output = path.join('release', publicBuild ? 'public' : 'local', `v${version}`);
if (publicBuild && await access(path.join(output, 'SHA256SUMS.txt')).then(() => true, () => false)) {
  throw new Error('This public release is already sealed. Increment the version before replacing verified archives.');
}
await mkdir(output, { recursive: true });
for (const target of Object.keys(targets)) {
  const directory = await build(target);
  const suffix = target === 'firefox' ? 'firefox-unsigned.xpi' : `${target}.zip`;
  await writeFile(path.join(output, `volumebooster-${version}-${suffix}`), zipArchive(await archiveFiles(directory)));
}
const rootFiles = new Set(['.gitignore', '.gitattributes', 'package.json', 'package-lock.json', 'LICENSE', 'README.md', 'CHANGELOG.md', 'TESTING.md', 'CROSS-BROWSER.md', 'PRIVACY.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md']);
const folders = new Set(['extension', 'scripts', 'tests', 'docs', '.github']);
const source = await archiveFiles('.', (name, entry) => {
  if (name.split('/').some(part => part.startsWith('.') && !['.github', '.gitignore', '.gitattributes'].includes(part))) return false;
  if (entry.isDirectory()) return folders.has(name.split('/')[0]);
  return rootFiles.has(name) || (folders.has(name.split('/')[0]) && /\.(?:js|mjs|json|html|css|svg|png|md|yml|ps1)$/.test(name));
});
await writeFile(path.join(output, `volumebooster-${version}-source.zip`), zipArchive(source));
const store = await archiveFiles('docs/store');
store['STORE-SUBMISSION.md'] = new Uint8Array(await readFile('docs/STORE-SUBMISSION.md'));
store['PRIVACY.md'] = new Uint8Array(await readFile('PRIVACY.md'));
store['LICENSE'] = new Uint8Array(await readFile('LICENSE'));
await writeFile(path.join(output, `volumebooster-${version}-store-assets.zip`), zipArchive(store));
console.log(`Packaged four browsers, source, and store assets: ${output}`);
