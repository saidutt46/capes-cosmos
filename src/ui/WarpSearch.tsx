/** WARP SEARCH — ⌘K command palette. Finds any character by name or
 * designation and warps the camera to it. Pure presentation over the search
 * index; the actual fly is StarField.warpTo via the onWarp callback. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StarFields } from '../data/parser';
import { NA_APPEARANCES, NA_YEAR } from '../data/parser';
import { buildIndex, query, designationOf } from '../search';
import './warp.css';

interface WarpSearchProps {
  stars: StarFields;
  names: string[];
  onWarp: (index: number) => void;
  onClose: () => void;
}

export function WarpSearch({ stars, names, onWarp, onClose }: WarpSearchProps) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const index = useMemo(() => buildIndex(names), [names]);
  const results = useMemo(
    () => query(index, q, stars.appearances, 8),
    [index, q, stars.appearances],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setActive(0);
  }, [q]);

  const warp = (i: number) => {
    onWarp(i);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault();
      setActive((a) => (results.length ? (a + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault();
      setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      warp(results[active].index);
    }
  };

  const short = (n: string) => n.split(' (')[0];
  const mark = (n: string) => {
    const needle = q.trim().toLowerCase();
    const base = short(n);
    const at = needle ? base.toLowerCase().indexOf(needle) : -1;
    if (at < 0) return base;
    return (
      <>
        {base.slice(0, at)}
        <mark>{base.slice(at, at + needle.length)}</mark>
        {base.slice(at + needle.length)}
      </>
    );
  };

  return (
    <div className="warp-scrim" data-testid="warp" onPointerDown={onClose}>
      <div className="warp-panel" onPointerDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="warp-input"
          data-testid="warp-input"
          placeholder="SEARCH THE SURVEY"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
        />
        <div className="warp-head">
          {q.trim()
            ? `${results.length} SIGNAL${results.length === 1 ? '' : 'S'} MATCH "${q.trim()}"`
            : 'TYPE A NAME OR DESIGNATION · ↵ TO FLY'}
        </div>
        <ul className="warp-results">
          {results.map((r, k) => {
            const app = stars.appearances[r.index];
            const yr = stars.year[r.index];
            const uni = stars.universe[r.index] === 0 ? 'marvel' : 'dc';
            return (
              <li
                key={r.index}
                className={`warp-row${k === active ? ' active' : ''}`}
                data-testid="warp-result"
                onPointerEnter={() => setActive(k)}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  warp(r.index);
                }}
              >
                <span className={`warp-dot ${uni}`} />
                <span className="warp-name">{mark(names[r.index] ?? '')}</span>
                <span className="warp-desig">{designationOf(r.index)}</span>
                <span className="warp-stat">
                  {yr === NA_YEAR ? '—' : yr} ·{' '}
                  {app === NA_APPEARANCES ? '—' : `${app.toLocaleString()} obs`}
                </span>
                {k === active && <span className="warp-fly">↵ FLY</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
