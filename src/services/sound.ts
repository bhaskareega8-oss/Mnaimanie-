// Web Audio synthesizer for space retro-futuristic sound effects

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wet: GainNode | null = null;
  public enabled: boolean = true;

  constructor() {
    try {
      const saved = localStorage.getItem('lunarSound');
      this.enabled = saved !== 'off';
    } catch {
      this.enabled = true;
    }
  }

  public init(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return true;
    }
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return false;

    this.ctx = new AudioContextClass();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);

    // Echo for space feel
    const delay = this.ctx.createDelay();
    delay.delayTime.value = 0.18;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.28;
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3200;

    this.wet = this.ctx.createGain();
    this.wet.gain.value = 0.35;
    this.wet.connect(delay);
    delay.connect(lowpass);
    lowpass.connect(feedback);
    feedback.connect(delay);
    lowpass.connect(this.master);

    return true;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem('lunarSound', this.enabled ? 'on' : 'off');
    } catch {
      // ignore
    }
    if (this.enabled) {
      this.play('click');
    }
    return this.enabled;
  }

  private tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; vol?: number; attack?: number; slideTo?: number | null; wet?: boolean } = {}) {
    if (!this.ctx || !this.master) return;
    const { type = 'sine', vol = 0.25, attack = 0.008, slideTo = null, wet = true } = opts;
    const t = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    }

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain);
    gain.connect(this.master);
    if (wet && this.wet) gain.connect(this.wet);

    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private bell(freq: number, at: number, dur = 1.1, vol = 0.18) {
    this.tone(freq, at, dur, { vol });
    this.tone(freq * 2.01, at, dur * 0.6, { vol: vol * 0.35 });
    this.tone(freq * 3.02, at, dur * 0.35, { vol: vol * 0.15, type: 'triangle' });
  }

  private noise(at: number, dur: number, vol = 0.2, freq = 1200) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + at;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  public play(name: 'click' | 'tick' | 'signal' | 'unlock' | 'error' | 'win' | 'loss' | 'jackpot') {
    if (!this.enabled || !this.init()) return;

    switch (name) {
      case 'click':
        this.tone(1800, 0, 0.05, { type: 'triangle', vol: 0.08, wet: false });
        break;
      case 'tick':
        this.tone(1320, 0, 0.06, { type: 'square', vol: 0.04, wet: false });
        break;
      case 'signal':
        this.tone(660, 0, 0.5, { vol: 0.14, slideTo: 990 });
        this.bell(1320, 0.12, 0.8, 0.1);
        break;
      case 'unlock':
        this.tone(180, 0, 0.7, { type: 'sawtooth', vol: 0.07, slideTo: 900 });
        this.noise(0, 0.6, 0.08, 2400);
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.bell(f, 0.45 + i * 0.07, 1.4, 0.13));
        break;
      case 'error':
        this.tone(220, 0, 0.16, { type: 'square', vol: 0.09, wet: false });
        this.tone(165, 0.2, 0.26, { type: 'square', vol: 0.09, wet: false });
        break;
      case 'win':
        [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => this.bell(f, i * 0.09, 1.2, 0.16));
        this.tone(2637, 0.42, 0.4, { vol: 0.05 });
        this.tone(3136, 0.5, 0.4, { vol: 0.05 });
        break;
      case 'loss':
        this.tone(392, 0, 0.35, { type: 'triangle', vol: 0.18, slideTo: 370 });
        this.tone(311, 0.3, 0.35, { type: 'triangle', vol: 0.18, slideTo: 294 });
        this.tone(247, 0.6, 0.9, { type: 'triangle', vol: 0.2, slideTo: 150 });
        this.tone(62, 0.6, 0.8, { vol: 0.22, wet: false });
        break;
      case 'jackpot':
        this.tone(55, 0, 1.2, { vol: 0.35, slideTo: 40, wet: false });
        this.noise(0, 0.5, 0.12, 600);
        for (let i = 0; i < 16; i++) {
          this.tone(2000 + Math.random() * 1800, 0.1 + i * 0.06, 0.18, { type: 'triangle', vol: 0.07 });
        }
        [523.25, 659.25, 783.99].forEach((f) => this.tone(f, 0.2, 1.6, { type: 'sawtooth', vol: 0.045 }));
        [1046.5, 1318.5, 1567.98, 2093].forEach((f, i) => this.bell(f, 0.5 + i * 0.12, 1.6, 0.14));
        break;
    }
  }
}

export const sound = new SoundEngine();
