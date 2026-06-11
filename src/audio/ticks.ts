/** Sci-fi telemetry ticks for the first-light typing. Best-effort audio:
 * browsers gate sound behind a user gesture, so on a completely untouched
 * page the ticks stay silent — the type-on still reads fine mute. Replays
 * via RECALIBRATE (a click) always sound. */
let ctx: AudioContext | null = null;
let muted = false;

/** RADIO OFF is the app's global mute — covers ticks and nav sounds too */
export function setSoundMuted(m: boolean) {
  muted = m;
}

/** resume the tick context from inside a user gesture — resume() is async,
 * so doing it here (pointerdown) means the context is already running by the
 * time a click handler asks ensure() for it */
export function wakeSounds() {
  if (typeof AudioContext === 'undefined') return;
  try {
    ctx ??= new AudioContext();
  } catch {
    return;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function ensure(): AudioContext | null {
  if (muted) return null;
  if (typeof AudioContext === 'undefined') return null;
  // never create the context before the page has real user activation —
  // a pre-gesture context starts suspended and poisons every later attempt;
  // created inside/after a gesture it starts running immediately
  if (!ctx && !(navigator.userActivation?.hasBeenActive ?? true)) return null;
  try {
    ctx ??= new AudioContext();
  } catch {
    return null;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx.state === 'running' ? ctx : null;
}

/** one short enveloped note — shared by the nav motifs */
function note(
  c: AudioContext,
  opts: { type: OscillatorType; from: number; to?: number; at?: number; dur: number; gain: number; cutoff?: number },
) {
  const t = c.currentTime + (opts.at ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type;
  o.frequency.setValueAtTime(opts.from, t);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur * 0.85);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(opts.gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0004, t + opts.dur);
  o.connect(g);
  if (opts.cutoff) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = opts.cutoff;
    g.connect(lp);
    lp.connect(c.destination);
  } else {
    g.connect(c.destination);
  }
  o.start(t);
  o.stop(t + opts.dur + 0.1);
}

/** each sky has its own engage motif */
export function layoutSound(name: 'spiral' | 'shells' | 'tunnel' | 'constellations') {
  const c = ensure();
  if (!c) return;
  switch (name) {
    case 'spiral': // the galaxy winds up — rising glide
      note(c, { type: 'sine', from: 196, to: 392, dur: 0.55, gain: 0.06 });
      note(c, { type: 'sine', from: 392, to: 588, at: 0.1, dur: 0.45, gain: 0.025 });
      break;
    case 'shells': // the universe expands — a chord spreading outward
      note(c, { type: 'sine', from: 220, dur: 0.7, gain: 0.05 });
      note(c, { type: 'sine', from: 330, at: 0.12, dur: 0.6, gain: 0.04 });
      note(c, { type: 'sine', from: 440, at: 0.24, dur: 0.5, gain: 0.03 });
      break;
    case 'tunnel': // fly forward — a falling whoosh
      note(c, { type: 'sawtooth', from: 520, to: 130, dur: 0.6, gain: 0.045, cutoff: 900 });
      break;
    case 'constellations': // myths pinned to the dark — three quick plucks
      note(c, { type: 'triangle', from: 660, dur: 0.18, gain: 0.05 });
      note(c, { type: 'triangle', from: 880, at: 0.09, dur: 0.18, gain: 0.045 });
      note(c, { type: 'triangle', from: 1175, at: 0.18, dur: 0.22, gain: 0.04 });
      break;
  }
}

/** lens engage / clear — a small instrument affirmation */
export function lensSound(on: boolean) {
  const c = ensure();
  if (!c) return;
  if (on) note(c, { type: 'square', from: 740, to: 980, dur: 0.1, gain: 0.03, cutoff: 2400 });
  else note(c, { type: 'square', from: 620, to: 420, dur: 0.12, gain: 0.03, cutoff: 2000 });
}

/** one keystroke blip — pitch jitters deterministically per char index */
export function typeTick(n: number) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = 1500 + ((n * 137) % 9) * 90;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.022, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0004, t + 0.045);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + 0.08);
}

/** line-complete confirmation — a soft falling blip */
export function lineTick() {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(620, t);
  o.frequency.exponentialRampToValueAtTime(330, t + 0.12);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0005, t + 0.22);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + 0.3);
}
