/** First-light calibration — three typed lines that teach a visitor to read
 * the chart. Plays on every launch (any input skips it for that visit);
 * replayable from the KEY chip. pointer-events: none — never blocks the sky.
 * QUIET_FLAG is a test-suite suppression, never set for real visitors. */
import { useEffect, useRef, useState } from 'react';
import { lineTick, typeTick } from '../audio/ticks';
import './calibration.css';

/** glyph noise shown ahead of the typing head — decode-transmission feel */
const GLYPHS = '▓▒░#%§Φ◊Ψ01∆';

const LINES = [
  'EVERY LIGHT IS A CHARACTER · 23,272 PRINTED SOULS',
  'COLOR IS ALLEGIANCE · MARVEL RED · DC BLUE',
  'TIME WINDS OUTWARD · 1935 AT THE CORE, 2013 AT THE RIM',
];
export const QUIET_FLAG = 'paper-sky:quiet';
const TYPE_MS = 52; // unhurried decode — each line takes ~2.4s to type
const HOLD_MS = 2800; // then breathes long enough to actually be read

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
      const t = window.setTimeout(advance, 3600);
      return () => window.clearTimeout(t);
    }
    let n = 0;
    const typer = window.setInterval(() => {
      n++;
      setChars(n);
      typeTick(n);
      if (n >= LINES[line].length) {
        window.clearInterval(typer);
        lineTick();
      }
    }, TYPE_MS);
    const hold = window.setTimeout(advance, LINES[line].length * TYPE_MS + HOLD_MS);
    return () => {
      window.clearInterval(typer);
      window.clearTimeout(hold);
    };
  }, [active, line, reduced]);

  // any input skips for this visit
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
  const decoding = chars > 0 && chars < LINES[line].length;
  return (
    <div className="calibration" data-testid="calibration">
      <span>{LINES[line].slice(0, chars)}</span>
      {decoding && (
        <span className="cal-scramble" aria-hidden="true">
          {GLYPHS[(chars * 7) % GLYPHS.length]}
          {GLYPHS[(chars * 13 + 5) % GLYPHS.length]}
        </span>
      )}
      <span className="cal-caret">_</span>
    </div>
  );
}
