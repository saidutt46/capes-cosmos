/** KEY — the permanent answer to "what am I looking at". Bottom-left chip,
 * unfolds the legend: color = allegiance, size = appearances, time = geometry
 * (per layout). RECALIBRATE replays first light. */
import { useEffect, useRef, useState } from 'react';
import type { LayoutName } from '../scene/field';

const TIME_ROW: Record<LayoutName, string> = {
  spiral: 'CORE 1935 → RIM 2013 · TIME WINDS OUTWARD',
  shells: 'INNER SHELL 1935 → OUTER RIM 2013',
  tunnel: 'DEPTH IS TIME — FLY FORWARD, 1935 → 2013',
  constellations: 'GROUPED BY REALITY — NOT BY TIME',
};

export function Key({
  layout,
  onRecalibrate,
}: {
  layout: LayoutName;
  onRecalibrate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!boxRef.current?.contains(t) && !t.closest('[data-testid^="dial-"]')) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="key" ref={boxRef}>
      <button
        className={`dial-btn key-btn${open ? ' active' : ''}`}
        data-testid="key-toggle"
        onClick={() => setOpen(!open)}
      >
        KEY
      </button>
      {open && (
        <div className="key-panel" data-testid="key-panel">
          <div className="key-row">
            <span className="swatch marvel" /> MARVEL
            <span className="swatch dc" /> DC
          </div>
          <div className="key-row">
            <span className="ramp">
              <i />
              <i />
              <i />
            </span>
            SIZE = APPEARANCES (PRINT LUMINOSITY)
          </div>
          <div className="key-row" data-testid="key-time">
            {TIME_ROW[layout]}
          </div>
          <button
            className="key-recal"
            data-testid="key-recalibrate"
            onClick={() => {
              setOpen(false);
              onRecalibrate();
            }}
          >
            RECALIBRATE ⟲
          </button>
        </div>
      )}
    </div>
  );
}
