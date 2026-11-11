# Contributing

VolumeBooster is MIT-licensed. Bug reports, browser compatibility fixes, accessibility improvements, and clear documentation are welcome.

Use Node 22 or newer. Run `npm ci`, `npm run build:all`, and `npm test`. Install test browsers with `npx playwright install chromium firefox`. Chrome tests use Chrome for Testing; Edge/Brave tests use their actual installed binaries. Firefox uses a temporary native add-on in a fresh Selenium profile.

```
node tests/browser.mjs --browser=chrome
node tests/browser.mjs --browser=edge
node tests/browser.mjs --browser=brave
npm run test:firefox
npm run lint:firefox
```

Set `VOLUMEBOOSTER_BRAVE_BINARY` or `VOLUMEBOOSTER_FIREFOX_BINARY` if the executable is outside the platform's expected location. `--live-sites` adds the optional public YouTube check; it is focus/network-sensitive and does not replace deterministic fixtures. Tests never use a personal browser profile or disable its protections.

Before a pull request, describe the observable bug and expected behavior, run relevant tests, and state exactly which browsers you checked. Include screenshots for GUI changes. Do not claim that DRM, cross-origin, embedded, or fullscreen behavior is universal. Preserve the minimal permissions, local-only processing, and explicit activation model. Never add remote scripts, analytics, or a microphone permission to imitate tab capture.

Release maintainers increment package/manifest versions, regenerate assets only when needed, run all browser suites and Firefox validation, package with `npm run package:public`, then verify with `npm run verify:release`. Publish the four browser archives, source archive, checksums, and store-assets ZIP. Firefox signing/store submission requires the maintainer's developer account and is separate from a GitHub release.
