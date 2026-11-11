# Validation · November 11, 2026 · 0.4.1

This release contains native Chrome, Edge, Brave, and Firefox builds. Local browser results below come from isolated profiles on Windows. CI tests the Chromium-family browsers on Windows, Firefox on Linux with an explicit PulseAudio virtual output, and package validation on Linux. Minimum declared versions were not separately tested.

## Automated checks

- **38 unit tests**: audio bounds, graph smoothing/routing, safe media preflight, mute state, failure and stream cleanup, bounded audio-start timeout behavior, concurrent session serialization, independent tabs, Firefox/Chromium routing and permission guards, four-browser manifests, and reproducible archive text/timestamp handling.
- **Firefox `web-ext lint`: 0 errors, 0 warnings.** The Firefox package includes a native background and no Chromium offscreen/tab-capture implementation or permissions.
- **Production dependency audit: 0 vulnerabilities.** The extension has no third-party runtime dependency; test/build tools are dev dependencies.
- Release verification checks each manifest, required assets, privacy declaration, browser configuration, archive inventory, store image dimensions, source exclusions, and SHA-256 hashes.

Extended suites add opt-in site memory/reload/Forget, real OfflineAudioContext worklet and fallback rendering, live output meters, forced suspension and Retry. Loud DSP fixtures are rendered offline, never sent to speakers. Output sample peaks remain approximately 0.98000002 with Float32 rounding. Site-memory integration uses a test-only manifest pre-granting localhost; the normal baseline runs use the unmodified production manifest. Native optional-permission prompt placement remains a manual check.

## Browser environments

| Browser | Tested version | Engine / installation |
| --- | --- | --- |
| Chrome for Testing | 158.0.8127.18 | Actual native MV3 package in Playwright Chromium |
| Microsoft Edge | 157.0.4341.46 | Installed Edge executable, native Edge build |
| Brave | Chromium 157.0.8103.50, installed Brave 1.99 | Installed Brave executable, native Brave build, `navigator.brave.isBrave()` confirmed |
| Firefox | 159.0 | Mozilla Firefox test binary, Selenium, temporary native MV3 add-on |

Chromium-family suites check both audio modes: a Web Audio-only fixture exercises real mixed-tab capture, and a generated WAV in a native media element exercises direct processing. They verify roughly 2× amplitude at 200%, fullscreen signal continuity, mute silence, one-click preset activation, +/−, Reset, rapid slider input, popup layout, popup closure, worker stop/restart requests, capture persistence across reload, Stop, native shortcut settings, and absence of extension page errors.

Firefox tests install the actual built add-on without rewriting runtime code. A real native extension action grants `activeTab`. The suite verifies direct-mode signal gain, native document fullscreen with audio, mute/unmute, actual popup presets/+/Reset, Stop preserving original playback, navigation clearing a stale session, an unsupported non-CORS player failing without muting its source, the native shortcut manager, and no extension JavaScript errors. Popup renderer controls are exercised in an extension-page test harness attached to the actual target tab; this does not establish every native Firefox popup placement/interaction.

Headless Chromium tests remove Playwright's default `--mute-audio`, which otherwise silences tab capture. Layout checks verify a 390 px body, no horizontal overflow, and main controls within 600 px desktop popup bounds. Native headless popup surfaces can have browser-controlled virtual dimensions; they are not resized or treated as physical windows. These tests do not certify sound hardware or every window-manager behavior. Headed local runs also checked the popup in Chrome, Edge, and Brave.

Firefox passed locally on Windows. An initial hosted Windows runner timed out during audio startup; Firefox CI uses a Linux PulseAudio null sink to provide a defined output device while measuring the real Web Audio signal. Runtime startup is bounded to five seconds and fails before attaching a media element when the output cannot start. This does not simulate physical speakers or certify every no-device configuration.

Raw local reports and screenshots are under `test-results/<browser>/`. CI uploads per-browser artifacts. Test probes are installed only into isolated test processes and are excluded from runtime packages. The media fixtures use a quiet local tone; no accounts or copyrighted media files are shipped.

## Live services and remaining scope

Version 0.4.1 passed public YouTube amplification and native video fullscreen in Chrome, using direct mode without capture. A public Twitch stream passed measured amplification through capture. These optional live checks depend on network/player availability. A getLayoutMap policy diagnostic with no reported source URL occurred during Twitch browsing and is retained separately; deterministic fixtures had no uncaught errors. Spotify/Netflix pages were inspected but account playback remains unverified.

Chrome, Edge and Brave each passed 60 seconds of measured capture plus 60 seconds of direct playback. Firefox passed 120 seconds of direct playback. Signals were sampled every six seconds and stayed running at the expected gain. This two-minute regression does not establish overnight stability.

Firefox cannot use Chromium mixed-tab capture. DRM, non-CORS sources, complex embeds, shadow-DOM-only players, a source changing origin after attachment, or other exclusive audio processors can limit compatibility. Physical shortcut delivery, Bluetooth/output-device switching, long-session behavior, OS sleep/wake, and crash recovery need additional real-world testing. Safari, mobile, other operating systems, and the declared minimum browser versions have not been certified locally.

These checks establish the documented behavior in the tested environments, not universal site compatibility or a zero-bug guarantee.
