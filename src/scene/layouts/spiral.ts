/** Galaxy Spiral layout — the default sky.
 *
 * Two-armed logarithmic spiral: Marvel one arm, DC the other (the Marvel arm is
 * honestly ~2.4x denser — that asymmetry is itself a finding). Debut year winds
 * each star along its arm (1935 at the core → 2013 at the rim); alignment lifts
 * heroes above the disk and sinks villains below; unknown years scatter into a
 * faint halo so they're present but never lie about their position.
 */
import type { StarFields } from '../../data/parser';
import { NA_YEAR, NA_U8 } from '../../data/parser';

const YEAR_MIN = 1935;
const YEAR_MAX = 2013;
const CORE_R = 14;
const RIM_R = 300;
const WINDS = 2.4 * Math.PI * 2; // how far the arms wrap
const ARM_SPREAD = 18; // gaussian-ish scatter across the arm width
const HALO_R = 340;

/** Deterministic per-star jitter (no Math.random — layouts must be stable). */
function hash(i: number, salt: number): number {
  let h = (i * 2654435761 + salt * 40503) >>> 0;
  h ^= h >> 13;
  h = (h * 2246822519) >>> 0;
  return ((h >>> 8) & 0xffff) / 0xffff; // [0,1)
}

/** A point on an arm — shared by the star layout and the nebula wisps so the
 * clouds trace exactly where the stars live. */
export function armPoint(
  year: number,
  universe: number,
  j1: number,
  j2: number,
): [number, number, number] {
  const t = (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN);
  const arm = universe === 0 ? 0 : Math.PI;
  const angle = arm + t * WINDS + (j1 - 0.5) * 0.22;
  const radius =
    CORE_R + (RIM_R - CORE_R) * Math.pow(t, 0.8) + (j2 - 0.5) * ARM_SPREAD * 2;
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
}

export function galaxySpiral(stars: StarFields): Float32Array {
  const n = stars.count;
  const out = new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const year = stars.year[i];
    const j1 = hash(i, 1);
    const j2 = hash(i, 2);
    const j3 = hash(i, 3);

    if (year === NA_YEAR) {
      // unknown debut: faint spherical halo around the whole galaxy
      const theta = j1 * Math.PI * 2;
      const phi = Math.acos(2 * j2 - 1);
      const r = HALO_R * (0.85 + 0.3 * j3);
      out[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      out[i * 3 + 1] = r * Math.cos(phi) * 0.5;
      out[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      continue;
    }

    const [x, , z] = armPoint(year, stars.universe[i], j1, j2);

    // moral topography: heroes lift, villains sink, neutral/unknown stay flat
    const a = stars.align[i];
    const lift = a === 0 ? 1 : a === 2 ? -1 : 0;
    const y = lift * (6 + 18 * j3) + (j1 - 0.5) * 6
      + (a === NA_U8 ? (j2 - 0.5) * 10 : 0);

    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}
