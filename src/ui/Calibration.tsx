/** First-light calibration — three typed lines that teach a first-time
 * visitor to read the chart. Shown once (localStorage), skipped by any input,
 * replayable from the KEY chip. pointer-events: none — never blocks the sky. */
import { useEffect, useRef, useState } from 'react';
import './calibration.css';

const LINES = [
  'EVERY LIGHT IS A CHARACTER — 23,272 PRINTED SOULS',
  'COLOR IS ALLEGIANCE · MARVEL RED · DC BLUE',
  'TIME WINDS OUTWARD — 1935 AT THE CORE, 2013 AT THE RIM',
];
export const CALIBRATED_FLAG = 'paper-sky:calibrated';
const TYPE_MS = 28;
const HOLD_MS = 1600;

export function Calibration({
  ignite,
  run,
  onDone,
}: {
  ignite: number;
  run: boolean;
  onDone: () => void;
}) {
  const [line, setLine] = useState(-1);
  const [chars, setChars] = useState(0);
  const reduced = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  ).current;
  const active = run && ignite >= 1;

  const finishRef = useRef(() => {});
  finishRef.current = () => {
    localStorage.setItem(CALIBRATED_FLAG, '1');
    setLine(LINES.length);
    onDone();
  };

  useEffect(() => {
    if (active) {
      setLine(0);
      setChars(0);
    }
  }, [active]);

  // typing driver: types the current line, holds, advances; finishes after last
  useEffect(() => {
    if (!active || line < 0 || line >= LINES.length) return;
    const advance = () => {
      if (line < LINES.length - 1) {
        setChars(0);
        setLine(line + 1);
      } else {
        finishRef.current();
      }
    };
    if (reduced) {
      setChars(LINES[line].length);
      const t = window.setTimeout(advance, 2600);
      return () => window.clearTimeout(t);
    }
    let n = 0;
    const typer = window.setInterval(() => {
      n++;
      setChars(n);
      if (n >= LINES[line].length) window.clearInterval(typer);
    }, TYPE_MS);
    const hold = window.setTimeout(advance, LINES[line].length * TYPE_MS + HOLD_MS);
    return () => {
      window.clearInterval(typer);
      window.clearTimeout(hold);
    };
  }, [active, line, reduced]);

  // any input skips permanently
  useEffect(() => {
    if (!active || line < 0 || line >= LINES.length) return;
    const skip = () => finishRef.current();
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    return () => {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, [active, line]);

  if (!active || line < 0 || line >= LINES.length) return null;
  return (
    <div className="calibration" data-testid="calibration">
      <span>{LINES[line].slice(0, chars)}</span>
      <span className="cal-caret">_</span>
    </div>
  );
}
