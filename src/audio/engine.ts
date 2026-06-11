/** FLIGHT engine hum — a filtered sawtooth + noise bed whose gain follows the
 * vessel's thrust and boost. Gesture-safe lazy AudioContext (mirrors ticks.ts),
 * and silent while the global mute (RADIO OFF) is engaged.
 *
 * The cruise voice is a low sawtooth through a lowpass; the boost voice adds a
 * brighter overtone + a touch of filtered noise so a slingshot roars. Both
 * gains ride setTargetAtTime so the hum breathes rather than steps.
 */
import { soundsMuted } from './ticks';

export class EngineSound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private cruiseGain!: GainNode;
  private boostGain!: GainNode;
  private noiseGain!: GainNode;
  private boostFilter!: BiquadFilterNode;
  private started = false;
  private stopped = false;

  /** Build the graph inside a gesture. Safe to call repeatedly. If an existing
   * AudioContext is supplied (e.g. shared with the radio) it is reused. */
  private ensure(): AudioContext | null {
    if (this.stopped) return null;
    if (soundsMuted()) return null;
    if (typeof AudioContext === 'undefined') return null;
    if (!this.ctx && !(navigator.userActivation?.hasBeenActive ?? true)) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
      this.build(this.ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx.state === 'running' ? this.ctx : this.ctx;
  }

  private build(ctx: AudioContext) {
    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(ctx.destination);

    // cruise: two slightly detuned sawtooths through a soft lowpass
    this.cruiseGain = ctx.createGain();
    this.cruiseGain.gain.value = 0.04;
    const cruiseLp = ctx.createBiquadFilter();
    cruiseLp.type = 'lowpass';
    cruiseLp.frequency.value = 520;
    this.cruiseGain.connect(cruiseLp);
    cruiseLp.connect(this.master);
    for (const [f, d] of [[58, -6], [58, 7]] as [number, number][]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(this.cruiseGain);
      o.start();
    }

    // boost: a brighter overtone that swells under SPACE
    this.boostGain = ctx.createGain();
    this.boostGain.gain.value = 0.0;
    this.boostFilter = ctx.createBiquadFilter();
    this.boostFilter.type = 'lowpass';
    this.boostFilter.frequency.value = 900;
    this.boostGain.connect(this.boostFilter);
    this.boostFilter.connect(this.master);
    for (const [f, d] of [[116, -4], [174, 5]] as [number, number][]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(this.boostGain);
      o.start();
    }

    // noise bed: a hiss filtered low, gated by boost for the slingshot roar
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.0;
    const noiseLp = ctx.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.value = 1400;
    this.noiseGain.connect(noiseLp);
    noiseLp.connect(this.master);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // deterministic pink-ish noise (LCG, not Math.random — keeps the bed stable)
    let s = 0x9e3779b1 >>> 0;
    for (let i = 0; i < data.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      data[i] = (s / 0xffffffff) * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.noiseGain);
    src.start();
  }

  /** cruise01: throttle 0..1 · boost01: boost engagement 0..1 */
  setLevel(cruise01: number, boost01: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    if (!this.started) {
      this.master.gain.setTargetAtTime(0.9, t, 0.4);
      this.started = true;
    }
    const c = Math.max(0, Math.min(1, cruise01));
    const b = Math.max(0, Math.min(1, boost01));
    this.cruiseGain.gain.setTargetAtTime(0.025 + c * 0.05, t, 0.12);
    this.boostGain.gain.setTargetAtTime(b * 0.045, t, 0.18);
    this.noiseGain.gain.setTargetAtTime(b * 0.02, t, 0.2);
  }

  stop() {
    this.stopped = true;
    if (this.ctx) {
      try {
        this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
      } catch {
        /* graph may not be built */
      }
      const ctx = this.ctx;
      this.ctx = null;
      window.setTimeout(() => void ctx.close().catch(() => {}), 400);
    }
  }
}
