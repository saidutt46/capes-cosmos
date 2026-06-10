/** Time Tunnel — depth is the timeline. Fly forward through eight decades.
 * Each year is a disc of stars; the corridor visibly thickens through the late
 * 80s and bulges hard at 1993 (763 debuts) — you pass THROUGH the bubble.
 * Marvel drifts to port, DC to starboard, so the walls of the tunnel read as
 * two intertwined currents. Unknown years form a fog bank past 2013.
 */
import type { StarFields } from '../../data/parser';
import { NA_YEAR } from '../../data/parser';

const YEAR_MIN = 1935;
const YEAR_MAX = 2013;
export const TUNNEL_SPACING = 9; // world units per year
export const TUNNEL_LENGTH = (YEAR_MAX - YEAR_MIN) * TUNNEL_SPACING;
const BORE_R = 26; // inner clear bore the camera flies through
const WALL_R = 95;

function hash(i: number, salt: number): number {
  let h = (i * 2654435761 + salt * 40503) >>> 0;
  h ^= h >> 13;
  h = (h * 2246822519) >>> 0;
  return ((h >>> 8) & 0xffff) / 0xffff;
}

export function timeTunnel(stars: StarFields): Float32Array {
  const n = stars.count;
  const out = new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const year = stars.year[i];
    const z =
      year === NA_YEAR
        ? TUNNEL_LENGTH + 60 + hash(i, 31) * 90
        : (year - YEAR_MIN) * TUNNEL_SPACING + (hash(i, 31) - 0.5) * TUNNEL_SPACING;

    // radial scatter: clear bore, density falls off toward the wall radius
    const angle = hash(i, 32) * Math.PI * 2;
    const radius = BORE_R + (WALL_R - BORE_R) * Math.sqrt(hash(i, 33));

    // universes drift to opposite sides of the corridor
    const side = stars.universe[i] === 0 ? -1 : 1;
    const x = Math.cos(angle) * radius + side * 18;
    const y = Math.sin(angle) * radius * 0.8;

    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}
