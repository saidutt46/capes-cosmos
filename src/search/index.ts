/** Pure ranked search over the survey's names. Linear scan (23k rows is <2ms);
 * ranking tiers, fame (appearances) as the tiebreak so icons surface first. */
import { NA_APPEARANCES } from '../data/parser';

export interface SearchRow { index: number; lname: string; desig: string; }
export interface SearchIndex { rows: SearchRow[]; }
export interface Result { index: number; score: number; }

export function designationOf(index: number): string {
  return `PS-${String(index + 1).padStart(5, '0')}`;
}

export function buildIndex(names: string[]): SearchIndex {
  return {
    rows: names.map((n, index) => ({
      index,
      lname: n.toLowerCase(),
      desig: designationOf(index).toLowerCase(),
    })),
  };
}

// tier scores; higher = better. fame added as a sub-1 fraction for tiebreak.
const EXACT = 600, PREFIX = 500, WORD = 400, SUB = 300, SUBSEQ = 200;

function subseq(hay: string, needle: string): boolean {
  let j = 0;
  for (let i = 0; i < hay.length && j < needle.length; i++) {
    if (hay[i] === needle[j]) j++;
  }
  return j === needle.length;
}

function scoreRow(row: SearchRow, q: string): number {
  const { lname, desig } = row;
  if (lname === q || desig === q) return EXACT;
  if (lname.startsWith(q) || desig.startsWith(q)) return PREFIX;
  // word-start: any token in the name begins with q
  if (lname.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) return WORD;
  if (lname.includes(q) || desig.includes(q)) return SUB;
  if (subseq(lname, q)) return SUBSEQ;
  return 0;
}

export function query(
  index: SearchIndex,
  q: string,
  appearances: Uint16Array,
  limit = 8,
): Result[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const hits: Result[] = [];
  for (const row of index.rows) {
    const tier = scoreRow(row, needle);
    if (!tier) continue;
    const app = appearances[row.index];
    const fame = app === NA_APPEARANCES ? 0 : Math.log1p(app) / 20; // < 1, tiebreak only
    hits.push({ index: row.index, score: tier + fame });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
