/** HANGAR — the pre-flight overlay. Pick a MAP (one of the four skies) and a
 * VESSEL (DART / ATLAS / MOTH, with THRUST/MASS/TURN stat bars), then LAUNCH.
 * ESC or CLOSE returns to the survey. Observatory chrome; coral selection.
 */
import { useEffect } from 'react';
import type { LayoutName } from '../../scene/field';
import { SHIPS, type ShipId } from '../ships';
import './flight.css';

const MAPS: { id: LayoutName; label: string; note: string }[] = [
  { id: 'spiral', label: 'GALAXY SPIRAL', note: 'Above the 1935 core; fall down the winding arms.' },
  { id: 'shells', label: 'EXPANDING UNIVERSE', note: 'Out on the rim; fly into the expanding shells.' },
  { id: 'tunnel', label: 'TIME TUNNEL', note: 'A corridor; fly the decades from 1935 to 2013.' },
  { id: 'constellations', label: 'CONSTELLATIONS', note: "Off Earth-616's cluster; thread the realities." },
];

const SHIP_ORDER: ShipId[] = ['dart', 'atlas', 'moth'];

// 5-segment bars; values mapped from the spec stat ranges
function segs(value: number, max: number): number {
  return Math.max(1, Math.min(5, Math.round((value / max) * 5)));
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const on = segs(value, max);
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-bar">
        {Array.from({ length: 5 }, (_, k) => (
          <span key={k} className={`stat-seg${k < on ? ' on' : ''}`} />
        ))}
      </span>
    </div>
  );
}

interface HangarProps {
  map: LayoutName;
  ship: ShipId;
  onMap: (m: LayoutName) => void;
  onShip: (s: ShipId) => void;
  onLaunch: () => void;
  onClose: () => void;
}

export function Hangar({ map, ship, onMap, onShip, onLaunch, onClose }: HangarProps) {
  // ESC closes the hangar (flight owns ESC only while flying)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="flight-topbar">
        <span className="wordmark">PAPER SKY<span className="cursor">_</span></span>
      </div>

      <div className="hangar" data-testid="hangar">
        <div className="hangar-panel">
          <div className="hangar-head">
            <span className="hangar-title">HANGAR</span>
            <span className="hangar-sub">PRE-FLIGHT · CHOOSE MAP + VESSEL</span>
          </div>

          <div className="hangar-cols">
            <div>
              <div className="hangar-coltitle">MAP</div>
              <div className="map-list">
                {MAPS.map((m) => (
                  <button
                    key={m.id}
                    className={`map-row${m.id === map ? ' sel' : ''}`}
                    data-testid={`hangar-map-${m.id}`}
                    onClick={() => onMap(m.id)}
                  >
                    <span className="map-name">{m.label}</span>
                    <span className="map-note">{m.note}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="hangar-coltitle">VESSEL</div>
              <div className="vessel-list">
                {SHIP_ORDER.map((id) => {
                  const s = SHIPS[id];
                  const sel = id === ship;
                  return (
                    <button
                      key={id}
                      className={`vessel-row${sel ? ' sel' : ''}`}
                      data-testid={`hangar-ship-${id}`}
                      onClick={() => onShip(id)}
                    >
                      <div className="vessel-name">{s.name}</div>
                      <div className="vessel-blurb">{s.blurb}</div>
                      <StatBar label="THRUST" value={s.thrust} max={1.5} />
                      <StatBar label="MASS" value={s.mass} max={1.6} />
                      <StatBar label="TURN" value={s.turn} max={1.6} />
                      {s.sensor > 1 && (
                        <div className="stat-extra">SENSOR RANGE ×{s.sensor.toFixed(1)}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="hangar-foot">
            <button
              className="launch-btn"
              data-testid="launch"
              onClick={onLaunch}
            >
              LAUNCH ▸
            </button>
            <span className="hangar-hint">ARROWS STEER · SPACE BOOST · B BRAKE · ESC HANGAR</span>
            <button className="hangar-close" data-testid="hangar-close" onClick={onClose}>
              CLOSE · ESC
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
