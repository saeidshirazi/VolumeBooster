import { normalizeVolume } from './audio.js';
import { browserConfig } from './browser-config.js';
import { siteIdentity } from './site-settings.js';
import { pageSupport, playbackStatus, errorAdvice } from './compatibility.js';
const chrome = globalThis.browser || globalThis.chrome;

const $ = id => document.getElementById(id);
let tabId, sitePattern, isPrivate = false, supported = false, state, busy = false, permissionBusy = false, busyLabel = '', queuedVolume, sendingVolume = false;
let supportInfo = { supported: false, reason: 'Connecting…', hint: '' }, lastError;
let meterTimer, meterPending = false, meterClosed = false;
async function updateMeter() {
  if (meterClosed) return;
  if (!meterPending && state?.active && !document.hidden) {
    meterPending = true;
    try {
      const meter = await send('meter');
      if (state?.active && meter.audioState && meter.audioState !== state.audioState) render({ ...state, audioState: meter.audioState });
      const peak = Math.max(0, Math.min(1, meter.outputPeak || 0));
      $('output-meter').value = peak;
      $('meter-label').textContent = meter.reductionDb > 0.5 && meter.protection ? `Limiting · −${meter.reductionDb.toFixed(1)} dB` : peak > 0.0001 ? `${(20 * Math.log10(peak)).toFixed(0)} dBFS · ${meter.processor === 'ceiling' ? 'peak ceiling' : 'output'}` : 'Output · quiet';
    } catch { /* Meter failure must not change audio or replace action errors. */ }
    finally { meterPending = false; }
  } else if (!state?.active) { $('output-meter').value = 0; $('meter-label').textContent = 'Output · off'; }
  meterTimer = setTimeout(updateMeter, 150);
}
addEventListener('pagehide', () => { meterClosed = true; clearTimeout(meterTimer); });

function render(s) {
  state = s;
  const disabled = (!supported && !s.active) || busy || permissionBusy;
  $('reading').replaceChildren(document.createTextNode(s.volume), Object.assign(document.createElement('span'), { textContent: '%' }));
  $('volume').value = s.volume;
  $('volume').style.background = `linear-gradient(to right,var(--accent) ${s.volume / 4}%,var(--track) ${s.volume / 4}%)`;
  $('volume').disabled = disabled;
  $('volume').setAttribute('aria-valuetext', `${s.volume}%${s.muted ? ', muted' : ''}`);
  $('decrease').disabled = disabled || s.volume === 0;
  $('increase').disabled = disabled || s.volume === 400;
  $('reset').disabled = disabled || s.volume === 100;
  $('protection').disabled = disabled || !s.active || sendingVolume;
  $('protection').checked = s.protection;
  $('remember').checked = Boolean(s.remembered);
  $('remember').disabled = disabled || !supported || isPrivate || sendingVolume;
  $('remember').title = isPrivate ? 'Site preferences are not saved in private windows.' : 'Allow access to this site to restore its level after reload.';
  $('mute').disabled = disabled || !s.active || sendingVolume;
  $('mute').setAttribute('aria-pressed', String(s.muted));
  $('mute-label').textContent = s.muted ? 'Unmute' : 'Mute';
  $('enable').disabled = disabled || sendingVolume;
  $('enable').setAttribute('aria-pressed', String(s.active));
  $('enable-label').textContent = busy ? busyLabel : sendingVolume && !s.active ? 'Starting…' : s.active ? 'Turn off boost' : 'Turn on boost';
  $('enable').classList.toggle('stop', s.active);
  $('dot').classList.toggle('active', s.active && !s.muted);
  const compatibility = playbackStatus(s, { capture: browserConfig.capture, page: supportInfo, error: lastError });
  document.querySelector('.tab').dataset.tone = compatibility.tone;
  $('status').textContent = compatibility.label;
  $('mode').textContent = s.active ? (!s.protection ? 'Protection off' : s.processor === 'lookahead' ? 'Look-ahead protection · local' : s.processor === 'ceiling' ? 'Peak ceiling · local' : 'Reload page after an update') : 'Only this tab. Always local.';
  $('level').textContent = !s.active && s.remembered ? 'Saved level · boost is off' : s.muted ? 'Muted' : s.volume === 100 ? 'Original level' : s.volume === 0 ? 'Silent' : s.volume > 100 ? `${(s.volume / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}× volume` : 'A little quieter';
  $('hint').textContent = compatibility.hint;
  $('hint').classList.toggle('warning', compatibility.tone === 'warning');
  $('retry-audio').hidden = !(compatibility.retry || (lastError && errorAdvice(lastError).code === 'output'));
  document.querySelectorAll('[data-volume]').forEach(button => {
    button.disabled = disabled;
    button.classList.toggle('selected', +button.dataset.volume === s.volume);
    button.setAttribute('aria-pressed', String(+button.dataset.volume === s.volume));
  });
}

