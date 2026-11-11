import path from 'node:path';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { targets } from '../scripts/browser-manifest.mjs';

export const browserTarget = process.argv.find(arg => arg.startsWith('--browser='))?.split('=')[1] || process.env.VOLUMEBOOSTER_BROWSER || 'chrome';
if (!['chrome', 'edge', 'brave'].includes(browserTarget)) throw new Error('Chromium target must be chrome, edge, or brave');
export const extensionFolder = path.resolve(targets[browserTarget].folder);
const braveBinaries = {
  win32: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  darwin: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  linux: '/usr/bin/brave-browser'
};
export const launchOptions = browserTarget === 'brave'
  ? { executablePath: process.env.VOLUMEBOOSTER_BRAVE_BINARY || braveBinaries[process.platform] }
  : { channel: browserTarget === 'edge' ? 'msedge' : 'chromium' };

export async function launchBrowser(profile, options) {
  if (browserTarget !== 'brave') return { context: await chromium.launchPersistentContext(profile, { ...launchOptions, ...options }), cleanup() {} };
  // Brave's updater can re-launch the Windows process, dropping inherited
  // debugging pipes. Use its native TCP endpoint in the same isolated profile.
  const child = spawn(launchOptions.executablePath, [
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--no-sandbox', ...(options.headless ? ['--headless=new'] : []), ...options.args, 'about:blank'
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let logs = '';
  child.stderr.on('data', data => { logs += data; });
  child.on('error', error => { logs += error.message; });
  try {
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
      const active = await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '');
      if (active) { port = active.split('\n')[0]; break; }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (!port) throw new Error(`Brave did not expose its isolated debugging endpoint: ${logs}`);
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    return { context, cleanup: () => child.kill() };
  } catch (error) { child.kill(); throw error; }
}
