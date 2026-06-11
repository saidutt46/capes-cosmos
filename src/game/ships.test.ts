import { describe, expect, it } from 'vitest';
import { SHIPS, type ShipId } from './ships';

const IDS: ShipId[] = ['dart', 'atlas', 'moth'];

describe('SHIPS table', () => {
  it('contains exactly 3 ships', () => {
    expect(Object.keys(SHIPS)).toHaveLength(3);
  });

  it('has atlas sensor === 1.6', () => {
    expect(SHIPS.atlas.sensor).toBe(1.6);
  });

  it('has all positive stats on every ship', () => {
    for (const id of IDS) {
      const s = SHIPS[id];
      expect(s.thrust).toBeGreaterThan(0);
      expect(s.mass).toBeGreaterThan(0);
      expect(s.turn).toBeGreaterThan(0);
      expect(s.damping).toBeGreaterThan(0);
      expect(s.damping).toBeLessThanOrEqual(1);
      expect(s.maxSpeed).toBeGreaterThan(0);
      expect(s.sensor).toBeGreaterThan(0);
    }
  });

  it('has spec-exact thrust/mass/turn', () => {
    expect(SHIPS.dart.thrust).toBe(1.5);
    expect(SHIPS.dart.mass).toBe(0.7);
    expect(SHIPS.dart.turn).toBe(1.3);

    expect(SHIPS.atlas.thrust).toBe(0.9);
    expect(SHIPS.atlas.mass).toBe(1.6);
    expect(SHIPS.atlas.turn).toBe(0.7);

    expect(SHIPS.moth.thrust).toBe(1.1);
    expect(SHIPS.moth.mass).toBe(0.5);
    expect(SHIPS.moth.turn).toBe(1.6);
  });

  it('moth has the lowest damping (most drifty)', () => {
    expect(SHIPS.moth.damping).toBeLessThan(SHIPS.dart.damping);
    expect(SHIPS.moth.damping).toBeLessThan(SHIPS.atlas.damping);
  });

  it('dart and moth have sensor === 1.0', () => {
    expect(SHIPS.dart.sensor).toBe(1.0);
    expect(SHIPS.moth.sensor).toBe(1.0);
  });

  it('ids match keys', () => {
    for (const id of IDS) {
      expect(SHIPS[id].id).toBe(id);
    }
  });
});
