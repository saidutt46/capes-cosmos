/** Expanding Universe — concentric shells, radius = debut year.
 * 1935 is the big-bang core; 2013 the outer rim. Direction is a uniform sphere
 * scatter (deterministic per star), so each year reads as a glowing shell.
 * Unknown-year stars drift in a thin far halo beyond the rim — present, honest.
 */
import type { StarFields } from '../../data/parser';
import { NA_YEAR } from '../../data/parser';

const YEAR_MIN = 1935;
const YEAR_MAX = 2013;
const CORE_R = 26;
const RIM_R = 330;
const HALO_R = 400;

function hash(i: number, salt: number): number {
  let h = (i * 2654435761 + salt * 40503) >>> 0;
  h ^= h >> 13;
  h = (h * 2246822519) >>> 0;
  return ((h >>> 8) & 0xffff) / 0xffff;
}

export function expandingUniverse(stars: StarFields): Float32Array {
  const n = stars.count;
  const out = new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const year = stars.year[i];
    const theta = hash(i, 21) * Math.PI * 2;
    const phi = Math.acos(2 * hash(i, 22) - 1);

    let r: number;
    if (year === NA_YEAR) {
      r = HALO_R + hash(i, 23) * 36;
    } else {
      const t = (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN);
      // sqrt spreads inner shells apart so the dense 80s/90s don't crush the core
      r = CORE_R + (RIM_R - CORE_R) * Math.sqrt(t) + (hash(i, 23) - 0.5) * 5;
    }

    out[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    out[i * 3 + 1] = r * Math.cos(phi);
    out[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  return out;
}
