# Chrome, Edge, Brave, and Firefox

VolumeBooster 0.4.2 has a separate native build for each of these desktop browsers. This is not a renamed Chrome package for Firefox: Firefox has its own background implementation, permissions, stable add-on identity, and shortcut-settings route.

## Install

| Browser | Output / download | Installation |
| --- | --- | --- |
| Chrome 116+ | `dist` / `volumebooster-0.4.2-chrome.zip` | Extract to a stable folder, open `chrome://extensions`, enable Developer mode, Load unpacked |
| Edge (Chromium 116+) | `dist-edge` / `volumebooster-0.4.2-edge.zip` | Extract, open `edge://extensions`, enable Developer mode, Load unpacked |
| Brave (Chromium 116+) | `dist-brave` / `volumebooster-0.4.2-brave.zip` | Extract, open `brave://extensions`, enable Developer mode, Load unpacked |
| Firefox 142+ | `dist-firefox` / `volumebooster-0.4.2-firefox-unsigned.xpi` | For testing: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → choose the XPI or manifest |

**Permanent Firefox installation requires Mozilla signing.** The GitHub XPI is unsigned and a temporary add-on disappears when Firefox closes. Do not disable Firefox signature checks. [Mozilla signing documentation](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

Pin the extension, play audio, and choose a preset. Closing the popup keeps the level active. Optionally remember this site to restore compatible players after reload. Keep the extracted directory in place and use Reload to update an unpacked installation.

## Features and limits

| Feature | Chrome / Edge / Brave | Firefox |
| --- | --- | --- |
| 0–400% gain, presets, +/−, Reset, mute | Supported | Supported on compatible players |
| Sample limiting, output meter and smooth gain changes | Supported | Supported |
| Direct HTML audio/video processing | Supported | Supported |
| Native fullscreen with direct processing | Supported | Supported |
| Mixed-tab capture fallback | `tabCapture` + offscreen audio | Unavailable; a clear unsupported-player error is shown |
| Native fullscreen during tab capture | Browser-limited; F11 may help | Not applicable |
| Direct-mode reload | Opt-in site memory restores compatible players | Opt-in host permission restores compatible players; otherwise re-enable |
| Keyboard shortcut settings | Native browser extension settings | Native Firefox add-on shortcut manager |

Protected/DRM, non-CORS cross-origin media, browser/internal/store pages, nested cross-origin frames, and shadow-DOM-only players can limit compatibility. No extension can guarantee all media on all websites. Firefox does not have Chromium's tab-audio fallback. Safari, mobile browsers, and other engines are not implemented or certified by this release; a Safari extension requires a separate Apple-platform distribution/test path.

## Validation

Tests use fresh profiles and generated quiet audio. Edge and Brave tests use their actual installed binaries; Brave is also checked with `navigator.brave.isBrave()`. Chrome uses Chrome for Testing. Firefox uses a native temporary add-on controlled by Selenium, including a real toolbar action for `activeTab`. Test-only probes measure the actual Web Audio input/output, rather than just checking slider text.

See [TESTING.md](TESTING.md) for versions, results, and the exact limits.
