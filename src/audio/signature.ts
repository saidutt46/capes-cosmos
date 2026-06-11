/** Pulsar signature — every character's deterministic voice, derived purely
 * from their survey data. No audio imports; unit-testable. */
import type { StarFields } from '../data/parser';
import { NA_APPEARANCES, NA_YEAR } from '../data/parser';

export type SignatureFields = Pick<StarFields, 'year' | 'appearances' | 'align' | 'alive'>;

export interface Signature {
  pattern: number[]; // 8 gate steps (pulsar timing), at least one open
  period: number; // seconds per full cycle, 0.7–2.2
  freq: number; // Hz — debut year on a pentatonic lattice across 3 registers
  decay: number; // note decay seconds, 0.08–0.9 (print luminosity)
  cutoff: number; // lowpass Hz (bright stars ring brighter)
  timbre: 'sine' | 'triangle' | 'saw'; // Good / unrecorded·Neutral / Bad
  echo: boolean; // deceased — fading repeats
}

const PENTATONIC = [0, 3, 5, 7, 10]; // minor pentatonic semitones
const ROOT = 110; // A2 — the survey's carrier
const MAX_APP = 4043;

/** same deterministic hash as the layouts */
function hash(i: number, salt: number): number {
  let h = (i * 2654435761 + salt * 40503) >>> 0;
  h ^= h >> 13;
  h = (h * 2246822519) >>> 0;
  return ((h >>> 8) & 0xffff) / 0xffff;
}

export function signatureOf(i: number, stars: SignatureFields): Signature {
  const pattern = Array.from({ length: 8 }, (_, k) => (hash(i, 61 + k) > 0.55 ? 1 : 0));
  if (!pattern.some(Boolean)) pattern[Math.floor(hash(i, 69) * 8)] = 1;

  const year = stars.year[i];
  const t = year === NA_YEAR ? 0 : (year - 1935) / (2013 - 1935);
  const step = Math.min(14, Math.floor(t * 15)); // 15 lattice steps = 3 registers × 5 degrees
  const semis = 12 * Math.floor(step / 5) + PENTATONIC[step % 5];
  const freq = ROOT * Math.pow(2, semis / 12);

  const app = stars.appearances[i];
  const lum = app === NA_APPEARANCES ? 0 : Math.log1p(app) / Math.log1p(MAX_APP);

  const a = stars.align[i];
  return {
    pattern,
    period: 0.7 + hash(i, 71) * 1.5,
    freq,
    decay: 0.08 + lum * 0.82,
    cutoff: 600 + lum * 5400,
    timbre: a === 0 ? 'sine' : a === 2 ? 'saw' : 'triangle',
    echo: stars.alive[i] === 1,
  };
}
