import { createServer } from 'node:http';

export async function mediaFixture() {
  const length = 48000 * 2;
  const wav = Buffer.alloc(44 + length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 48000) * 490), 44 + i * 2);
  const server = createServer((request, response) => {
    if (request.url === '/tone.wav') { response.setHeader('Content-Type', 'audio/wav'); response.end(wav); return; }
    const source = request.url === '/unsafe' ? `http://localhost:${server.address().port}/tone.wav` : '/tone.wav';
    response.setHeader('Content-Type', 'text/html');
    response.end(`<!doctype html><html><head><title>Quiet media · VolumeBooster test</title></head><body style="font:18px system-ui;background:#f4f6fa;color:#243149;padding:60px"><h1>A quieter moment</h1><p>Native media playback, volume and fullscreen fixture.</p><audio id="media" src="${source}" loop controls></audio><p><button id="play">Play quiet audio</button><button id="fullscreen">Enter fullscreen</button></p><script>
      document.getElementById('play').onclick = () => document.getElementById('media').play();
      document.getElementById('fullscreen').onclick = () => document.documentElement.requestFullscreen();
    </script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

// Test-only parallel probes; not included in runtime archives.
export function installMediaProbe() {
  const Original = window.AudioContext;
  window.mediaProbes = [];
  window.audioContexts = [];
  window.AudioContext = class extends Original {
    constructor(...args) { super(...args); window.audioContexts.push(this); }
    createMediaElementSource(media) {
      const source = super.createMediaElementSource(media);
      const input = this.createAnalyser(); input.fftSize = 2048; source.connect(input);
      window.mediaProbes.push({ context: this, input });
      return source;
    }
    createGain() {
      const gain = super.createGain(), output = this.createAnalyser();
      output.fftSize = 2048;
      const connect = gain.connect.bind(gain);
      gain.connect = (destination, ...args) => { const result = connect(destination, ...args); connect(output); return result; };
      if (window.mediaProbes.length) window.mediaProbes.at(-1).gainOutput = output;
      return gain;
    }
    createDynamicsCompressor() {
      const compressor = super.createDynamicsCompressor();
      const output = this.createAnalyser(); output.fftSize = 2048;
      const connect = compressor.connect.bind(compressor);
      compressor.connect = (destination, ...args) => { const result = connect(destination, ...args); if (destination === this.destination) connect(output); return result; };
      window.mediaProbes.at(-1).output = output;
      return compressor;
    }
  };
  window.measureMedia = () => window.mediaProbes.map(probe => {
    const rms = node => { const a = new Float32Array(node.fftSize); node.getFloatTimeDomainData(a); return Math.sqrt(a.reduce((sum, sample) => sum + sample * sample, 0) / a.length); };
    return { input: rms(probe.input), output: rms(probe.output), gainOutput: probe.gainOutput ? rms(probe.gainOutput) : null, state: probe.context.state };
  });
}
