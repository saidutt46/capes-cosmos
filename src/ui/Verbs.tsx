/** Chrome for the four verbs — tooltip (hover), ping + field notes (sweep),
 * expose counter, and the dossier (lock) with its star-anchored ring gauges.
 * All subscribe to StarField.events; nothing here owns 3D state.
 */
import { useEffect, useRef, useState } from 'react';
import type { StarField, LockInfo } from '../scene/field';
import type { StarFields } from '../data/parser';
import { NA_APPEARANCES, NA_U8, NA_YEAR } from '../data/parser';
import { annotate, censusLine, type SweepCensus } from '../data/fieldnotes';
import { signatureOf } from '../audio/signature';
import './verbs.css';

const MAX_APP = 4043;

export function designationOf(index: number): string {
  return `PS-${String(index + 1).padStart(5, '0')}`;
}

interface VerbsProps {
  field: StarField;
  stars: StarFields;
  names: string[] | null;
  onLockChange: (index: number) => void;
  radio: boolean;
}

interface HoverEvt {
  index: number;
  x: number;
  y: number;
  px: number;
}

interface SweepEvt {
  census: SweepCensus;
  x: number;
  y: number;
}

export function Verbs({ field, stars, names, onLockChange, radio }: VerbsProps) {
  const [hover, setHover] = useState<HoverEvt | null>(null);
  const [sweep, setSweep] = useState<SweepEvt | null>(null);
  const [lock, setLock] = useState<LockInfo | null>(null);
  const [expose, setExpose] = useState<{ active: boolean; seconds: number } | null>(null);
  const faintCount = useRef(0);

  useEffect(() => {
    let f = 0;
    for (let i = 0; i < stars.count; i++) {
      const a = stars.appearances[i];
      if (a === NA_APPEARANCES || a <= 1) f++;
    }
    faintCount.current = f;
  }, [stars]);

  useEffect(() => {
    const ev = field.events;
    const onHover = (e: Event) => setHover((e as CustomEvent).detail as HoverEvt | null);
    const onSweep = (e: Event) => {
      const d = (e as CustomEvent).detail as SweepEvt;
      setSweep(d);
      window.setTimeout(() => setSweep((s) => (s === d ? null : s)), 8000);
    };
    const onLock = (e: Event) => {
      const d = (e as CustomEvent).detail as LockInfo;
      setLock(d);
      setHover(null);
      setSweep(null);
      onLockChange(d.index);
    };
    const onRelease = () => {
      setLock(null);
      onLockChange(-1);
    };
    const onExpose = (e: Event) =>
      setExpose((e as CustomEvent).detail as { active: boolean; seconds: number });

    ev.addEventListener('hover', onHover);
    ev.addEventListener('sweep', onSweep);
    ev.addEventListener('lock', onLock);
    ev.addEventListener('release', onRelease);
    ev.addEventListener('expose', onExpose);
    return () => {
      ev.removeEventListener('hover', onHover);
      ev.removeEventListener('sweep', onSweep);
      ev.removeEventListener('lock', onLock);
      ev.removeEventListener('release', onRelease);
      ev.removeEventListener('expose', onExpose);
    };
  }, [field, onLockChange]);

  return (
    <>
      {hover && !lock && names && (
        <div
          className="tooltip"
          data-testid="tooltip"
          style={{ left: hover.x, top: hover.y }}
        >
          <span className="dim">{designationOf(hover.index)}</span>{' '}
          {names[hover.index]?.split(' (')[0] ?? ''}
        </div>
      )}

      {sweep && (
        <div className="ping" style={{ left: sweep.x, top: sweep.y }} key={`${sweep.x}-${sweep.y}`} />
      )}

      {sweep && (
        <aside className="fieldnotes" data-testid="fieldnotes">
          <div className="line1">{censusLine(sweep.census)}</div>
          <div className="line2">{annotate(sweep.census)}</div>
          {sweep.census.brightestIndex >= 0 && names && (
            <div className="line3">
              BRIGHTEST OBJECT IN RADIUS · {designationOf(sweep.census.brightestIndex)}{' '}
              {names[sweep.census.brightestIndex]?.split(' (')[0]} ·{' '}
              {sweep.census.brightestApp.toLocaleString()} obs
            </div>
          )}
        </aside>
      )}

      {expose?.active && (
        <div className="expose-counter" data-testid="expose-counter">
          EXPOSURE {expose.seconds.toFixed(1)}s ·{' '}
          <span className="n">
            {Math.floor(
              faintCount.current * Math.min(1, expose.seconds / 2.4),
            ).toLocaleString()}
          </span>{' '}
          FAINT OBJECTS EMERGING
        </div>
      )}

      {lock && names && (
        <Dossier field={field} stars={stars} names={names} lock={lock} radio={radio} />
      )}
    </>
  );
}

// ---------- the dossier ----------

function decode(categories: string[], code: number): string {
  return code === NA_U8 ? 'Unrecorded' : (categories[code] ?? 'Unrecorded');
}

