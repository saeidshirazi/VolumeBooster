import { createServer } from 'node:http';

export async function mediaFixture() {
  const length = 48000 * 2;
  function wave(amplitude) {
    const wav = Buffer.alloc(44 + length * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(length * 2, 40);
    for (let i = 0; i < length; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / 48000) * amplitude), 44 + i * 2);
    return wav;
  }
  const quiet = wave(490), loud = wave(30000);
  const server = createServer((request, response) => {
    if (request.url === '/tone.wav' || request.url === '/loud.wav') {
      response.setHeader('Content-Type', 'audio/wav'); response.end(request.url === '/loud.wav' ? loud : quiet); return;
    }
    if (request.url === '/strict') response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; worker-src 'none'");
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

// Independent destination taps observe actual output, not the extension meter.
// Installed only inside isolated test processes, never in release packages.
export function installMediaProbe() {
  const Original = window.AudioContext;
  window.mediaProbes = []; window.audioContexts = [];
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function(destination, ...args) {
    const result = connect.call(this, destination, ...args);
    if (destination === this.context.destination) {
      const probe = window.mediaProbes.find(probe => probe.context === this.context);
      if (probe) {
        probe.output ||= this.context.createAnalyser(); probe.output.fftSize = 2048;
        connect.call(this, probe.output);
      }
    }
    return result;
  };
  window.AudioContext = class extends Original {
    constructor(...args) { super(...args); window.audioContexts.push(this); window.mediaProbes.push({ context: this }); }
    createMediaElementSource(media) {
      const source = super.createMediaElementSource(media), input = this.createAnalyser(); input.fftSize = 2048;
      source.connect(input); window.mediaProbes.find(probe => probe.context === this).input = input; return source;
    }
    createMediaStreamSource(stream) {
      const source = super.createMediaStreamSource(stream), input = this.createAnalyser(); input.fftSize = 2048;
      source.connect(input); window.mediaProbes.find(probe => probe.context === this).input = input; return source;
    }
    createGain() {
      const gain = super.createGain(), probe = window.mediaProbes.find(probe => probe.context === this);
      if (probe && !probe.gainOutput) {
        const output = this.createAnalyser(); output.fftSize = 2048; probe.gainOutput = output;
        const connectGain = gain.connect.bind(gain);
        gain.connect = (destination, ...args) => { const result = connectGain(destination, ...args); connectGain(output); return result; };
      }
      return gain;
    }
  };
  window.measureMedia = () => window.mediaProbes.filter(probe => probe.input).map(probe => {
    const measure = node => {
      if (!node) return { rms: 0, peak: 0 };
      const samples = new Float32Array(node.fftSize); node.getFloatTimeDomainData(samples);
      return { rms: Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length), peak: samples.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0) };
    };
    const input = measure(probe.input), output = measure(probe.output), gain = measure(probe.gainOutput);
    return { input: input.rms, output: output.rms, outputPeak: output.peak, gainOutput: gain.rms, state: probe.context.state };
  });
  window.measure = window.measureMedia;
}
