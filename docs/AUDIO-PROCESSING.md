# Audio processing

Direct mode mixes all attached compatible players into a single output graph. Capture mode passes the captured tab stream through the same output implementation. Volume changes use a 25 ms smoothing time constant.

The preferred processor is a bundled AudioWorklet with a **5 ms look-ahead, stereo-linked sample-peak limiter**, an output ceiling of **0.98**, and an 80 ms gain release. Quiet signals are linear apart from the declared delay. The limiter considers all mixed players before choosing a shared channel gain. This avoids separate per-player ceilings whose combined output could still clip.

This is a sample-peak limiter, not an intersample/true-peak or loudness normalizer. It cannot repair an already distorted recording or control system/speaker loudness. Disabling protection preserves a linear path and may allow clipping at high gain. The worklet retains its delay while bypassed to avoid jumping between paths.

When a page's policy or browser cannot load the worklet, a built-in Web Audio soft ceiling is used. It reserves internal headroom, keeps quiet samples in its linear region, oversamples the soft knee, and applies a final sample ceiling. Heavy saturation can change the sound and stereo balance more than the linked look-ahead processor; reducing volume is preferable to relying on that fallback at very high gain. The meter identifies the active processor.

The meter reports processed-audio sample peaks and dBFS, not physical listening loudness. Worklet peak/reduction statistics stay in memory and are requested only while the popup is visible. No audio or meter history is written to disk or transmitted. Static worklet resources are bundled with the extension and exposed only so the selected page's audio context can load them; there is no downloaded executable code.

Numerical tests cover quiet transparency, impulses, channel linking, several sample rates and bypass. Native browser tests use independent destination taps. Loud and mixed-source tests run in OfflineAudioContext, so those test signals never reach speakers. Both the worklet and fallback are exercised in the actual browser, with finite-value checks on rendered output.
