# VolumeBooster 0.4.1

Native packages for Chrome, Edge, Brave and Firefox, with optional local remembered site levels, a shared look-ahead sample limiter, live output meter and actionable recovery controls.

- Remember an exact site origin, level and protection setting after granting optional host access. Compatible players restore after reload; automatic capture is never started.
- A stereo-linked 5 ms look-ahead sample limiter handles mixed sources. A clearly identified soft/sample-ceiling fallback is available when worklets cannot load.
- The popup explains native fullscreen, capture restrictions, unsupported players and paused output. Retry resumes the existing session.

Verified: 38 unit tests, four real browser suites, real offline worklet/fallback rendering, local fullscreen, mute, Stop, worker restart, reload restoration and a two-minute measured playback regression per browser. Public YouTube amplification/native fullscreen and Twitch capture amplification passed in Chrome. See TESTING.md and docs/IMPROVEMENT-VERIFICATION.md for scope and diagnostics.

Spotify/Netflix account playback, physical Bluetooth switching, overnight sessions and minimum browser versions remain unverified. Firefox cannot process every protected/non-CORS player. Capture may limit native fullscreen. Safari/mobile are not included.

Download your browser package and check SHA256SUMS.txt. Chromium ZIPs can be loaded as unpacked extensions. The Firefox XPI is unsigned and for temporary testing; permanent installation requires Mozilla signing. Source, MIT license, privacy policy and design assets are included.
