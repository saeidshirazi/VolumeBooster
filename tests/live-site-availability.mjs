import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// Availability audit only. A reachable landing page is never a playback pass.
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [name, url] of [['Spotify', 'https://open.spotify.com/'], ['Twitch', 'https://www.twitch.tv/eslcs'], ['Netflix', 'https://www.netflix.com/']]) {
    const page = await browser.newPage();
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      if (name === 'Spotify') {
        const track = page.locator('a[href^="/track/"]').first();
        if (await track.count()) await track.click();
        await page.getByRole('button', { name: /^Play$/ }).first().click({ timeout: 5000 }).catch(() => {});
      }
      if (name === 'Twitch') {
        await page.locator('[data-a-target="player-play-pause-button"]').click({ timeout: 5000 }).catch(() => {});
        await page.evaluate(() => { const video = document.querySelector('video'); if (video) { video.muted = true; video.play().catch(() => {}); } });
      }
      await page.waitForTimeout(5000);
      const diagnostics = await page.evaluate(() => ({ title: document.title, url: location.href, media: [...document.querySelectorAll('audio,video')].map(media => ({ paused: media.paused, readyState: media.readyState, hasSource: !!media.currentSrc })), text: document.body.innerText.slice(0, 1200) }));
      results.push({ name, status: response?.status(), playbackVerified: false, reason: 'No authenticated or selected playing media; landing-page reachability does not verify extension playback.', diagnostics });
    } catch (error) {
      results.push({ name, playbackVerified: false, reason: error.message });
    } finally { await page.close(); }
  }
} finally {
  await browser.close();
  await mkdir('test-results/live-sites', { recursive: true });
  await writeFile('test-results/live-sites/availability.json', JSON.stringify({ testedAt: new Date().toISOString(), results }, null, 2));
  for (const result of results) console.log(result.name, result.status || '', result.reason);
}
