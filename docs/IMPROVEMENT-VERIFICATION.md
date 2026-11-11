# Improvement sequence

Each stage is completed and verified before the next stage begins. Browser tests use isolated profiles; production packages are never modified by test fixtures.

## 1. Remembered site levels

Implemented an optional local preference for exact site origin, volume and peak protection, with site-specific permission requested from the user's checkbox gesture. Registered scripts restore compatible players after reload and future visits, without automatically capturing tab audio. Stop suppresses automatic reactivation for the current document. Forget removes saved preferences and registrations. Private windows are excluded.

Unit verification includes opt-in defaults, denied permission, private windows, exact-origin/port isolation, sender/frame validation, saved changes, Stop semantics, Forget, startup registration and permission revocation. Native integration checks use a test-only manifest with the local fixture host pre-granted; they exercise the real shipped runtime and popup, registration, reload, measured restored gain, Stop and Forget. These fixtures do not validate every native permission prompt placement; production continues to use the browser's normal optional permission prompt.

**Verified:** 27 unit tests passed. Chrome, Edge, Brave and Firefox passed the site-memory integration fixtures. Chromium-family tests measured the restored 250% signal, verified Stop suppression and removal of registered scripts; Firefox verified reload restoration, Stop and Forget. Firefox package validation reported zero errors and warnings. Native optional-permission prompt placement remains a manual UI check; the integration fixtures pre-grant only localhost in their test manifest.

Stage 1 is complete. Subsequent stages are recorded below as they are verified.
