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

  /** FLIGHT doppler — up to 4 sustained drones for the nearest bodies */
  private voices: { osc: OscillatorNode; gain: GainNode; baseFreq: number }[] = [];

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
    this.killProximity();
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

  /** FLIGHT — sustained proximity drones, doppler-bent.
   * Call ~10/s with the nearest ≤4 bodies; an empty array silences them.
   * freq = the body's pulsar pitch · doppler = 1 ± approach factor · gain by dist.
   * Drones are created/destroyed as the list length changes; freq*doppler and
   * gain glide via setTargetAtTime so a slingshot bends the note. */
  setProximityVoices(voices: { freq: number; gain: number; doppler: number }[]) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) {
      // tear down any live drones when disabled
      if (this.voices.length) this.killProximity();
      return;
    }
    const want = voices.slice(0, 4);
    const now = ctx.currentTime;

    // grow: create missing oscillators
    while (this.voices.length < want.length) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.master);
      osc.frequency.value = want[this.voices.length].freq;
      osc.start();
      this.voices.push({ osc, gain, baseFreq: want[this.voices.length].freq });
    }
    // shrink: fade + drop extras
    while (this.voices.length > want.length) {
      const v = this.voices.pop()!;
      v.gain.gain.setTargetAtTime(0, now, 0.08);
      const osc = v.osc;
      window.setTimeout(() => {
        try { osc.stop(); } catch { /* already stopped */ }
      }, 300);
    }
    // update the survivors
    for (let i = 0; i < want.length; i++) {
      const v = this.voices[i];
      const w = want[i];
      v.osc.frequency.setTargetAtTime(w.freq * w.doppler, now, 0.1);
      v.gain.gain.setTargetAtTime(Math.max(0, w.gain), now, 0.1);
    }
  }

  private killProximity() {
    for (const v of this.voices) {
      try { v.gain.gain.value = 0; v.osc.stop(); } catch { /* noop */ }
    }
    this.voices.length = 0;
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
    this.killProximity();
    void this.ctx?.close();
    this.ctx = null;
    this.enabled = false;
  }
}
