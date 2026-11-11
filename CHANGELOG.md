# Changelog

## 0.4.1 · November 11, 2026

- Fix timezone-dependent ZIP timestamps; verify identical archive bytes in UTC, Toronto, Honolulu and Tokyo.
- Opt-in local per-site volume/protection with optional host permission, reload restoration, Stop suppression and Forget.
- Shared stereo-linked look-ahead sample limiter, identified sample-ceiling fallback, and live output meter.
- Compatibility guidance for native/capture/Firefox restrictions, paused output and Retry recovery.
- Prevent automatic restoration from creating a second processor over active capture.
- 38 unit tests, four-browser DSP/memory/recovery checks and two-minute measured playback regressions.
- Public YouTube native-fullscreen amplification and Twitch capture amplification checked in Chrome; account/physical-device coverage remains explicit.

## 0.3.0 · November 11, 2026

- Separate native Chrome, Edge, Brave, and Firefox builds.
- Firefox background, stable add-on identity, minimal permissions, and no-data-collection declaration; no unsupported Chromium API shim.
- Browser-native shortcut settings, with Firefox's native add-on shortcut manager.
- Four-browser audio/fullscreen/control tests, including safe Firefox rejection of non-CORS media.
- Bound audio startup to five seconds and preserve the original player when an output cannot start.
- Versioned browser ZIPs, unsigned Firefox XPI, complete source, store-assets ZIP, and SHA-256 verification.
- MIT license, privacy policy, community contribution/security/conduct files.
- Store icons, screenshot composition from the tested GUI, and promotional image sizes.
- GitHub's native-browser test matrix and package validation.

## 0.2.0 · November 11, 2026

- New speaker-and-boost identity with matching SVG and toolbar icons.
- Redesigned popup with clearer status, larger controls, and improved keyboard focus.
- Start boosting by choosing a preset or moving the slider; no separate activation step required.
- Adjust volume in 25-point increments with +/− or restore 100% with Reset.
- Keep the latest slider input during rapid changes and show progress while starting or stopping.
- Add browser checks for one-click activation, Reset, +/−, and rapid slider changes.
- Add GitHub checks on Windows and Linux and a downloadable extension artifact.

## 0.1.0 · November 11, 2026

- Initial Chrome implementation with per-tab 0–400% gain, mute, peak compression, and shortcuts.
- Direct media processing for compatible players with capture fallback.
- Live YouTube audio and native video fullscreen validation.
