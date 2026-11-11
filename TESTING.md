# Validation · November 11, 2026

Version 0.2.0 tested on Windows with Playwright 1.65.0 and Chromium / Chrome for Testing 158.0.8127.18. This is a Chrome-first development build, not a published store extension. Chrome 116 is the declared API minimum; it was not separately tested.

## Automated tests

`npm test`: **11 passed**.

Coverage includes numeric bounds and invalid input, smooth gain changes, compressor routing, independent tab state, concurrent start serialization, singleton offscreen creation, mute/unmute state, shortcut limits, capture failure cleanup, stream-ended cleanup, unsafe cross-origin/DRM preflight, direct-mode restart without double attachment, and unity passthrough after direct-mode Stop.

## Real browser tests

The isolated browser suite passed:

- Loading the extension and opening its native toolbar popup.
- Starting capture at 150% with a single preset click in the native popup.
- Resetting to 100% through the actual popup.
- Capturing a quiet generated tone and routing it to the audio destination.
- Measuring approximately 2× amplitude at 200% relative to 100%.
- Keeping audio processing active in document fullscreen.
- Adjusting gain and muting the actual audio signal during fullscreen.
- Changing the real session through the popup's preset buttons.
- Adjusting volume by 25 percentage points using +/−.
- Preserving the latest value during rapid slider input.
- Rendering a 390 px popup with visible primary controls and no horizontal overflow.
- Keeping the session alive after closing the popup.
- Maintaining capture state after a service-worker stop/restart request.
- Keeping capture audio alive after a page reload.
- Releasing capture tracks and closing the AudioContext on Stop.
- No uncaught page errors.

## Live YouTube test

Tested the public Blender Foundation video `aqz-KE-bpKQ` in the isolated profile. The test confirmed fullscreen before processing, selected **direct mode**, confirmed no active tab capture, measured increased audio amplitude, then entered native video fullscreen through the Fullscreen API with an explicit test user gesture and measured boosted output during fullscreen.

That complete fullscreen pass was recorded during initial 0.1.0 validation. The 0.2.0 redesign's live retest again selected direct mode, confirmed no active tab capture, and measured amplified YouTube audio. In that run, fullscreen failed both before boosting and afterward with `TypeError: not granted`. This is an unresolved focus/permission limitation in the live automation, and is not counted as a passing fullscreen retest. The deterministic local fullscreen/audio checks passed. No audio-engine changes were made for 0.2.0.

The original capture-only implementation failed YouTube fullscreen. The final build uses direct audio processing for compatible media and retains capture only as fallback. Fullscreen with capture is still browser-limited; the UI identifies this mode.

Raw test output and measurements: `test-results/browser.json`. Inspected native popup screenshot: `test-results/popup.png`. These are local development artifacts, excluded from the packaged extension.

## Remaining checks

- Physical keyboard shortcut delivery on the user's OS/browser; the handlers are tested, but Playwright page key events do not exercise browser-level extension shortcuts.
- YouTube's own fullscreen button across layouts; the final live check explicitly exercised native video fullscreen rather than relying on a potentially focus-sensitive automated toolbar click.
- Signed-in Spotify playback and protected media.
- Large multi-player pages, complex shadow DOM, and nested cross-origin frames (capture fallback is available).
- Long sessions, Bluetooth/output-device changes, OS sleep/wake, and browser crash recovery.
- Other browser versions and browser families.

These checks do not establish universal website compatibility or a zero-bug guarantee.
