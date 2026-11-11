import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, writeFile, mkdtemp, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { browserTarget, extensionFolder, launchBrowser } from './chromium-target.mjs';
import { mediaFixture, installMediaProbe } from './media-fixture.mjs';
import { renderOutputFixture } from './output-fixture.mjs';

const results = [];
const check = (name, details = '') => { results.push({ name, details, passed: true }); console.log(`PASS ${name}`, details); };
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html><head><title>Quiet audio · VolumeBooster test</title></head><body style="background:#edf1e7;font-family:system-ui;padding:60px"><h1>Quiet audio test</h1><p>A locally generated tone. No external media or account required.</p><button id="play">Play quiet tone</button><button id="fullscreen">Enter fullscreen</button><script>
  document.querySelector('#play').onclick = async () => { if(window.audio) return; window.audio = new AudioContext(); const oscillator = audio.createOscillator(); const gain = audio.createGain(); gain.gain.value = 0.015; oscillator.frequency.value = 440; oscillator.connect(gain).connect(audio.destination); oscillator.start(); await audio.resume(); };
  document.querySelector('#fullscreen').onclick = () => document.documentElement.requestFullscreen();
  </script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
await mkdir('test-results', { recursive: true });
const resultDirectory = path.join('test-results', browserTarget);
await mkdir(resultDirectory, { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), 'volumebooster-test-'));
const memoryTest = process.argv.includes('--site-memory');
let context, cleanup = () => {};
let directServer;
try {
  let extension = extensionFolder;
  if (memoryTest) {
    extension = await mkdtemp(path.join(tmpdir(), 'volumebooster-memory-addon-'));
    await cp(extensionFolder, extension, { recursive: true });
    const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
    // Only this isolated test manifest pre-grants the local fixture host. The
    // shipped manifest requires a user-granted optional site permission.
    manifest.host_permissions = ['http://127.0.0.1/*'];
    await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
  }
  ({ context, cleanup } = await launchBrowser(profile, {
    headless: process.env.CI === 'true' || process.argv.includes('--headless'),
    ignoreDefaultArgs: ['--mute-audio'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--enable-unsafe-extension-debugging', '--autoplay-policy=no-user-gesture-required'],
    viewport: { width: 1100, height: 800 }
  }));
  context.setDefaultTimeout(15000);
  let worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  check(`${browserTarget} loads the native Manifest V3 build`, { extensionId, version: context.browser().version() });
  const errors = [];
  context.on('weberror', error => errors.push(error.error().message));
  const page = context.pages()[0] || await context.newPage();
  const url = `http://127.0.0.1:${server.address().port}`;
  await page.goto(url);
  if (browserTarget === 'brave') assert.equal(await page.evaluate(() => navigator.brave.isBrave()), true);
  await page.locator('#play').click();
  const cdp = await context.browser().newBrowserCDPSession();
  const targets = await cdp.send('Target.getTargets', { filter: [{}] });
  const pageTarget = targets.targetInfos.find(t => t.type === 'tab' && t.url.startsWith(url));
  assert.ok(pageTarget, JSON.stringify(targets));
  await cdp.send('Extensions.triggerAction', { id: extensionId, targetId: pageTarget.targetId });
  await new Promise(resolve => setTimeout(resolve, 800));
  // Trigger the browser action, granting activeTab exactly as a toolbar click.
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'http://127.0.0.1/*' }))[0].id);
  console.log('Target tab', tabId);
  // Create the real offscreen engine and attach a test-only audio probe via CDP.
  await worker.evaluate(async () => {
    if (!(await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length) {
      await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['USER_MEDIA'], justification: 'Integration test of tab audio playback.' });
    }
  });
  const { targetInfos } = await cdp.send('Target.getTargets');
  const target = targetInfos.find(t => t.url === `chrome-extension://${extensionId}/offscreen.html`);
  assert.ok(target, 'real offscreen document exists');
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
  let commandId = 0;
  async function protocol(method, params, targetSession = sessionId) {
    const id = ++commandId;
    const result = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cdp.off('Target.receivedMessageFromTarget', listener); reject(new Error('CDP audio probe timed out')); }, 10000);
      const listener = event => {
        if (event.sessionId !== targetSession) return;
        const data = JSON.parse(event.message);
        if (data.id !== id) return;
        clearTimeout(timer); cdp.off('Target.receivedMessageFromTarget', listener);
        if (data.result?.exceptionDetails) reject(new Error(JSON.stringify(data.result.exceptionDetails)));
        else if (data.error) reject(new Error(JSON.stringify(data.error)));
        else resolve(data.result);
      };
      cdp.on('Target.receivedMessageFromTarget', listener);
    });
    result.catch(() => {});
    await cdp.send('Target.sendMessageToTarget', { sessionId: targetSession, message: JSON.stringify({ id, method, params }) });
    return result;
  }
  const evaluate = async (expression, targetSession) => (await protocol('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, targetSession))?.result?.value;
  async function closeNativePopups() {
    const all = await cdp.send('Target.getTargets', { filter: [{}] });
    for (const info of all.targetInfos.filter(t => t.type !== 'tab' && t.url === `chrome-extension://${extensionId}/popup.html`)) {
      const { sessionId: popupId } = await cdp.send('Target.attachToTarget', { targetId: info.targetId, flatten: false });
      await evaluate('window.close()', popupId).catch(() => {});
    }
  }
  const probeScript = `(${installMediaProbe.toString()})()`;
  await evaluate(probeScript);
  // Exercise the real worker API while the captured website is still active.
  const send = (type, extra = {}) => evaluate(`chrome.runtime.sendMessage(${JSON.stringify({ target: 'worker', type, tabId, ...extra })})`);
  const initialPopup = targetInfos.find(t => t.url === `chrome-extension://${extensionId}/popup.html`);
  assert.ok(initialPopup, 'toolbar action opens the native popup');
  const { sessionId: initialPopupSession } = await cdp.send('Target.attachToTarget', { targetId: initialPopup.targetId, flatten: false });
  assert.equal(await evaluate(`document.querySelector('[data-volume="150"]').disabled`, initialPopupSession), false);
  await evaluate(`document.querySelector('[data-volume="150"]').click()`, initialPopupSession);
  await new Promise(resolve => setTimeout(resolve, 700));
  const started = await send('state');
  assert.equal(started.ok, true, JSON.stringify(started));
  assert.equal(started.active, true);
  assert.equal(started.volume, 150);
  check('One preset click starts boosting at the selected volume');
  await evaluate(`document.getElementById('reset').click()`, initialPopupSession);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal((await send('state')).volume, 100);
  check('Reset restores 100% through the actual popup');
  await new Promise(resolve => setTimeout(resolve, 1200));
  const baseline = (await evaluate('window.measure()'))[0];
  assert.ok(baseline.input > 0.001, JSON.stringify(baseline));
  assert.ok(baseline.output > 0.001, JSON.stringify(baseline));
  check('Real tab audio is captured and routed to playback', baseline);
  await send('volume', { volume: 200 });
  await new Promise(resolve => setTimeout(resolve, 400));
  const boosted = (await evaluate('window.measure()'))[0];
  const ratio = (boosted.output / boosted.input) / (baseline.output / baseline.input);
  assert.ok(ratio > 1.9 && ratio < 2.1, JSON.stringify(boosted));
  check('200% gain doubles the quiet signal relative to 100%', { ratio });
  await closeNativePopups();
  await page.bringToFront();
  await page.keyboard.press('Escape');
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  await new Promise(resolve => setTimeout(resolve, 350));
  const fullscreen = (await evaluate('window.measure()'))[0];
  assert.ok(fullscreen.output / fullscreen.input > 1.9);
  check('Boost continues during native document fullscreen', fullscreen);
  await send('volume', { volume: 210 });
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal((await send('state')).volume, 210);
  check('Volume command adjusts the real session in fullscreen');
  await send('mute');
  await new Promise(resolve => setTimeout(resolve, 600));
  assert.equal((await send('state')).muted, true);
  assert.ok((await evaluate('window.measure()'))[0].output < 0.0001);
  check('Fullscreen mute command silences output');
  await send('mute');
  await page.evaluate(() => document.exitFullscreen());
  await cdp.send('Extensions.triggerAction', { id: extensionId, targetId: pageTarget.targetId });
  await new Promise(resolve => setTimeout(resolve, 500));
  const popupTargets = await cdp.send('Target.getTargets', { filter: [{}] });
  const popupTarget = popupTargets.targetInfos.find(t => t.url === `chrome-extension://${extensionId}/popup.html`);
  assert.ok(popupTarget, JSON.stringify(popupTargets));
  const { sessionId: popupSession } = await cdp.send('Target.attachToTarget', { targetId: popupTarget.targetId, flatten: false });
  await evaluate(`document.querySelector('[data-volume="200"]').click()`, popupSession);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal((await send('state')).volume, 200);
  check('Rendered popup preset changes real audio session');
  const liveMeter = await send('meter');
  assert.ok(Number.isFinite(liveMeter.outputPeak) && liveMeter.outputPeak > 0.001 && liveMeter.outputPeak <= 1, JSON.stringify(liveMeter));
  assert.ok(['lookahead', 'ceiling'].includes(liveMeter.processor));
  check('Output meter reports the actual running processor and signal', liveMeter);
  await evaluate(`document.getElementById('increase').click()`, popupSession);
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal((await send('state')).volume, 225);
  await evaluate(`document.getElementById('decrease').click()`, popupSession);
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal((await send('state')).volume, 200);
  check('Plus and minus controls change volume by 25 percentage points');
  await evaluate(`(() => { const slider = document.getElementById('volume'); for (const value of [110, 220, 340, 175]) { slider.value = value; slider.dispatchEvent(new Event('input', { bubbles: true })); } })()`, popupSession);
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal((await send('state')).volume, 175);
  check('Rapid slider input keeps the latest volume');
  await evaluate(`document.querySelector('[data-volume="200"]').click()`, popupSession);
  await new Promise(resolve => setTimeout(resolve, 250));
  const popupLayout = await evaluate('({ bodyWidth: document.body.getBoundingClientRect().width, scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth })', popupSession);
  assert.equal(popupLayout.bodyWidth, 390);
  assert.ok(popupLayout.scrollWidth <= popupLayout.viewportWidth, JSON.stringify(popupLayout));
  check('Popup layout fits without horizontal overflow');
  const headless = process.env.CI === 'true' || process.argv.includes('--headless');
  assert.ok(await evaluate(`document.getElementById('enable').getBoundingClientRect().bottom <= ${headless ? '600' : 'innerHeight'}`, popupSession), 'main controls must fit within the desktop popup height');
  const screenshot = await protocol('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, popupSession);
  await writeFile(path.join(resultDirectory, 'popup.png'), Buffer.from(screenshot.data, 'base64'));
  await closeNativePopups();
  await page.bringToFront();
  await page.keyboard.press('Escape');
  assert.equal((await send('state')).active, true);
  check('Closing popup preserves audio session');
  // Suspend/restart the service worker while leaving the offscreen engine alive.
  const pageCdp = await context.newCDPSession(page);
  await pageCdp.send('ServiceWorker.enable');
  await pageCdp.send('ServiceWorker.stopAllWorkers');
  await page.bringToFront();
  await send('volume', { volume: 190 });
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.equal((await send('state')).volume, 190);
  check('Worker restart preserves session and command control');
  await page.reload();
  await page.locator('#play').click();
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.equal((await send('state')).active, true);
  assert.ok((await evaluate('window.measure()'))[0].output > 0.001);
  check('Page reload preserves capture and audio playback');
  await send('stop');
  assert.equal((await send('state')).active, false);
  assert.equal((await evaluate('window.measure()'))[0].state, 'closed');
  check('Stop releases audio context and session');
  const direct = await mediaFixture(); directServer = direct.server;
  await page.goto(direct.url);
  await page.locator('#play').click();
  await page.evaluate(installMediaProbe);
  await cdp.send('Extensions.triggerAction', { id: extensionId, targetId: pageTarget.targetId });
  await page.waitForTimeout(500);
  const directStarted = await send('start');
  assert.equal(directStarted.mode, 'page', JSON.stringify(directStarted));
  await closeNativePopups();
  await page.bringToFront();
  // Wait for both analyser windows to fill with this known quiet fixture,
  // rather than measuring a partly zero-filled startup buffer.
  await page.waitForFunction(() => {
    const signal = window.measureMedia()[0];
    return signal?.input > 0.0104 && signal.output > 0.0104;
  }, null, { timeout: 10000 });
  await page.waitForTimeout(60);
  const directBaseline = (await page.evaluate(() => window.measureMedia()))[0];
  assert.ok(directBaseline.input > 0.001 && directBaseline.output > 0.001, JSON.stringify(directBaseline));
  await send('volume', { volume: 200 });
  await page.waitForTimeout(350);
  const directBoosted = (await page.evaluate(() => window.measureMedia()))[0];
  const directRatio = (directBoosted.output / directBoosted.input) / (directBaseline.output / directBaseline.input);
  assert.ok(directRatio > 1.9 && directRatio < 2.1, JSON.stringify({ directBaseline, directBoosted }));
  check('Direct player mode doubles measured media audio without capture', { ratio: directRatio });
  await page.locator('#fullscreen').click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  assert.ok((await page.evaluate(() => window.measureMedia()))[0].output > 0.01);
  check('Direct player mode preserves native fullscreen and audio');
  await page.evaluate(() => document.exitFullscreen());
  await send('stop');
  assert.equal((await send('state')).active, false);
  assert.equal(await page.locator('#media').evaluate(media => media.paused), false);
  check('Direct player Stop preserves original playback');
  if (process.argv.includes('--limiter')) {
    for (const fallback of [false, true]) {
      const workletURL = `chrome-extension://${extensionId}/limiter-worklet.js`;
      const rendered = await evaluate(`(${renderOutputFixture.toString()})(${JSON.stringify({ workletURL, fallback })})`);
      assert.equal(rendered.quiet.processor, fallback ? 'ceiling' : 'lookahead');
      if (!fallback) { assert.ok(Number.isFinite(rendered.quiet.quietError) && rendered.quiet.quietError < 1e-5, JSON.stringify(rendered.quiet)); assert.ok(Number.isFinite(rendered.loud.stereoError) && rendered.loud.stereoError < 1e-5); }
      for (const result of [rendered.loud, rendered.mixed]) assert.ok(result.peak <= 0.98001 && result.peak > 0.8, JSON.stringify(result));
      check(`${fallback ? 'Fallback peak ceiling' : 'Look-ahead limiter'} bounds real browser DSP, including mixed sources`, rendered);
    }
  }
  if (memoryTest) {
    await send('start', { volume: 225 });
    await cdp.send('Extensions.triggerAction', { id: extensionId, targetId: pageTarget.targetId });
    await page.waitForTimeout(600);
    const memoryPopup = (await cdp.send('Target.getTargets')).targetInfos.find(target => target.url === `chrome-extension://${extensionId}/popup.html`);
    const { sessionId: memorySession } = await cdp.send('Target.attachToTarget', { targetId: memoryPopup.targetId, flatten: false });
    await evaluate(`document.getElementById('remember').click()`, memorySession);
    for (let i = 0; i < 30 && !(await send('state')).remembered; i++) await page.waitForTimeout(100);
    assert.equal((await send('state')).remembered, true);
    await send('volume', { volume: 250 });
    await send('protection', { enabled: false });
    await closeNativePopups();
    await page.addInitScript(installMediaProbe);
    await page.reload();
    await page.locator('#play').click();
    await page.waitForFunction(async () => {
      const state = await window.__volumeBoosterEngine_v1?.({ type: 'state' });
      return state?.active && state.volume === 250 && state.protection === false;
    });
    await page.waitForTimeout(300);
    const restored = (await page.evaluate(() => window.measureMedia()))[0];
    assert.ok(restored.gainOutput / restored.input > 2.4 && restored.gainOutput / restored.input < 2.6, JSON.stringify(restored));
    check('Remembered level and protection restore after reload with measured gain', restored);
    await send('stop');
    await page.locator('#media').evaluate(async media => { media.pause(); await media.play(); });
    await page.waitForTimeout(150);
    assert.equal((await send('state')).active, false);
    check('Stop suppresses automatic reactivation in the current document');
    await send('remember', { enabled: false });
    assert.equal((await send('state')).remembered, false);
    await page.reload();
    await page.locator('#play').click();
    await page.waitForTimeout(250);
    assert.equal((await send('state')).active, false);
    const registered = await worker.evaluate(() => chrome.scripting.getRegisteredContentScripts());
    assert.equal(registered.filter(script => /^vb-(main|restore)-/.test(script.id)).length, 0);
    check('Forget removes stored settings and automatic restoration scripts');
  }
  await cdp.send('Extensions.triggerAction', { id: extensionId, targetId: pageTarget.targetId });
  let shortcutPopup;
  for (let attempt = 0; attempt < 30; attempt++) {
    shortcutPopup = (await cdp.send('Target.getTargets')).targetInfos.find(target => target.url === `chrome-extension://${extensionId}/popup.html`);
    if (shortcutPopup) break;
    await page.waitForTimeout(100);
  }
  assert.ok(shortcutPopup, 'native shortcut popup must finish opening');
  const { sessionId: shortcutSession } = await cdp.send('Target.attachToTarget', { targetId: shortcutPopup.targetId, flatten: false });
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await evaluate(`document.readyState === 'complete' && document.getElementById('status')?.textContent !== 'Connecting…'`, shortcutSession)) break;
    await page.waitForTimeout(100);
  }
  await evaluate(`document.getElementById('shortcuts').click()`, shortcutSession);
  // Brave accepts brave:// in its UI but reports the Chromium canonical URL
  // through CDP. navigator.brave was verified above, so this is still Brave.
  const shortcutUrls = [`${browserTarget}://extensions/shortcuts`, ...(browserTarget === 'brave' ? ['chrome://extensions/shortcuts'] : [])];
  const isShortcutUrl = url => shortcutUrls.some(prefix => url.startsWith(prefix));
  let settingsTargets;
  for (let attempt = 0; attempt < 30; attempt++) {
    settingsTargets = (await cdp.send('Target.getTargets', { filter: [{}] })).targetInfos;
    if (settingsTargets.some(target => isShortcutUrl(target.url))) break;
    await page.waitForTimeout(100);
  }
  assert.ok(settingsTargets.some(target => isShortcutUrl(target.url)), JSON.stringify(settingsTargets.map(target => ({ type: target.type, url: target.url }))));
  check('Shortcuts opens this browser’s native extension shortcut settings');
  await closeNativePopups();
  for (const extra of context.pages().filter(tab => isShortcutUrl(tab.url()))) await extra.close();
  await page.bringToFront();
  if (process.env.LIVE_SITES === '1' || process.argv.includes('--live-sites')) {
    try {
      await page.goto('https://www.youtube.com/watch?v=aqz-KE-bpKQ', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.getByRole('button', { name: /Reject all|Accept all/i }).first().click({ timeout: 2500 }).catch(() => {});
      const video = page.locator('video').first();
      await video.waitFor({ timeout: 15000 });
      await video.evaluate(v => { v.muted = false; v.volume = 0.25; return v.play(); });
      await page.locator('.ytp-fullscreen-button').click();
      await new Promise(resolve => setTimeout(resolve, 800));
      const baselineFullscreen = await page.evaluate(() => !!document.fullscreenElement);
      results.push({ name: 'YouTube fullscreen before enabling capture', passed: baselineFullscreen, externalSite: true });
      console.log('YouTube fullscreen baseline (capture off):', baselineFullscreen);
      if (baselineFullscreen) await page.evaluate(() => document.exitFullscreen());
      await pageCdp.send('Runtime.evaluate', { expression: probeScript });
      await cdp.send('Extensions.triggerAction', { id: extensionId, targetId: pageTarget.targetId });
      await page.waitForTimeout(500);
      const live = await send('start');
      assert.equal(live.active, true, JSON.stringify(live));
      assert.equal(live.mode, 'page', 'YouTube should use fullscreen-preserving direct audio');
      check('YouTube direct audio mode starts without tab capture');
      worker = context.serviceWorkers().find(w => w.url().includes(extensionId));
      assert.equal((await worker.evaluate(() => chrome.tabCapture.getCapturedTabs())).filter(t => t.status === 'active').length, 0);
      await send('volume', { volume: 150 });
      await closeNativePopups();
      await page.bringToFront();
      await new Promise(resolve => setTimeout(resolve, 3000));
      const playback = (await page.evaluate(() => window.measure())).at(-1);
      assert.ok(playback.input > 0.0001 && playback.output > playback.input, JSON.stringify(playback));
      check('YouTube playback audio is amplified', playback);
      await page.waitForTimeout(5500);
      const requested = await pageCdp.send('Runtime.evaluate', {
        expression: 'document.querySelector("video").requestFullscreen()', userGesture: true, awaitPromise: true, returnByValue: true
      });
      assert.ok(!requested.exceptionDetails, JSON.stringify(requested));
      await page.waitForFunction(() => !!document.fullscreenElement);
      await new Promise(resolve => setTimeout(resolve, 3000));
      const signal = (await page.evaluate(() => window.measure())).at(-1);
      assert.ok(signal.input > 0.0001 && signal.output > signal.input, JSON.stringify(signal));
      check('YouTube live playback boosts in video fullscreen', signal);
      await page.evaluate(() => document.exitFullscreen());
      await send('stop');
    } catch (error) {
      console.log('LIVE SITE NOT VERIFIED:', error.message);
      const diagnostics = await page.evaluate(() => ({ title: document.title, fullscreenEnabled: document.fullscreenEnabled, video: [...document.querySelectorAll('video')].map(v => ({ paused: v.paused, readyState: v.readyState, currentTime: v.currentTime, error: v.error?.message })), text: document.body.innerText.slice(0, 1000) })).catch(() => ({}));
      console.log(diagnostics);
      await page.screenshot({ path: path.join(resultDirectory, 'youtube.png') }).catch(() => {});
      results.push({ name: 'YouTube live playback', passed: false, externalSite: true, error: error.message, diagnostics });
    }
  }
  assert.deepEqual(errors, []);
  check('No uncaught browser page errors');
} catch (error) {
  console.error(error);
  results.push({ name: 'Browser integration', passed: false, error: error.stack });
  process.exitCode = 1;
} finally {
  await writeFile(path.join(resultDirectory, 'browser.json'), JSON.stringify({ browser: browserTarget, fixtureHostGrant: memoryTest, testedAt: new Date().toISOString(), results }, null, 2));
  await context?.close();
  cleanup();
  server.close();
  directServer?.close();
}
