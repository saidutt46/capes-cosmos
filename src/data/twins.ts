/** Binary companion — a character's statistical twin in the OPPOSITE universe.
 * Weighted, normalized distance over debut year, alignment, fate, and
 * luminosity percentile. Pure + deterministic; NA-aware. */
import { NA_APPEARANCES, NA_U8, NA_YEAR } from './parser';

export interface TwinWeights { year: number; align: number; fate: number; pct: number; }
export const TWIN_WEIGHTS: TwinWeights = { year: 1.0, align: 1.0, fate: 0.7, pct: 1.2 };

export interface TwinResult { index: number; separation: number; }

interface TwinStars {
  universe: Uint8Array; year: Uint16Array; align: Uint8Array;
  alive: Uint8Array; appearances: Uint16Array; count: number;
}

const YEAR_SPAN = 2013 - 1935;

export function twinOf(
  i: number,
  stars: TwinStars,
  percentile: (i: number) => number,
  weights: TwinWeights = TWIN_WEIGHTS,
): TwinResult | null {
  const wSum = weights.year + weights.align + weights.fate + weights.pct;
  const otherUni = stars.universe[i] === 0 ? 1 : 0;

  const yA = stars.year[i];
  const alA = stars.align[i];
  const alvA = stars.alive[i];
  const pA = percentile(i);

  let best = -1;
  let bestD = Infinity;
  for (let j = 0; j < stars.count; j++) {
    if (stars.universe[j] !== otherUni) continue;

    const dYear =
      yA === NA_YEAR || stars.year[j] === NA_YEAR
        ? 0.5
        : Math.abs(yA - stars.year[j]) / YEAR_SPAN;
    const dAlign =
      alA === NA_U8 || stars.align[j] === NA_U8 ? 0.5 : alA === stars.align[j] ? 0 : 1;
    const dFate =
      alvA === NA_U8 || stars.alive[j] === NA_U8 ? 0.5 : alvA === stars.alive[j] ? 0 : 1;
    const dPct =
      stars.appearances[i] === NA_APPEARANCES || stars.appearances[j] === NA_APPEARANCES
        ? 0.5
        : Math.abs(pA - percentile(j)) / 100;

    const d =
      (weights.year * dYear + weights.align * dAlign + weights.fate * dFate + weights.pct * dPct) /
      wSum;
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  }
  return best < 0 ? null : { index: best, separation: bestD };
}
