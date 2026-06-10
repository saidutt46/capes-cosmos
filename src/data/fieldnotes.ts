/** Field-notes content — the survey's voice when you SWEEP the void.
 * Annotations are keyed on the local census, so position always means
 * something: position IS data in every layout.
 */

export interface SweepCensus {
  count: number;
  marvelPct: number; // 0-100
  medianYear: number; // 0 if unknown-dominated
  brightestIndex: number; // -1 if none
  brightestApp: number;
}

const ERA_NOTES: [number, number, string][] = [
  [1935, 1949, 'The Golden Age. The first printed souls — most never aged, many never died.'],
  [1950, 1959, 'Anomalously sparse. The Comics Code Authority, est. 1954. The quietest region of the printed sky.'],
  [1960, 1969, 'The Silver Age. The Marvel arm ignites here — 1962 alone seeded a dynasty.'],
  [1970, 1979, 'The Bronze Age. The sky darkens; the stories grow teeth.'],
  [1980, 1987, 'The Dark Age opens. Watchmen-era physics: heroes start to fall.'],
  [1988, 1996, 'STARBURST EPOCH. The speculation boom — 1993 minted 763 souls in a single year. Then the crash.'],
  [1997, 2004, 'Post-crash recovery. A thinner, stranger sky.'],
  [2005, 2013, 'The modern shell. The survey’s outer rim — history is still cooling here.'],
];

export function annotate(c: SweepCensus): string {
  if (c.count === 0) {
    return 'You are between universes. Nothing was ever printed here.';
  }
  if (c.count < 8) {
    return `${c.count} faint objects. The thin edge of the printed sky — almost nothing survives out here.`;
  }
  const era = ERA_NOTES.find(([a, b]) => c.medianYear >= a && c.medianYear <= b);
  if (era) return era[2];
  return 'Dense field. The survey records no anomalies — only lives.';
}

export function censusLine(c: SweepCensus): string {
  if (c.count === 0) return 'SWEEP COMPLETE — 0 OBJECTS';
  const dcPct = 100 - c.marvelPct;
  const sector =
    c.medianYear > 0 ? ` · SECTOR ~${c.medianYear}` : '';
  return `SWEEP COMPLETE — ${c.count.toLocaleString()} OBJECTS · ${c.marvelPct.toFixed(0)}% M / ${dcPct.toFixed(0)}% DC${sector}`;
}
