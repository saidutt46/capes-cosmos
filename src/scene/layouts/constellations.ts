/** Constellations — the multiverse mapped honestly.
 * Each fictional reality is a nebula: Earth-616 and New Earth as the two great
 * galaxies, the alternate Earths as dwarf satellites drifting at the edges.
 * Cluster radius grows with population (cbrt keeps volume ∝ count).
 */
import type { StarFields } from '../../data/parser';

// centers chosen so the two giants face off and the dwarfs ring them
export const CENTERS: [number, number, number][] = [
  [-150, 0, 0], // Earth-616 (16,345)
  [185, 10, 60], // New Earth (6,829)
  [60, 95, -210], // Earth-One (43)
  [-80, -105, -230], // Earth-Two (9)
  [240, 90, -150], // Prime Earth (8)
  [10, 160, 250], // Alternate (38)
];

function hash(i: number, salt: number): number {
  let h = (i * 2654435761 + salt * 40503) >>> 0;
  h ^= h >> 13;
  h = (h * 2246822519) >>> 0;
  return ((h >>> 8) & 0xffff) / 0xffff;
}

/** approx gaussian from three uniform hashes (central limit, cheap + stable) */
function gauss(i: number, salt: number): number {
  return (hash(i, salt) + hash(i, salt + 7) + hash(i, salt + 13)) / 1.5 - 1;
}

export function constellations(stars: StarFields): Float32Array {
  const n = stars.count;
  const out = new Float32Array(n * 3);

  // radius per reality from its population
  const counts = stars.meta.realities.map((r) => r.count);
  const radii = counts.map((c) => 10 + Math.cbrt(c) * 4.6);

  for (let i = 0; i < n; i++) {
    const rid = Math.min(stars.realityId[i], CENTERS.length - 1);
    const [cx, cy, cz] = CENTERS[rid];
    const r = radii[rid] ?? 14;

    out[i * 3] = cx + gauss(i, 41) * r;
    out[i * 3 + 1] = cy + gauss(i, 47) * r * 0.55; // lensed ellipsoids, not balls
    out[i * 3 + 2] = cz + gauss(i, 53) * r;
  }
  return out;
}
