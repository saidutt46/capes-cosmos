import { describe, expect, it } from 'vitest';
import { classify, gravityPull } from './bodies';

// NA_APPEARANCES = 65535 (from parser)
const NA_APP = 65535;

describe('classify()', () => {
  it('returns dust for NA appearances', () => {
    const b = classify(NA_APP, 0, 0);
    expect(b.cls).toBe('dust');
    expect(b.scale).toBe(0);
  });

  it('returns dust for app === 0', () => {
    const b = classify(0, 0, 0);
    expect(b.cls).toBe('dust');
  });

  it('returns dust for app === 1', () => {
    const b = classify(1, 0, 0);
    expect(b.cls).toBe('dust');
  });

  it('returns moon for app in 2–99', () => {
    const lo = classify(2, 0, 0);
    expect(lo.cls).toBe('moon');
    expect(lo.scale).toBeGreaterThanOrEqual(0.4);
    expect(lo.scale).toBeLessThanOrEqual(1.2);

    const hi = classify(99, 0, 0);
    expect(hi.cls).toBe('moon');
    expect(hi.scale).toBeGreaterThanOrEqual(0.4);
    expect(hi.scale).toBeCloseTo(1.2, 4); // top of moon range (~1.2u at app 99)
  });

  it('returns planet for app in 100–1199', () => {
    const b = classify(500, 0, 0);
    expect(b.cls).toBe('planet');
    expect(b.scale).toBeGreaterThanOrEqual(1.2);
    expect(b.scale).toBeLessThanOrEqual(3);
  });

  it('returns star for app >= 1200', () => {
    const b = classify(1200, 0, 0);
    expect(b.cls).toBe('star');
    expect(b.scale).toBeGreaterThanOrEqual(3);
    expect(b.scale).toBeLessThanOrEqual(8);
  });

  it('ringed=true only when planet and align===2', () => {
    expect(classify(500, 2, 0).ringed).toBe(true);
    expect(classify(500, 0, 0).ringed).toBe(false);
    expect(classify(500, 1, 0).ringed).toBe(false);
    // stars and moons are never ringed
    expect(classify(1500, 2, 0).ringed).toBe(false);
    expect(classify(50, 2, 0).ringed).toBe(false);
  });

  it('ember=true when alive===1 (deceased)', () => {
    expect(classify(500, 0, 1).ember).toBe(true);
    expect(classify(500, 0, 0).ember).toBe(false);
  });

  it('deceased star is a dwarf: smaller scale than living star', () => {
    const living = classify(4000, 0, 0);
    const deceased = classify(4000, 0, 1);
    expect(deceased.cls).toBe('star');
    expect(deceased.ember).toBe(true);
    expect(deceased.scale).toBeLessThan(living.scale);
    // dwarf = ×0.6
    expect(deceased.scale).toBeCloseTo(living.scale * 0.6, 5);
  });

  it('star scale grows with appearances (log scale)', () => {
    const small = classify(1200, 0, 0);
    const large = classify(4000, 0, 0);
    expect(large.scale).toBeGreaterThan(small.scale);
  });
});

describe('gravityPull()', () => {
  const s = 2; // reference scale
  const influence = s * 12; // 24u

  it('is positive within influence radius', () => {
    expect(gravityPull(5, s)).toBeGreaterThan(0);
    expect(gravityPull(1, s)).toBeGreaterThan(0);
  });

  it('is finite at dist === 0', () => {
    const v = gravityPull(0, s);
    expect(isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(0);
  });

  it('is exactly 0 at influence radius', () => {
    expect(gravityPull(influence, s)).toBe(0);
  });

  it('is exactly 0 beyond influence radius', () => {
    expect(gravityPull(influence + 1, s)).toBe(0);
    expect(gravityPull(influence * 2, s)).toBe(0);
  });

  it('is monotonically decreasing: pull(5,s) > pull(10,s)', () => {
    expect(gravityPull(5, s)).toBeGreaterThan(gravityPull(10, s));
  });

  it('is monotonically decreasing across more distances', () => {
    const dists = [0.5, 1, 2, 4, 8, 12, 16, 20];
    const pulls = dists.map((d) => gravityPull(d, s));
    for (let i = 0; i < pulls.length - 1; i++) {
      expect(pulls[i]).toBeGreaterThan(pulls[i + 1]);
    }
  });

  it('scales with body scale (larger body pulls harder)', () => {
    expect(gravityPull(5, 4)).toBeGreaterThan(gravityPull(5, 2));
  });
});
