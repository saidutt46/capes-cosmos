import { describe, expect, it } from 'vitest';
import { twinOf, TWIN_WEIGHTS } from './twins';

// 0,1 = Marvel; 2,3 = DC. (universe: 0 Marvel, 1 DC)
const stars = {
  universe: Uint8Array.from([0, 0, 1, 1]),
  year: Uint16Array.from([1962, 1939, 1939, 2005]),
  align: Uint8Array.from([0, 0, 0, 2]),
  alive: Uint8Array.from([0, 0, 0, 1]),
  appearances: Uint16Array.from([4000, 100, 90, 5]),
  count: 4,
};
const pct = (i: number) => [99, 50, 49, 5][i];

describe('twinOf', () => {
  it('returns an opposite-universe character', () => {
    const t = twinOf(1, stars, pct)!;
    expect([2, 3]).toContain(t.index);
  });
  it('prefers the closest match (1939 good ↔ 1939 good)', () => {
    expect(twinOf(1, stars, pct)!.index).toBe(2);
  });
  it('separation is normalized 0..1', () => {
    const t = twinOf(1, stars, pct)!;
    expect(t.separation).toBeGreaterThanOrEqual(0);
    expect(t.separation).toBeLessThanOrEqual(1);
  });
  it('is deterministic', () => {
    expect(twinOf(0, stars, pct)).toEqual(twinOf(0, stars, pct));
  });
  it('weights are sane defaults', () => {
    expect(TWIN_WEIGHTS.pct).toBeGreaterThan(0);
  });
});
