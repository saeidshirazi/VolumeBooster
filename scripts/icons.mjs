import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

// Rasterize the source SVG so the browser toolbar and popup share one mark.
const svg = await readFile(new URL('../extension/icons/logo.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const size of [16, 32, 48, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
    await writeFile(new URL(`../extension/icons/${size}.png`, import.meta.url), await page.screenshot({ omitBackground: true }));
    await page.close();
  }
} finally { await browser.close(); }
