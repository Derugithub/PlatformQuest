/**
 * Synthesized sound: every effect and both music loops are generated with WebAudio oscillators,
 * so there are no audio files. Music tempo can be raised (hurry-up) without restarting the loop.
 */

export type Sfx =
  | 'jump'
  | 'spin'
  | 'coin'
  | 'stomp'
  | 'kick'
  | 'hurt'
  | 'powerup'
  | 'heart'
  | 'death'
  | 'clear'
  | 'bump'
  | 'break'
  | 'throw'
  | 'boing'
  | 'switch'
  | 'tick'
  | 'checkpoint'
  | 'bossHit'
  | 'fire'
  | 'timeUp';

export type Song = 'hill' | 'boss' | 'star';

type Note = number | null;

/** Original loops, one entry per eighth note. Numbers are MIDI notes; null is a rest. */
const SONGS: Record<Song, { bpm: number; lead: Note[]; bass: Note[]; wave: OscillatorType }> = {
  hill: {
    bpm: 138,
    wave: 'square',
    lead: [
      72, null, 76, 79, 81, null, 79, 76, 74, null, 77, 81, 79, null, null, null,
      76, null, 79, 83, 84, null, 83, 79, 81, 79, 77, 76, 74, null, null, null,
      72, 74, 76, null, 77, 76, 74, 72, 69, null, 72, null, 74, 76, 77, null,
      79, null, 77, 76, 74, null, 71, 74, 72, null, null, null, 67, null, null, null,
    ],
    bass: [
      48, null, 55, null, 48, null, 55, null, 50, null, 57, null, 55, null, 50, null,
      52, null, 59, null, 53, null, 57, null, 50, null, 57, null, 55, null, 50, null,
      48, null, 55, null, 53, null, 57, null, 45, null, 52, null, 50, null, 53, null,
      55, null, 50, null, 55, null, 47, null, 48, null, 55, null, 43, null, 48, null,
    ],
  },
  boss: {
    bpm: 156,
    wave: 'sawtooth',
    lead: [
      69, null, 72, 69, 76, null, 75, 74, 72, null, 69, null, 68, 69, 71, null,
      69, null, 72, 69, 77, null, 76, 74, 72, 74, 72, 71, 69, null, null, null,
    ],
    bass: [
      45, 45, null, 45, 45, null, 45, 52, 41, 41, null, 41, 40, null, 40, 44,
      45, 45, null, 45, 45, null, 45, 52, 41, 41, null, 41, 44, null, 40, null,
    ],
  },
  star: {
    bpm: 176,
    wave: 'square',
    lead: [72, 76, 79, 84, 79, 76, 74, 77, 81, 86, 81, 77, 76, 79, 83, 88, 83, 79, 77, 81, 84, 89, 84, 81],
    bass: [48, null, 48, null, 50, null, 50, null, 52, null, 52, null, 53, null, 53, null, 55, null, 55, null, 57, null, 59, null],
  },
};

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private song: Song | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tempo = 1;
  musicOn = true;
  soundOn = true;

  /** Browsers start audio suspended until a touch. Call on the first pointer event. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(music: boolean, sound: boolean): void {
    this.musicOn = music;
    this.soundOn = sound;
    if (this.musicBus) this.musicBus.gain.value = music ? 0.32 : 0;
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0, bus?: GainNode | null): void {
    const ctx = this.ctx;
    const out = bus ?? this.sfxBus;
    if (!ctx || !out) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, cutoff: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.noiseBuffer) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur);
  }

  play(name: Sfx): void {
    if (!this.soundOn || !this.ctx) return;
    switch (name) {
      case 'jump':
        this.tone(330, 0.16, 'square', 0.12, 720);
        break;
      case 'spin':
        this.tone(500, 0.08, 'triangle', 0.14, 900);
        this.tone(700, 0.08, 'triangle', 0.12, 1200, 0.07);
        this.tone(900, 0.1, 'triangle', 0.1, 1500, 0.14);
        break;
      case 'coin':
        this.tone(988, 0.06, 'square', 0.1);
        this.tone(1319, 0.22, 'square', 0.1, undefined, 0.06);
        break;
      case 'stomp':
        this.noise(0.08, 0.3, 900);
        this.tone(220, 0.12, 'square', 0.14, 110);
        break;
      case 'kick':
        this.noise(0.06, 0.25, 2200);
        this.tone(440, 0.08, 'square', 0.1, 220);
        break;
      case 'hurt':
        this.tone(600, 0.3, 'sawtooth', 0.12, 150);
        break;
      case 'powerup':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.12, 'square', 0.1, undefined, i * 0.06));
        break;
      case 'heart':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.16, undefined, i * 0.08));
        break;
      case 'death':
        [494, 466, 440, 392, 330, 262].forEach((f, i) => this.tone(f, 0.2, 'square', 0.12, undefined, i * 0.14));
        break;
      case 'clear':
        [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone(f, i === 5 ? 0.6 : 0.16, 'square', 0.12, undefined, i * 0.13));
        break;
      case 'bump':
        this.tone(160, 0.08, 'square', 0.14, 90);
        break;
      case 'break':
        this.noise(0.25, 0.35, 3000);
        break;
      case 'throw':
        this.tone(900, 0.1, 'triangle', 0.1, 400);
        break;
      case 'boing':
        this.tone(180, 0.3, 'sine', 0.3, 520);
        break;
      case 'switch':
        this.tone(392, 0.1, 'square', 0.12);
        this.tone(784, 0.2, 'square', 0.12, undefined, 0.1);
        break;
      case 'tick':
        this.tone(1760, 0.04, 'square', 0.06);
        break;
      case 'checkpoint':
        [659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.16, undefined, i * 0.08));
        break;
      case 'bossHit':
        this.noise(0.15, 0.35, 1200);
        this.tone(140, 0.25, 'sawtooth', 0.16, 70);
        break;
      case 'fire':
        this.noise(0.4, 0.22, 700);
        break;
      case 'timeUp':
        [880, 698, 587, 440].forEach((f, i) => this.tone(f, 0.18, 'square', 0.12, undefined, i * 0.16));
        break;
    }
  }

  playSong(song: Song): void {
    this.stopSong();
    if (!this.ctx) return;
    this.song = song;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopSong(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.song = null;
  }

  setTempo(factor: number): void {
    this.tempo = factor;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.song || !this.musicBus) return;
    const def = SONGS[this.song];
    const stepDur = 60 / (def.bpm * this.tempo) / 2;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const delay = Math.max(0, this.nextTime - ctx.currentTime);
      const lead = def.lead[this.step % def.lead.length];
      const bass = def.bass[this.step % def.bass.length];
      if (lead != null) this.tone(midi(lead), stepDur * 0.9, def.wave, 0.07, undefined, delay, this.musicBus);
      if (bass != null) this.tone(midi(bass), stepDur * 0.95, 'triangle', 0.16, undefined, delay, this.musicBus);
      this.nextTime += stepDur;
      this.step += 1;
    }
  }
}