function showError(error, blocking = true) {
  const advice = errorAdvice(error, browserConfig.capture);
  lastError = blocking ? error : undefined;
  $('error').textContent = `${advice.label}. ${advice.hint}`;
  $('error').hidden = false;
}
async function send(type, extra = {}) {
  const reply = await chrome.runtime.sendMessage({ target: 'worker', type, tabId, ...extra });
  if (!reply?.ok) throw new Error(reply?.error || 'Could not connect. Reload the extension and try again.');
  return reply;
}

async function action(type, extra) {
  if (busy || sendingVolume || (!supported && !state?.active)) return;
  busyLabel = type === 'stop' ? 'Stopping…' : type === 'start' ? 'Starting…' : 'Updating…';
  busy = true; lastError = undefined; $('error').hidden = true; render(state);
  try { render(await send(type, extra)); }
  catch (error) {
    showError(error, type !== 'remember');
    try { render(await send('state')); } catch { /* Keep the last known state. */ }
  } finally { busy = false; render(state); }
}

async function setVolume(value) {
  if (busy || (!supported && !state?.active)) return;
  queuedVolume = normalizeVolume(value);
  render({ ...state, volume: queuedVolume });
  if (sendingVolume) return;
  sendingVolume = true; lastError = undefined; $('error').hidden = true; render(state);
  try {
    while (queuedVolume !== undefined) {
      const volume = queuedVolume; queuedVolume = undefined;
      const reply = await send(state.active ? 'volume' : 'start', { volume });
      // Retain newer slider input while accepting the authoritative session.
      render(queuedVolume === undefined ? reply : { ...reply, volume: queuedVolume });
    }
  } catch (error) {
    queuedVolume = undefined; showError(error);
    try { render(await send('state')); } catch { /* Keep the last known state. */ }
  } finally { sendingVolume = false; render(state); }
}

$('enable').addEventListener('click', () => action(state.active ? 'stop' : 'start'));
$('mute').addEventListener('click', () => action('mute'));
$('retry-audio').addEventListener('click', () => action(state.active ? 'volume' : 'start', { volume: state.volume }));
$('reset').addEventListener('click', () => setVolume(100));
$('decrease').addEventListener('click', () => setVolume(state.volume - 25));
$('increase').addEventListener('click', () => setVolume(state.volume + 25));
$('protection').addEventListener('change', () => action('protection', { enabled: $('protection').checked }));
$('remember').addEventListener('change', async () => {
  const enabled = $('remember').checked;
  try {
    // Call request directly in the checkbox's user gesture, before any await.
    const approval = enabled ? chrome.permissions.request({ origins: [sitePattern] }) : Promise.resolve(true);
    permissionBusy = true; render(state);
    if (!await approval) throw new Error('Site access was not granted. Your volume still works for this tab.');
    permissionBusy = false;
    await action('remember', { enabled });
  } catch (error) { showError(error, false); }
  finally { permissionBusy = false; render(state); }
});
$('volume').addEventListener('input', event => setVolume(+event.target.value));
document.querySelectorAll('[data-volume]').forEach(button => button.addEventListener('click', () => setVolume(+button.dataset.volume)));
$('shortcuts').addEventListener('click', () => {
  const opened = chrome.commands.openShortcutSettings ? chrome.commands.openShortcutSettings() : chrome.tabs.create({ url: browserConfig.shortcuts });
  Promise.resolve(opened).catch(error => showError(error, false));
});

try {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  isPrivate = Boolean(tab?.incognito);
  supportInfo = pageSupport(tab?.url, browserConfig.target);
  supported = supportInfo.supported;
  const hostname = supported ? new URL(tab.url).hostname.replace(/^www\./, '') : '';
  sitePattern = supported ? siteIdentity(tab.url).pattern : undefined;
  document.documentElement.dataset.browser = browserConfig.target;
  $('site').textContent = hostname || 'Open a website to get started';
  $('site-icon').textContent = hostname.charAt(0) || '↗';
  render(await send('state'));
  updateMeter();
} catch (error) {
  supported = false;
  render({ active: false, volume: 100, muted: false, protection: true });
  showError(error); $('status').textContent = 'Could not connect';
}
