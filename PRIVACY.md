# VolumeBooster privacy policy

Effective November 11, 2026. Maintained by Saeid Shirazi and the VolumeBooster open-source community.

VolumeBooster adjusts audio volume in browser tabs you explicitly enable. Processing happens locally on your device. VolumeBooster does not collect, transmit, sell, or share personal information, browsing history, media content, or audio.

## What the extension accesses

- The URL of the selected tab to show its hostname and check whether the page is supported.
- Compatible audio/video elements in the selected page to route audio through a local Web Audio gain/compression graph.
- On Chrome, Edge, and Brave only, the selected tab's audio stream when direct player processing is unavailable. The stream is played locally, not recorded or uploaded. The browser displays a capture indicator.

Tab state, volume, and mute settings are held in memory. The extension does not write them to extension storage. It has no analytics, advertising, cloud service, account system, external network calls, or remote executable code. It requests no microphone or camera access. Its Chromium `getUserMedia` request consumes the selected tab's browser-issued stream identifier, not a microphone.

## Permissions

`activeTab` grants temporary access when you invoke the extension. `scripting` attaches the audio processor to that selected page. Chromium builds additionally use `tabCapture` for fallback tab audio and `offscreen` to keep that audio playing after the popup closes. Firefox does not request or use these Chromium permissions. No build requests broad access to all websites.

## Stopping processing

Turn off boost in the popup or close the tab. Capture mode stops its stream and closes its AudioContext. Direct mode restores a unity-gain passthrough and bypasses compression; the browser's one-time media attachment remains until the page unloads. No audio is saved.

## External services

Your browser, visited websites, extension store, and GitHub operate under their own privacy policies. Opening the support/repository links is voluntary. VolumeBooster does not send audio or page information to those services.

## Contact and updates

Ask privacy questions at [VolumeBooster issues](https://github.com/saeidshirazi/VolumeBooster/issues). Do not include private audio, passwords, or sensitive URLs in a public issue. Changes to this policy are versioned in the public repository. This extension is not directed at collecting information from children and collects no user information of any age.
