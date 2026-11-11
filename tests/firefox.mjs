import { Builder, By, until } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { firefox as playwrightFirefox } from 'playwright';
import { mkdir, writeFile, mkdtemp, readFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { mediaFixture, installMediaProbe } from './media-fixture.mjs';

const { server, url } = await mediaFixture();
const results = [], errors = [];
const pass = (name, details = '') => { results.push({ name, passed: true, details }); console.log('PASS', name, details); };
await mkdir('test-results/firefox', { recursive: true });
const addonId = 'volumebooster@saeidshirazi.github.io';
const uuid = crypto.randomUUID(), base = `moz-extension://${uuid}/`;
const scratch = await mkdtemp(path.join(tmpdir(), 'volumebooster-firefox-'));
const memoryTest = process.argv.includes('--site-memory');
const options = new firefox.Options()
  .setBinary(process.env.VOLUMEBOOSTER_FIREFOX_BINARY || playwrightFirefox.executablePath())
  .addArguments('-headless')
  .setPreference('extensions.webextensions.uuids', JSON.stringify({ [addonId]: uuid }))
  .setPreference('media.autoplay.default', 0);
const service = new firefox.ServiceBuilder().setEnvironment({ ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' });
let driver;
try {
  driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).setFirefoxService(service).build();
  await driver.manage().setTimeouts({ script: 15000, pageLoad: 25000 });
  await driver.manage().window().setRect({ width: 1100, height: 850 });
  let addonPath = path.resolve('dist-firefox');
  if (memoryTest) {
    addonPath = path.join(scratch, 'addon'); await cp('dist-firefox', addonPath, { recursive: true });
    const manifest = JSON.parse(await readFile(path.join(addonPath, 'manifest.json'), 'utf8'));
    manifest.host_permissions = ['http://127.0.0.1/*'];
    await writeFile(path.join(addonPath, 'manifest.json'), JSON.stringify(manifest));
  }
  await driver.installWebExtension(addonPath, { permanent: false });
  pass('Firefox installs the actual MV3 add-on', (await driver.getCapabilities()).get('browserVersion'));
  const click = async selector => (await driver.wait(until.elementLocated(By.css(selector)), 10000)).click();
  await driver.get(url);
  await click('#play');
  await driver.executeScript(installMediaProbe);
  const mediaHandle = await driver.getWindowHandle();
  await driver.setContext('chrome');
  await driver.wait(until.elementLocated(By.css('#unified-extensions-button')), 10000);
  await click('#unified-extensions-button');
  await click(`[data-extensionid="${addonId}"] .unified-extensions-item-action-button`);
  pass('Firefox native extension action grants access to the selected tab');
  await driver.executeScript(() => {
    for (const panel of document.querySelectorAll('panel')) if (panel.state === 'open') panel.hidePopup();
  });
  await driver.setContext('content');
  await driver.switchTo().newWindow('tab');
  await driver.get(base + 'popup.html');
  const controller = await driver.getWindowHandle();
  const target = await driver.executeAsyncScript((url, done) => {
    browser.tabs.query({}).then(tabs => done(tabs.find(tab => tab.url?.startsWith(url))?.id));
  }, url);
  assert.ok(Number.isInteger(target), 'activeTab exposes the fixture tab URL');
  const send = (type, extra = {}) => driver.executeAsyncScript((tabId, type, extra, done) => {
    (async () => {
      if (type === 'start') await browser.tabs.update(tabId, { active: true });
      return browser.runtime.sendMessage({ target: 'worker', type, tabId, ...extra });
    })().then(done, error => done({ ok: false, error: error.message }));
  }, target, type, extra);
  const started = await send('start', { volume: 100 });
  assert.equal(started.ok, true, JSON.stringify(started));
  assert.equal(started.mode, 'page');
  pass('Firefox direct audio mode starts without Chromium APIs');
  await driver.switchTo().window(mediaHandle);
  await driver.sleep(400);
  const baseline = await driver.executeScript(() => window.measureMedia()[0]);
  assert.ok(baseline.input > 0.001 && baseline.output > 0.001, JSON.stringify(baseline));
  await driver.switchTo().window(controller);
  assert.equal((await send('volume', { volume: 200 })).volume, 200);
  await driver.switchTo().window(mediaHandle);
  await driver.sleep(350);
  const boosted = await driver.executeScript(() => window.measureMedia()[0]);
  const ratio = (boosted.output / boosted.input) / (baseline.output / baseline.input);
  assert.ok(ratio > 1.9 && ratio < 2.1, JSON.stringify({ baseline, boosted, ratio }));
  pass('Firefox 200% doubles the measured audio signal', { ratio });
  await click('#fullscreen');
  await driver.wait(() => driver.executeScript(() => !!document.fullscreenElement), 10000);
  assert.ok((await driver.executeScript(() => window.measureMedia()[0])).output > 0.01);
  pass('Firefox native fullscreen keeps boosted audio playing');
  await driver.executeScript(() => document.exitFullscreen());
  await driver.switchTo().window(controller);
  assert.equal((await send('mute')).muted, true);
  await driver.switchTo().window(mediaHandle);
  await driver.sleep(500);
  assert.ok((await driver.executeScript(() => window.measureMedia()[0])).output < 0.0001);
  await driver.switchTo().window(controller);
  assert.equal((await send('mute')).muted, false);
  pass('Firefox mute and unmute affect actual audio output');
  // The same shipped popup renderer, attached to the selected source tab.
  // Replace DOM nodes to remove the first module's event listeners before a
  // test-only re-import; production source and the archive stay untouched.
  await driver.executeAsyncScript((tabId, url, done) => {
    browser.tabs.query = async () => [{ id: tabId, url }];
    document.body.replaceWith(document.body.cloneNode(true));
    import('./popup.js?firefox-ui-test').then(() => done(true), error => done(error.message));
  }, target, url);
  await click('[data-volume="150"]');
  await driver.wait(async () => (await send('state')).volume === 150, 5000);
  await click('#increase');
  await driver.wait(async () => (await send('state')).volume === 175, 5000);
  await click('#reset');
  await driver.wait(async () => (await send('state')).volume === 100, 5000);
  pass('Firefox popup presets, plus and Reset control the real session');
  await writeFile('test-results/firefox/popup.png', Buffer.from(await driver.takeScreenshot(), 'base64'));
  await send('stop');
  assert.equal((await send('state')).active, false);
  await driver.switchTo().window(mediaHandle);
  assert.equal(await driver.executeScript(() => document.getElementById('media').paused), false);
  pass('Firefox Stop preserves original media playback');
  await driver.navigate().refresh();
  await driver.switchTo().window(controller);
  assert.equal((await send('state')).active, false);
  pass('Firefox navigation revokes access and leaves no stale boosted session');
  if (memoryTest) {
    await driver.switchTo().window(mediaHandle); await click('#play');
    await driver.switchTo().window(controller);
    assert.equal((await send('start', { volume: 225 })).active, true);
    await click('#remember');
    await driver.wait(async () => (await send('state')).remembered === true, 5000);
    await send('volume', { volume: 250 }); await send('protection', { enabled: false });
    await driver.switchTo().window(mediaHandle); await driver.navigate().refresh(); await click('#play');
    await driver.wait(() => driver.executeScript(async () => {
      const state = await window.__volumeBoosterEngine_v1?.({ type: 'state' });
      return state?.active && state.volume === 250 && state.protection === false;
    }), 10000);
    pass('Firefox remembers the site level and restores it after reload');
    await driver.switchTo().window(controller); await send('stop');
    await driver.switchTo().window(mediaHandle);
    await driver.executeScript(async () => { const media = document.getElementById('media'); media.pause(); await media.play(); });
    await driver.switchTo().window(controller); assert.equal((await send('state')).active, false);
    await send('remember', { enabled: false });
    await driver.switchTo().window(mediaHandle); await driver.navigate().refresh(); await click('#play');
    await driver.switchTo().window(controller); assert.equal((await send('state')).active, false);
    assert.equal((await send('state')).remembered, false);
    pass('Firefox Stop and Forget prevent unwanted automatic reactivation');
  }
  await driver.switchTo().window(mediaHandle);
  await driver.get(url + '/unsafe');
  await click('#play');
  await driver.setContext('chrome');
  await click('#unified-extensions-button');
  await click(`[data-extensionid="${addonId}"] .unified-extensions-item-action-button`);
  await driver.executeScript(() => { for (const panel of document.querySelectorAll('panel')) if (panel.state === 'open') panel.hidePopup(); });
  await driver.setContext('content');
  await driver.switchTo().window(controller);
  const unsupported = await send('start');
  assert.equal(unsupported.ok, false);
  assert.match(unsupported.error, /not supported/);
  assert.equal((await send('state')).active, false);
  await driver.switchTo().window(mediaHandle);
  assert.equal(await driver.executeScript(() => document.getElementById('media').paused), false);
  pass('Firefox unsupported cross-origin player shows an error without muting original playback');
  await driver.switchTo().window(controller);
  await click('#shortcuts');
  await driver.sleep(350);
  await driver.setContext('chrome');
  assert.ok(await driver.executeScript(() => [...gBrowser.tabs].some(tab => tab.linkedBrowser.currentURI.spec.startsWith('about:addons'))));
  await driver.setContext('content');
  pass('Firefox Shortcuts opens the native add-on shortcut manager');
  await driver.setContext('chrome');
  errors.push(...await driver.executeScript(base => Services.console.getMessageArray().filter(message => message.sourceName?.startsWith(base) && !(message.flags & Ci.nsIScriptError.warningFlag)).map(message => message.errorMessage), base));
  await driver.setContext('content');
  assert.deepEqual(errors, []);
  pass('Firefox reports no extension JavaScript errors');
} catch (error) {
  console.error(error);
  let diagnostics;
  if (driver) {
    await driver.setContext('content').catch(() => {});
    const handles = await driver.getAllWindowHandles().catch(() => []);
    for (const handle of handles) {
      await driver.switchTo().window(handle).catch(() => {});
      const info = await driver.executeScript(() => ({ url: location.href, focus: document.hasFocus(), visibility: document.visibilityState, activation: navigator.userActivation?.hasBeenActive, contexts: window.audioContexts?.map(c => ({ state: c.state, time: c.currentTime })), media: [...document.querySelectorAll('audio')].map(a => ({ paused: a.paused, time: a.currentTime, ready: a.readyState })) })).catch(() => null);
      if (info?.media.length) { diagnostics = info; break; }
    }
  }
  console.error('Firefox diagnostics:', diagnostics);
  results.push({ name: 'Firefox integration', passed: false, error: error.stack, diagnostics });
  if (driver) await writeFile('test-results/firefox/failure.png', Buffer.from(await driver.takeScreenshot(), 'base64')).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile('test-results/firefox/report.json', JSON.stringify({ browser: 'Firefox', fixtureHostGrant: memoryTest, testedAt: new Date().toISOString(), results }, null, 2));
  await driver?.quit();
  server.close();
}
