# Store submission package · 0.4.1

This is a submission-prepared open-source release. It has not been submitted to or approved by a browser store. Signing, publisher registration/verification, final portal declarations, and store review remain the publisher's responsibility. Never describe an unsigned XPI as permanently installable.

## Packages and stores

| Browser | Upload | Distribution |
| --- | --- | --- |
| Chrome | `volumebooster-0.4.1-chrome.zip` | Chrome Web Store |
| Edge | `volumebooster-0.4.1-edge.zip` | Microsoft Edge Add-ons |
| Brave | `volumebooster-0.4.1-brave.zip` for local installation; Chrome ZIP for store submission | Brave installs extensions from the Chrome Web Store; there is no separate Brave store submission here |
| Firefox | `volumebooster-0.4.1-firefox-unsigned.xpi` | Mozilla Add-ons submission/signing; temporary installation until signed |

The source ZIP contains build scripts and the dependency lockfile. Runtime code is unminified JavaScript, with no runtime third-party library, downloaded code, or `eval`. PNG icons are checked in, so ordinary builds do not need a browser. Use `npm ci`, `npm run package:public`, and `npm run verify:release` to reproduce a release with a new version. Existing checksummed public archives are immutable.

## Listing copy

**Name:** VolumeBooster — a little louder

**Short description:** Smooth, independent volume control for your tabs. Local audio processing, up to 400% boost, and fullscreen shortcuts.

**Suggested category:** Productivity / Tools (choose the closest category available in the store).

**Detailed description:**

Quiet video or music? Bring it to a comfortable level with VolumeBooster.

- Pick a preset or move the slider to start boosting the current tab.
- Adjust from 0% to 400%, with +/− controls and a one-click Reset.
- Mute a tab without losing its chosen level.
- Limit output samples with optional look-ahead peak protection and see the live output meter.
- Optionally remember a site level locally, with access requested only for that host.
- Recover paused output using clear status and Retry audio.
- Keep each tab's volume independent.
- Use keyboard shortcuts after enabling the tab.

Everything runs on your device. No accounts, recordings, uploads, ads, or tracking. VolumeBooster is free and open source under the MIT license.

Compatible media players retain native fullscreen. Chromium browsers can use tab audio capture as a fallback, where the browser may restrict fullscreen; the popup identifies this mode. Firefox processes compatible players directly and cannot boost every protected or non-CORS player. Opt-in site memory restores compatible players after reload; capture still requires a click. This extension cannot unmute your device or a muted website player. High boost may distort audio; increase gradually.

## Public links

- Homepage/source: https://github.com/saeidshirazi/VolumeBooster
- Support: https://github.com/saeidshirazi/VolumeBooster/issues
- Privacy policy: https://github.com/saeidshirazi/VolumeBooster/blob/main/PRIVACY.md
- License: https://github.com/saeidshirazi/VolumeBooster/blob/main/LICENSE

## Privacy and permissions declarations

**Single purpose:** Adjust the audio volume of a browser tab explicitly selected by the user.

**Data collection/transmission:** None. Tab audio is processed and played locally, never recorded or uploaded. No microphone/camera capture. No monetization or sale of data. The Firefox manifest declares `data_collection_permissions.required: ["none"]`.

**Permission justifications:**

- `activeTab`: access the selected page after a user invokes the extension, read its hostname, and attach its audio processor.
- `scripting`: run bundled Web Audio helpers after activation, and register restoration helpers only for sites the user explicitly remembers. No remote code.
- `storage`: save only an opted-in exact site origin, volume and protection preference locally. No audio, listening history, mute history or private-window preferences.
- Optional HTTP/HTTPS host permissions: request access to the selected remembered host so compatible media can restore on future visits. Host grants can cover ports; runtime restoration validates the exact origin. Forget removes the saved record and unused grant. Declaring optional patterns does not request all-site access on installation.
- Web-accessible resources: only the bundled limiter worklet and its core can load into the selected page’s Web Audio context.
- `tabCapture` (Chromium only): process the selected tab's mixed audio when direct media processing is unavailable. Only after explicit activation.
- `offscreen` (Chromium only): retain local audio playback after closing the popup, through the browser's offscreen document.

**Remote code:** None. All extension code is bundled. Website scripts continue to operate independently of VolumeBooster.

**Reviewer testing instructions:**

1. Install the correct browser package and pin its action.
2. Play an ordinary HTML audio/video source. Open VolumeBooster and click 150% or 200%.
3. Check +/−, Reset, mute/unmute, and Stop. Stop should preserve original website playback.
4. Enter fullscreen on a compatible player. The audio processor remains attached. Use the popup's mode/status to distinguish native processing from Chromium capture fallback.
5. In Chromium, pages using Web Audio without a compatible media element exercise tab capture. In Firefox, an incompatible protected/non-CORS player displays a clear unsupported-player error rather than invoking nonexistent capture APIs.
6. Enable Remember this site, accept that host permission, change the level, then reload and play. A compatible player restores the saved level. Stop prevents immediate reactivation; forgetting removes saved settings and registration.
7. Verify the live meter and Limit loud peaks switch. If output becomes suspended, Retry audio resumes it.
8. Open Shortcuts to customize keys in the browser's native settings.

No sign-in, payment, test account, server, or API key is needed. The repository has a reproducible local media fixture and real browser integration suites. See TESTING.md for the exact environments and limitations.

## Image assets

`docs/store/assets/` contains a 128×128 icon, a 300×300 Edge icon, a 1280×800 screenshot composition using the real tested popup, a 440×280 promotional tile, and a 1400×560 marquee. They contain no fake reviews, store badges, or unsupported compatibility promises. The same GUI is used by all four builds; runtime mode availability differs as documented.

Official submission references (checked November 11, 2026): [Chrome listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [Chrome image specifications](https://developer.chrome.com/docs/webstore/images), [Edge publishing](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension), [Mozilla signing](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/), [Firefox consent declaration](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/). Store requirements can change; confirm the final portal fields before submitting.
