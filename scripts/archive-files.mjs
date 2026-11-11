import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';

export function zipArchive(files) {
  const text = /\.(?:js|mjs|json|html|css|svg|md|yml|ps1)$|(?:^|\/)LICENSE$|^\.(?:gitignore|gitattributes)$/;
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, bytes]) => {
    const normalized = text.test(name) ? new TextEncoder().encode(new TextDecoder().decode(bytes).replace(/\r\n/g, '\n')) : bytes;
    // ZIP stores a timezone-less DOS wall clock; fflate reads local fields.
    // A UTC Date shifts those fields on machines outside UTC.
    return [name, [normalized, { mtime: new Date(2020, 0, 1, 0, 0, 0) }]];
  })), { level: 6 });
}

export async function archiveFiles(root, include = () => true, prefix = '') {
  const result = {};
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const name = prefix + entry.name;
    if (entry.isSymbolicLink() || !include(name, entry)) continue;
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) Object.assign(result, await archiveFiles(file, include, name + '/'));
    else if (entry.isFile()) result[name] = new Uint8Array(await readFile(file));
  }
  return result;
}