function Dossier({
  field,
  stars,
  names,
  lock,
  radio,
}: {
  field: StarField;
  stars: StarFields;
  names: string[];
  lock: LockInfo;
  radio: boolean;
}) {
  const i = lock.index;
  const gaugeRef = useRef<HTMLDivElement>(null);
  const [anchorPx, setAnchorPx] = useState(40);

  // imperative anchor tracking — no React re-render per frame
  useEffect(() => {
    const onFrame = (e: Event) => {
      const d = (e as CustomEvent).detail as { x: number; y: number; px: number };
      const el = gaugeRef.current;
      if (!el) return;
      el.style.left = `${d.x}px`;
      el.style.top = `${d.y}px`;
      setAnchorPx((prev) => (Math.abs(prev - d.px) > 6 ? d.px : prev));
    };
    field.events.addEventListener('lockframe', onFrame);
    return () => field.events.removeEventListener('lockframe', onFrame);
  }, [field, i]);

  const cat = stars.meta.categories;
  const name = names[i] ?? '';
  const shortName = name.split(' (')[0];
  const deceased = stars.alive[i] === 1;
  const year = stars.year[i];
  const app = stars.appearances[i];
  const hasApp = app !== NA_APPEARANCES;
  const pct = field.percentileOf(i);
  const sig = radio ? signatureOf(i, stars) : null;
  // waveform: the 8-step gate pattern carried on two deterministic harmonics,
  // resampled across the full strip width
  const WAVE_BARS = 36;
  const wave = sig
    ? Array.from({ length: WAVE_BARS }, (_, k) => {
        const on = sig.pattern[Math.floor((k / WAVE_BARS) * 8)] === 1;
        const carrier = Math.sin((k / WAVE_BARS) * Math.PI * 6 + sig.freq * 0.05);
        const harmonic = Math.sin((k / WAVE_BARS) * Math.PI * 14 + sig.period * 5) * 0.35;
        const h = 0.18 + 0.32 * Math.abs(carrier + harmonic) + (on ? 0.5 : 0.08);
        return { h: Math.min(1, h), on };
      })
    : [];

  // cohort size: same debut year, same universe (the whole sky, not just lines)
  let cohortTotal = 0;
  if (year !== NA_YEAR) {
    for (let k = 0; k < stars.count; k++) {
      if (stars.year[k] === year && stars.universe[k] === stars.universe[i]) cohortTotal++;
    }
  }

  const arcR = 30;
  const arcLen = 2 * Math.PI * arcR;
  const frac = hasApp ? Math.log1p(app) / Math.log1p(MAX_APP) : 0;
  const yearAngle = year === NA_YEAR ? 0 : ((year - 1935) / (2013 - 1935)) * 360;
  const gaugeSize = Math.max(110, anchorPx * 2.4);

  return (
    <>
      <div
        ref={gaugeRef}
        className="gauges"
        style={{ width: gaugeSize, height: gaugeSize }}
      >
        <svg width={gaugeSize} height={gaugeSize} viewBox="-50 -50 100 100">
          {/* appearance arc against the full-sky maximum */}
          <circle className="arc-track" r={arcR} fill="none" strokeWidth="1.4" />
          <circle
            className="arc"
            r={arcR}
            fill="none"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray={arcLen}
            strokeDashoffset={arcLen * (1 - frac)}
            transform="rotate(-90)"
          />
          {/* time ring with debut tick */}
          <g className="spin">
            <circle className="year-ring" r={40} fill="none" strokeWidth="0.8" strokeDasharray="1 5" />
          </g>
          <line
            className="year-tick"
            x1="0" y1="-36" x2="0" y2="-44"
            strokeWidth="1.6"
            transform={`rotate(${yearAngle})`}
          />
        </svg>
      </div>

      <aside className={`dossier${deceased ? ' deceased' : ''}`} data-testid="dossier">
        <div className="dossier-plate">
          <div className="designation">{designationOf(i)} · TARGET LOCKED</div>
          <h2>{shortName}</h2>
          <dl>
            <dt>FULL DESIGNATION</dt>
            <dd>{name}</dd>
            <dt>UNIVERSE</dt>
            <dd>{decode(cat.universe, stars.universe[i])}</dd>
            <dt>REALITY</dt>
            <dd>{decode(cat.reality, stars.realityId[i])}</dd>
            <dt>SPECTRAL CLASS</dt>
            <dd>{decode(cat.align, stars.align[i])}</dd>
            <dt>IDENTITY</dt>
            <dd>{decode(cat.identity, stars.identity[i])}</dd>
            <dt>FIRST OBSERVED</dt>
            <dd>
              {year === NA_YEAR ? 'Unrecorded' : year}
              {cohortTotal > 1 && year !== NA_YEAR
                ? ` · alongside ${(cohortTotal - 1).toLocaleString()} others`
                : ''}
            </dd>
            <dt>STATUS</dt>
            <dd className="status-value">{decode(cat.alive, stars.alive[i])}</dd>
          </dl>
          <div className="lumen">
            LUMINOSITY{' '}
            <b>{hasApp ? `${app.toLocaleString()} observations` : 'below detection threshold'}</b>
            {hasApp && pct > 0 && (
              <>
                {', '}brighter than <b>{pct.toFixed(pct > 99 ? 3 : 1)}%</b> of the printed sky
              </>
            )}
          </div>
          {sig && (
            <div className="signal" data-testid="signal">
              <div className="signal-bits">
                {wave.map((b, k) => (
                  <span
                    key={k}
                    className={`bit${b.on ? ' on' : ''}`}
                    style={{
                      height: `${Math.round(b.h * 100)}%`,
                      animationDelay: `${(k * 0.07).toFixed(2)}s`,
                    }}
                  />
                ))}
                <span className="playhead" style={{ animationDuration: `${sig.period}s` }} />
              </div>
              <div className="signal-caption">
                PERIOD {sig.period.toFixed(2)}s · BAND {year === NA_YEAR ? 'UNKNOWN' : year} ·{' '}
                {sig.echo ? 'ECHOING' : 'LIVE'} SIGNAL
              </div>
            </div>
          )}
          <div className="hint">ESC OR CLICK THE VOID TO RELEASE · CLICK A COHORT STAR TO CHAIN</div>
        </div>
      </aside>
    </>
  );
}
