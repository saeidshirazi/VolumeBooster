# Improvement sequence

Each stage is completed and verified before the next stage begins. Browser tests use isolated profiles; production packages are never modified by test fixtures.

## 1. Remembered site levels

Implemented an optional local preference for exact site origin, volume and peak protection, with site-specific permission requested from the user's checkbox gesture. Registered scripts restore compatible players after reload and future visits, without automatically capturing tab audio. Stop suppresses automatic reactivation for the current document. Forget removes saved preferences and registrations. Private windows are excluded.

Unit verification includes opt-in defaults, denied permission, private windows, exact-origin/port isolation, sender/frame validation, saved changes, Stop semantics, Forget, startup registration and permission revocation. Native integration checks use a test-only manifest with the local fixture host pre-granted; they exercise the real shipped runtime and popup, registration, reload, measured restored gain, Stop and Forget. These fixtures do not validate every native permission prompt placement; production continues to use the browser's normal optional permission prompt.

**Verified:** 27 unit tests passed. Chrome, Edge, Brave and Firefox passed the site-memory integration fixtures. Chromium-family tests measured the restored 250% signal, verified Stop suppression and removal of registered scripts; Firefox verified reload restoration, Stop and Forget. Firefox package validation reported zero errors and warnings. Native optional-permission prompt placement remains a manual UI check; the integration fixtures pre-grant only localhost in their test manifest.

Stage 1 is complete. Subsequent stages are recorded below as they are verified.

## 2. Output limiter and meter

Replaced compression-only protection with a shared output graph: a 5 ms, stereo-linked look-ahead sample limiter where worklets are available, and a built-in soft/sample-ceiling fallback. All attached players are mixed before limiting. Added a live processed-output peak meter and gain-reduction indication, without background waveform storage or transmission.

**Verified:** 32 unit tests passed, including limiter transparency, impulses, sample-rate variation, stereo linking and bypass. Chrome, Edge, Brave and Firefox passed real worklet and fallback OfflineAudioContext renders. Quiet worklet samples matched the expected delayed signal with zero measured error; loud and mixed-source output peaks stayed at approximately 0.98000002 (Float32 rounding). Loud renders never went to physical speakers. Live meters, fullscreen, mute, Stop, saved-site restoration and Forget regressions passed across all four browsers. Firefox validation reported zero errors and warnings.

The fallback's heavy saturation can alter sound/stereo balance; it is identified as a peak ceiling rather than advertised as the full linked limiter. The processor is not an intersample/true-peak or physical loudness guarantee. See AUDIO-PROCESSING.md.

Stage 2 is complete.

## 3. Compatibility and recovery

Added actionable status for native processing, tab-capture fullscreen restrictions, fallback protection, protected pages, unsupported Firefox players, paused output and permission failures. Retry resumes the existing output session. Existing sessions remain stoppable after navigation to a protected page. Automatic site restoration cannot create a second processor over an active capture session.

**Verified:** All 37 unit tests passed. Chrome, Edge, Brave and Firefox passed the full memory/limiter suite plus forced audio suspension, visible paused guidance and Retry recovery of the same session. Popup layout and existing fullscreen/Stop behavior passed. Firefox lint reported zero errors and warnings.

Stage 3 is complete.

## 4. Sustained playback and public-site checks

Added independent signal sampling every six seconds during sustained playback. Chrome, Edge and Brave passed 60 seconds of capture plus 60 seconds of direct playback; Firefox passed 120 seconds of direct playback. Every sample remained running and within the expected quiet-signal gain range. All memory, limiter, recovery and fullscreen regressions passed afterward. CI now runs both the unmodified-manifest baseline and the extended localhost-permission fixture suite.

Public YouTube playback passed in Chrome: direct mode used no capture, output amplification was measured, and native video fullscreen retained boosted playback. Public Spotify, Twitch and Netflix pages were also inspected in a fresh profile; these checks do not establish amplified playback. Spotify play controls and a public Twitch channel were attempted without personal sign-in. No authenticated Spotify/Netflix playback test or physical Bluetooth handoff was performed.

**Scope:** This is a two-minute endurance regression per browser, not overnight certification. Hardware sleep/wake, Bluetooth reconnection, authenticated/DRM services and other browser/OS versions remain explicit release limitations. These external checks are pending rather than silently counted as passes. No user-account credentials or physical device were available in the isolated test profiles.

The available automated stage-4 checks are complete; the external validation items remain open. Proceeding to prepare the store/release kit with those limits stated.
