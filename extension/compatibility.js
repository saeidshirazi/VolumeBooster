export function pageSupport(url, target = 'chrome') {
  try {
    const page = new URL(url);
    if (!['http:', 'https:'].includes(page.protocol)) return { supported: false, reason: 'Browser pages cannot be boosted', hint: 'Open the video or music website instead.' };
    const store = page.hostname === 'chromewebstore.google.com' || (page.hostname === 'chrome.google.com' && page.pathname.startsWith('/webstore')) || (page.hostname === 'microsoftedge.microsoft.com' && page.pathname.startsWith('/addons')) || (target === 'firefox' && ['addons.mozilla.org', 'accounts.firefox.com'].includes(page.hostname));
    if (store) return { supported: false, reason: 'This page is protected by the browser', hint: 'Open the actual media website instead of its extension store.' };
    return { supported: true };
  } catch { return { supported: false, reason: 'Open a website to get started', hint: 'Choose an ordinary HTTP or HTTPS website tab.' }; }
}

export function errorAdvice(error, capture = true) {
  const message = typeof error === 'string' ? error : error?.message || 'The operation could not complete.';
  if (/audio could not start|paused audio|output device/i.test(message)) return { code: 'output', label: 'Audio output needs attention', hint: 'Press Play on the site, check your output device, then retry.', message };
  if (/active stream|already.*captur|another.*captur|being captured/i.test(message)) return { code: 'conflict', label: 'Another capture is active', hint: 'Stop the other capture or audio extension, then try again.', message };
  if (/player cannot|non-CORS|protected.*not supported|compatible.*first/i.test(message)) return { code: 'player', label: 'Player unsupported', hint: capture ? 'Try a different player. Protected sources may also block tab audio.' : 'Firefox cannot capture protected or non-CORS players. Try a compatible source.', message };
  if (/access|permission|protected page|cannot inject/i.test(message)) return { code: 'permission', label: 'Site access needs attention', hint: 'Reopen VolumeBooster on this site. Allow access only if you want it remembered.', message };
  if (/unknown audio command|reload.*extension|receiving end|could not connect|engine.*unavailable/i.test(message)) return { code: 'connection', label: 'Reconnect the extension', hint: 'Reload this website after an extension update, then reopen VolumeBooster.', message };
  return { code: 'operation', label: 'Could not finish that action', hint: 'Check that the site is playing audio, then try again.', message };
}

export function playbackStatus(state, { capture = true, page = { supported: true }, error } = {}) {
  if (!page.supported) return state.active ? { tone: 'warning', label: 'Audio session still active', hint: 'Turn off boost to release this tab. This page cannot start new processing.' } : { tone: 'muted', label: page.reason, hint: page.hint };
  if (error && !state.active) return { tone: 'error', ...errorAdvice(error, capture) };
  if (state.active && state.audioState && state.audioState !== 'running') return { tone: 'warning', label: 'Audio paused · retry output', hint: 'Press Play on the site or use Retry audio to resume processing.', retry: true };
  if (state.muted) return { tone: 'muted', label: 'Muted · your level is kept', hint: 'Unmute to return to your chosen level.' };
  if (state.active && state.mode === 'capture') return { tone: 'warning', label: 'Tab audio · fullscreen limited', hint: 'Try browser fullscreen (F11 on Windows), or turn off boost for native fullscreen.' };
  if (state.active && state.processor === 'ceiling') return { tone: 'warning', label: 'Native player · peak ceiling fallback', hint: 'The advanced processor is unavailable here. Lower the level if sound gets rough.' };
  if (state.active) return { tone: 'success', label: 'Native player · fullscreen available', hint: state.remembered ? 'Level saved for this site. Compatible players restore after reload.' : 'Only compatible players are processed. Closing the popup keeps your level.' };
  if (state.paused) return { tone: 'muted', label: 'Boost paused for this page', hint: state.remembered ? 'Turn on to resume now. Your saved level returns after a reload.' : 'Choose a preset or turn on boost when you need it.' };
  if (state.support?.reason === 'protected' || state.support?.reason === 'cross-origin' || state.support?.reason === 'in-use') return { tone: 'warning', label: capture ? 'This player needs tab audio' : 'Player restricted in Firefox', hint: capture ? 'Turn on boost to try tab audio. Protected sources may block capture.' : 'Try a compatible audio/video source; this player cannot be processed directly.' };
  if (state.support?.reason === 'no-media') return { tone: 'muted', label: capture ? 'Ready for tab audio' : 'Waiting for a compatible player', hint: capture ? 'Start audio, then choose a level. Tab audio may limit fullscreen.' : 'Start the site’s audio/video first, then choose a level.' };
  return { tone: 'muted', label: state.remembered ? 'Saved level ready' : 'Ready to boost', hint: state.remembered ? 'Compatible players restore automatically. Capture still needs a click.' : 'Play audio, then choose a preset or move the slider.' };
}
