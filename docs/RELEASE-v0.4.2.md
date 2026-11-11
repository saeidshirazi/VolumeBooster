# VolumeBooster 0.4.2

Chrome, Edge, Brave and Firefox packages all use version 0.4.2. The release includes source, design assets and SHA-256 checksums.

- Fix intermittent native-browser test failures by waiting for popup readiness, discovering fresh targets and reopening an action dismissed by capture startup.
- Add configurable, bounded endurance checks.
- Include current local audio/site-preference privacy disclosures.

The audio features remain the same as 0.4.1: independent tab levels, optional remembered site levels, look-ahead sample limiting, output meter and Retry controls. Compatible media players retain native fullscreen; Chromium capture fallback can restrict it. Firefox cannot process every protected or non-CORS player.

Chromium ZIPs support unpacked installation. The Firefox XPI is unsigned and supports temporary testing; permanent installation needs a Mozilla-signed package. Safari and mobile are not included. No universal compatibility or zero-bug guarantee is claimed.
