export type SfxName =
  | 'whoosh'
  | 'thump'
  | 'bounce'
  | 'crash'
  | 'scatter'
  | 'ding'
  | 'jingle'
  | 'horn'
  | 'chime'
  | 'buzz';

const MUSIC_STEP = 0.28;
const LEAD = [523, 0, 659, 523, 784, 659, 587, 523, 440, 523, 659, 784, 880, 784, 659, 587];
const BASS = [131, 0, 0, 0, 98, 0, 0, 0, 110, 0, 0, 0, 147, 0, 0, 0];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private windGain!: GainNode;
  private rainGain!: GainNode;
  private musicFilter: BiquadFilterNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private stepIdx = 0;
  private chainCounter = 0;
  private lastBird = 0;
  private rainMusic = false;

  ensure(): void {
    if (this.ctx) return;
    if (typeof window === 'undefined' || !window.AudioContext) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    // wind: looped noise through lowpass
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuffer(ctx, 2);
    windSrc.loop = true;
    const windLp = ctx.createBiquadFilter();
    windLp.type = 'lowpass';
    windLp.frequency.value = 300;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(windLp).connect(this.windGain).connect(this.master);
    windSrc.start();

    // rain: looped noise through highpass
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = noiseBuffer(ctx, 2);
    rainSrc.loop = true;
    const rainHp = ctx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.value = 1200;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rainSrc.connect(rainHp).connect(this.rainGain).connect(this.master);
    rainSrc.start();
  }

  private get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  sfx(name: SfxName): void {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    switch (name) {
      case 'whoosh':
        this.noiseBurst(t, 0.25, { type: 'bandpass', f0: 400, f1: 2500, gain: 0.25 });
        break;
      case 'thump':
        this.tone(t, 90, 50, 0.18, 'sine', 0.4);
        this.noiseBurst(t, 0.12, { type: 'lowpass', f0: 400, f1: 400, gain: 0.2 });
        break;
      case 'bounce':
        this.tone(t, 220, 180, 0.06, 'sine', 0.15);
        break;
      case 'crash':
        this.noiseBurst(t, 0.4, { type: 'lowpass', f0: 800, f1: 300, gain: 0.6 });
        this.tone(t, 200, 60, 0.4, 'square', 0.2);
        break;
      case 'scatter':
        for (let i = 0; i < 6; i++) {
          this.noiseBurst(t + i * 0.05, 0.03, { type: 'highpass', f0: 2000, f1: 2000, gain: 0.1 });
        }
        break;
      case 'ding':
        this.tone(t, 1318, 1318, 0.2, 'sine', 0.2);
        break;
      case 'jingle':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(t + i * 0.12, f, f, 0.12, 'square', 0.15));
        break;
      case 'horn':
        this.tone(t, 440, 440, 0.3, 'square', 0.12);
        this.tone(t, 330, 330, 0.3, 'square', 0.1);
        break;
      case 'chime':
        this.tone(t, 2093, 2093, 0.3, 'sine', 0.05);
        break;
      case 'buzz':
        this.tone(t, 110, 110, 0.3, 'sawtooth', 0.12);
        break;
    }
  }

  private tone(
    t: number,
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType,
    gain: number,
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(
    t: number,
    dur: number,
    o: { type: BiquadFilterType; f0: number; f1: number; gain: number },
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, Math.max(0.5, dur + 0.1));
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== o.f0) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  startMusic(): void {
    if (!this.ready || this.musicTimer !== null) return;
    const ctx = this.ctx!;
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 2500;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.9;
    this.musicFilter.connect(this.musicGain).connect(this.master);
    this.stepIdx = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.ready) return;
      const c = this.ctx!;
      const t = c.currentTime;
      const i = this.stepIdx % 16;
      const lead = LEAD[i];
      if (lead > 0) this.note(t, lead, 'square', 0.08, MUSIC_STEP * 0.9);
      const b = BASS[i];
      if (b > 0 && i % 4 === 0) this.note(t, b, 'triangle', 0.06, MUSIC_STEP * 3.5);
      this.stepIdx++;
    }, MUSIC_STEP * 1000);
  }

  private note(t: number, freq: number, type: OscillatorType, gain: number, dur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.musicFilter!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  setRainMusic(on: boolean): void {
    if (!this.ready) return;
    this.rainMusic = on;
    const c = this.ctx!;
    this.musicFilter!.frequency.setTargetAtTime(on ? 700 : 2500, c.currentTime, 0.5);
    this.musicGain!.gain.setTargetAtTime(on ? 0.55 : 0.9, c.currentTime, 0.5);
  }

  setAmbience(o: { speed: number; raining: boolean }): void {
    if (!this.ready) return;
    const c = this.ctx!;
    this.windGain.gain.setTargetAtTime(o.speed * 0.02, c.currentTime, 0.3);
    this.rainGain.gain.setTargetAtTime(o.raining ? 0.18 : 0, c.currentTime, 2);
    // birds: quiet chirps when calm and dry
    if (!o.raining && o.speed < 1.5 && c.currentTime - this.lastBird > 3) {
      if (Math.random() < 0.004) {
        this.lastBird = c.currentTime;
        this.tone(c.currentTime, 2500, 3200, 0.15, 'sine', 0.05);
      }
    }
  }

  chainTick(speed: number): void {
    if (!this.ready) return;
    this.chainCounter++;
    if (speed > 0.5 && this.chainCounter % 6 === 0) {
      this.noiseBurst(this.ctx!.currentTime, 0.015, {
        type: 'highpass',
        f0: 2000,
        f1: 2000,
        gain: 0.04 + speed * 0.01,
      });
    }
  }

  dispose(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.ctx?.close();
    this.ctx = null;
    this.musicTimer = null;
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
