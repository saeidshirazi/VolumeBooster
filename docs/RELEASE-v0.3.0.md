# VolumeBooster 0.3.0 · Four-browser release

Native packages for **Chrome, Microsoft Edge, Brave, and Firefox**, plus complete MIT-licensed source and store-submission assets.

- Smooth per-tab volume from 0–400%, with one-click presets, +/−, Reset, mute, and peak softening.
- Compatible native players keep fullscreen support.
- Chromium builds retain mixed-tab audio capture when direct processing is unavailable.
- Firefox has its own background implementation and minimal permissions; incompatible players get an honest error without silencing their original playback.
- Native shortcut settings open correctly for each browser.
- No account, audio uploads, tracking, ads, or microphone permission.

## Downloads

- `volumebooster-0.3.0-chrome.zip`
- `volumebooster-0.3.0-edge.zip`
- `volumebooster-0.3.0-brave.zip`
- `volumebooster-0.3.0-firefox-unsigned.xpi`
- `volumebooster-0.3.0-source.zip`
- `volumebooster-0.3.0-store-assets.zip`
- `SHA256SUMS.txt`

For Chromium browsers, extract the ZIP and load its folder in the browser's extensions page with Developer mode enabled. Firefox's unsigned XPI is for temporary installation through `about:debugging`; permanent installation requires Mozilla signing. Do not disable signature checks.

## Validation

20 unit tests cover audio routing and cleanup, safe player preflight, startup timeouts, browser manifests, permissions, per-tab state, concurrency, archive reproducibility, and both background implementations. Real browser suites check actual gain measurements, fullscreen, popup controls, mute, Stop, navigation, and browser-native shortcut settings. Firefox's package validator reports zero errors and zero warnings. See TESTING.md for the tested browser versions and known limitations.

## Store submission

The store-assets ZIP includes reviewed-size icons, a genuine GUI screenshot composition, promotional images, privacy policy, and listing/reviewer copy. Chrome Web Store supplies Brave distribution; Edge has its own add-ons store. Mozilla signing and all store-account registration, final declarations, submission, and review are still required. These GitHub assets are not store-approved or signed packages.

Protected media, non-CORS players, complex embeds, and capture-mode fullscreen remain browser-limited. Safari/mobile are not part of this four-desktop-browser release.
