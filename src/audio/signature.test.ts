import { describe, expect, it } from 'vitest';
import { signatureOf, type SignatureFields } from './signature';

/** tiny synthetic survey — index 0: 1962 Good living bright;
 * 1: 2013 Bad deceased faint; 2: unknown-year unrecorded. */
const fields: SignatureFields = {
  year: Uint16Array.from([1962, 2013, 0]),
  appearances: Uint16Array.from([4043, 2, 65535]),
  align: Uint8Array.from([0, 2, 255]),
  alive: Uint8Array.from([0, 1, 255]),
};

describe('signatureOf', () => {
  it('is deterministic', () => {
    expect(signatureOf(0, fields)).toEqual(signatureOf(0, fields));
  });

  it('honors range contracts', () => {
    for (const i of [0, 1, 2]) {
      const s = signatureOf(i, fields);
      expect(s.pattern).toHaveLength(8);
      expect(s.pattern.some((g) => g === 1)).toBe(true);
      expect(s.period).toBeGreaterThanOrEqual(0.7);
      expect(s.period).toBeLessThanOrEqual(2.2);
      expect(s.freq).toBeGreaterThanOrEqual(110);
      expect(s.freq).toBeLessThan(880);
      expect(s.decay).toBeGreaterThanOrEqual(0.08);
      expect(s.decay).toBeLessThanOrEqual(0.9);
    }
  });

  it('maps year to register: 2013 rings higher than 1962', () => {
    expect(signatureOf(1, fields).freq).toBeGreaterThan(signatureOf(0, fields).freq);
  });

  it('maps alignment to timbre and fate to echo', () => {
    expect(signatureOf(0, fields).timbre).toBe('sine'); // Good
    expect(signatureOf(1, fields).timbre).toBe('saw'); // Bad
    expect(signatureOf(2, fields).timbre).toBe('triangle'); // unrecorded
    expect(signatureOf(0, fields).echo).toBe(false);
    expect(signatureOf(1, fields).echo).toBe(true); // the dead broadcast in repeats
  });
});
