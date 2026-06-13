import { describe, expect, it } from 'vitest';
import { buildIndex, query, designationOf } from './index';

const names = [
  'Spider-Man (Peter Parker)', // 0
  'Batman (Bruce Wayne)',      // 1
  'Batwoman (Kate Kane)',      // 2
  'Spider-Woman (Jessica Drew)', // 3
  'Manhunter',                 // 4
];
const apps = Uint16Array.from([4043, 4000, 50, 200, 5]);
const idx = buildIndex(names);

describe('search', () => {
  it('designationOf is 1-based zero-padded', () => {
    expect(designationOf(0)).toBe('PS-00001');
    expect(designationOf(41)).toBe('PS-00042');
  });
  it('empty / whitespace query returns nothing', () => {
    expect(query(idx, '', apps)).toEqual([]);
    expect(query(idx, '   ', apps)).toEqual([]);
  });
  it('prefix beats substring; fame breaks ties', () => {
    const r = query(idx, 'bat', apps).map((x) => x.index);
    expect(r[0]).toBe(1); // Batman (prefix, famous) before Batwoman
    expect(r).toContain(2);
  });
  it('matches the designation', () => {
    expect(query(idx, 'PS-00002', apps)[0].index).toBe(1);
  });
  it('matches inside the reality suffix (full name searchable)', () => {
    expect(query(idx, 'parker', apps)[0].index).toBe(0);
  });
  it('respects the limit', () => {
    expect(query(idx, 'man', apps, 2).length).toBeLessThanOrEqual(2);
  });
});
