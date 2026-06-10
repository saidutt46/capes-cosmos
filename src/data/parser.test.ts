import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStars, NA_YEAR, type SurveyMeta } from './parser';

// test against the REAL bundle shipped in public/data — the actual contract
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '../../public/data');
const meta = JSON.parse(readFileSync(resolve(dataDir, 'meta.json'), 'utf8')) as SurveyMeta;
const bin = readFileSync(resolve(dataDir, 'stars.bin'));
const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);

describe('parseStars', () => {
  const stars = parseStars(buf, meta);

  it('parses the full survey count', () => {
    expect(stars.count).toBe(23272);
    expect(stars.universe.length).toBe(23272);
    expect(stars.year.length).toBe(23272);
  });

  it('universe codes are only Marvel(0)/DC(1) and match known totals', () => {
    let marvel = 0,
      dc = 0;
    for (const u of stars.universe) {
      if (u === 0) marvel++;
      else if (u === 1) dc++;
      else throw new Error(`bad universe code ${u}`);
    }
    expect(marvel).toBe(16376);
    expect(dc).toBe(6896);
  });

  it('years are 0 (unknown) or within 1935-2013', () => {
    for (const y of stars.year) {
      if (y !== NA_YEAR) {
        expect(y).toBeGreaterThanOrEqual(1935);
        expect(y).toBeLessThanOrEqual(2013);
      }
    }
  });

  it('row 0 is Spider-Man: Marvel, 1962, 4043 appearances', () => {
    expect(stars.universe[0]).toBe(0);
    expect(stars.year[0]).toBe(1962);
    expect(stars.appearances[0]).toBe(4043);
  });

  it('rejects a truncated buffer', () => {
    expect(() => parseStars(buf.slice(0, 100), meta)).toThrow(/size mismatch/);
  });
});
