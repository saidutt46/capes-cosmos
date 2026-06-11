/** THE RADIO BAND — the survey's audio band. Pure WebAudio, zero assets.
 * Lazy AudioContext (created on the toggle gesture → autoplay-safe).
 * Voices → envelope gains → master → gentle compressor → out.
 * A near-silent detuned bed hums while ON so "on" never means "silent". */
import type { Signature } from './signature';

export class RadioBand {
  static readonly supported =
    typeof window !== 'undefined' && typeof AudioContext !== 'undefined';

  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bedGain!: GainNode;
  private loopTimer = 0;
  private current: Signature | null = null;
  private nextCycle = 0;
  enabled = false;

  enable() {
    if (!RadioBand.supported) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -28;
      comp.ratio.value = 6;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.14;
      this.master.connect(comp);
      this.bedGain = this.ctx.createGain();
      this.bedGain.gain.value = 0;
      this.bedGain.connect(this.master);
      for (const f of [55, 55.6]) {
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.connect(this.bedGain);
        o.start();
      }
    }
    void this.ctx.resume();
    this.bedGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 1.2);
    this.enabled = true;
  }

  disable() {
    this.stopSignature();
    this.enabled = false;
    if (this.ctx) {
      this.bedGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      window.setTimeout(() => {
        if (!this.enabled) void this.ctx?.suspend();
      }, 500);
    }
  }

  /** loop a locked star's pulsar signature until stopped */
  playSignature(sig: Signature) {
    if (!this.ctx || !this.enabled) return;
    this.stopSignature();
    this.current = sig;
    this.nextCycle = this.ctx.currentTime + 0.08;
    const schedule = () => {
      if (!this.ctx || !this.current) return;
      while (this.nextCycle < this.ctx.currentTime + this.current.period) {
        const stepDur = this.current.period / 8;
        this.current.pattern.forEach((gate, k) => {
          if (gate) this.voice(this.current!, this.nextCycle + k * stepDur);
        });
        this.nextCycle += this.current.period;
      }
    };
    schedule();
    this.loopTimer = window.setInterval(schedule, 250);
  }

  stopSignature() {
    window.clearInterval(this.loopTimer);
    this.current = null;
  }

  /** sector census answers as a quiet staggered chord (≤5 voices) */
  playChord(freqs: number[]) {
    if (!this.ctx || !this.enabled) return;
    freqs.slice(0, 5).forEach((freq, k) => {
      this.voice(
        { pattern: [], period: 1, freq, decay: 0.9, cutoff: 2400, timbre: 'sine', echo: false },
        this.ctx!.currentTime + 0.05 + k * 0.09,
        0.5,
      );
    });
  }

  /** one enveloped note */
  private voice(sig: Signature, at: number, level = 1) {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.22 * level, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0004, at + 0.02 + sig.decay);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = sig.cutoff;
    gain.connect(lp);
    lp.connect(this.master);
    if (sig.echo) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.28;
      const fb = ctx.createGain();
      fb.gain.value = 0.3;
      delay.connect(fb);
      fb.connect(delay);
      lp.connect(delay);
      delay.connect(this.master);
    }
    const spawn = (type: OscillatorType, detune: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = sig.freq;
      o.detune.value = detune;
      o.connect(gain);
      o.start(at);
      o.stop(at + sig.decay + 1.8);
    };
    if (sig.timbre === 'saw') {
      spawn('sawtooth', -7);
      spawn('sawtooth', 7);
    } else {
      spawn(sig.timbre === 'sine' ? 'sine' : 'triangle', 0);
    }
  }

  dispose() {
    this.stopSignature();
    void this.ctx?.close();
    this.ctx = null;
    this.enabled = false;
  }
}
