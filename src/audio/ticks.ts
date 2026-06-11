/** Sci-fi telemetry ticks for the first-light typing. Best-effort audio:
 * browsers gate sound behind a user gesture, so on a completely untouched
 * page the ticks stay silent — the type-on still reads fine mute. Replays
 * via RECALIBRATE (a click) always sound. */
let ctx: AudioContext | null = null;

function ensure(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  try {
    ctx ??= new AudioContext();
  } catch {
    return null;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx.state === 'running' ? ctx : null;
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
