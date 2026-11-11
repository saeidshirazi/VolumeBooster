// Offline contexts exercise real browser DSP without sending loud test signals
// to physical speakers. This helper is never included in runtime archives.
export async function renderOutputFixture({ workletURL, fallback = false }) {
  async function render(amplitude, sources = 1) {
    const context = new OfflineAudioContext(2, 12000, 48000);
    const graph = await globalThis.__volumeBoosterOutputFactory_v1(context, fallback ? undefined : workletURL);
    graph.gain.gain.value = 4; graph.setProtection(true);
    const buffer = context.createBuffer(2, 12000, 48000);
    const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
    for (let i = 0; i < left.length; i++) { left[i] = Math.sin(i * 0.13) * amplitude; right[i] = left[i] * 0.5; }
    const expected = Float32Array.from(left);
    for (let i = 0; i < sources; i++) { const source = context.createBufferSource(); source.buffer = buffer; source.connect(graph.gain); source.start(); }
    const result = await context.startRendering(), output = result.getChannelData(0), stereo = result.getChannelData(1);
    let peak = 0, sum = 0, quietError = 0, stereoError = 0;
    for (let i = 0; i < output.length; i++) {
      peak = Math.max(peak, Math.abs(output[i])); sum += output[i] ** 2;
      if (i >= 240 && !fallback) quietError = Math.max(quietError, Math.abs(output[i] - expected[i - 240] * 4 * sources));
      stereoError = Math.max(stereoError, Math.abs(stereo[i] - output[i] * 0.5));
    }
    graph.dispose();
    return { processor: graph.mode, peak, rms: Math.sqrt(sum / output.length), quietError, stereoError };
  }
  return { quiet: await render(0.025), loud: await render(0.95), mixed: await render(0.8, 2) };
}
