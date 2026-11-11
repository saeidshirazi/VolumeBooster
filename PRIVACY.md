# VolumeBooster privacy policy

Effective November 11, 2026. Maintained by Saeid Shirazi and the VolumeBooster open-source community.

VolumeBooster adjusts audio volume in browser tabs you explicitly enable. Processing happens locally on your device. VolumeBooster does not collect, transmit, sell, or share personal information, browsing history, media content, or audio.

## What the extension accesses

- The URL of the selected tab to show its hostname and check whether the page is supported.
- Compatible audio/video elements in the selected page to route audio through a local Web Audio gain/compression graph.
- On Chrome, Edge, and Brave only, the selected tab's audio stream when direct player processing is unavailable. The stream is played locally, not recorded or uploaded. The browser displays a capture indicator.

Current tab and mute state are held in memory. If you opt into **Remember this site**, the extension saves that site's origin (scheme, hostname and port), volume and peak-protection preference in local extension storage. It saves no page paths, query strings, credentials, listening history or audio. Mute is not persisted. Private-window preferences are not saved. Forgetting a site deletes its saved record and unregisters automatic processing; optional site permission is removed when no remaining preference uses that host permission.

The extension has no analytics, advertising, cloud service, account system, external network calls, or remote executable code. It requests no microphone or camera access. Its Chromium `getUserMedia` request consumes the selected tab's browser-issued stream identifier, not a microphone.

## Permissions

`activeTab` grants temporary access when you invoke the extension. `scripting` attaches the audio processor to that selected page. `storage` holds only preferences you explicitly save. Optional host access is requested for the site you choose to remember, so a registered script can restore compatible players after reload or on a future visit. Browser host grants can cover all ports of that hostname; saved settings and restoration checks are restricted to the exact origin. Automatic restoration never starts tab capture. All-site access is not requested during normal use.

Chromium builds additionally use `tabCapture` for fallback tab audio and `offscreen` to keep that audio playing after the popup closes. Firefox does not request or use these Chromium permissions.

## Stopping processing

Turn off boost in the popup or close the tab. Capture mode stops its stream and closes its AudioContext. Direct mode restores a unity-gain passthrough and bypasses compression; the browser's one-time media attachment remains until the page unloads. No audio is saved.

## External services

Your browser, visited websites, extension store, and GitHub operate under their own privacy policies. Opening the support/repository links is voluntary. VolumeBooster does not send audio or page information to those services.

## Contact and updates

Ask privacy questions at [VolumeBooster issues](https://github.com/saeidshirazi/VolumeBooster/issues). Do not include private audio, passwords, or sensitive URLs in a public issue. Changes to this policy are versioned in the public repository. This extension is not directed at collecting information from children and collects no user information of any age.
