/** FLIGHT HUD — in-flight instrument chrome. Subscribes to FlightMode.events:
 * telemetry (speed/boost/nearest), beacon (typed log entries), complete (banner).
 * Top-left: vessel · map + BEACONS n/20 · bottom-center speed · right proximity
 * card · bottom-left 4-line FLIGHT LOG · hints line.
 */
import { useEffect, useState } from 'react';
import type { FlightMode, FlightEventMap } from '../flight';
import type { LayoutName } from '../../scene/field';
import type { StarFields } from '../../data/parser';
import { SHIPS, type ShipId } from '../ships';
import './flight.css';

const MAP_LABEL: Record<LayoutName, string> = {
  spiral: 'GALAXY SPIRAL',
  shells: 'EXPANDING UNIVERSE',
  tunnel: 'TIME TUNNEL',
  constellations: 'CONSTELLATIONS',
};

const CLASS_LABEL: Record<string, string> = {
  star: 'STAR',
  planet: 'PLANET',
  moon: 'MOON',
  dust: 'DUST',
};

function designationOf(index: number): string {
  return `PS-${String(index + 1).padStart(5, '0')}`;
}

function shortName(names: string[] | null, index: number): string {
  return (names?.[index] ?? designationOf(index)).split(' (')[0];
}

type Telemetry = FlightEventMap['telemetry'];
interface LogEntry { key: number; index: number; dist: number; count: number }

interface FlightHudProps {
  flight: FlightMode;
  ship: ShipId;
  map: LayoutName;
  stars: StarFields;
  names: string[] | null;
}

export function FlightHud({ flight, ship, map, stars, names }: FlightHudProps) {
  const [tel, setTel] = useState<Telemetry>({ speed: 0, boost: false, nearest: null });
  const [log, setLog] = useState<LogEntry[]>([]);
  const [beacons, setBeacons] = useState(0);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const ev = flight.events;
    let k = 0;
    const onTel = (e: Event) => setTel((e as CustomEvent).detail as Telemetry);
    const onBeacon = (e: Event) => {
      const d = (e as CustomEvent).detail as FlightEventMap['beacon'];
      setBeacons(d.count);
      setLog((prev) => [{ key: k++, index: d.index, dist: d.dist, count: d.count }, ...prev].slice(0, 4));
    };
    const onComplete = () => setComplete(true);
    ev.addEventListener('telemetry', onTel);
    ev.addEventListener('beacon', onBeacon);
    ev.addEventListener('complete', onComplete);
    return () => {
      ev.removeEventListener('telemetry', onTel);
      ev.removeEventListener('beacon', onBeacon);
      ev.removeEventListener('complete', onComplete);
    };
  }, [flight]);

  const spec = SHIPS[ship];
  const n = tel.nearest;

  return (
    <div className="flight-hud" data-testid="flight-hud">
      <div className="flight-topbar">
        <span className="wordmark">PAPER SKY<span className="cursor">_</span></span>
      </div>

      <div className="fh-hints">
        <b>ARROWS</b> STEER · <b>SPACE</b> BOOST · <b>B</b> BRAKE · <b>ESC</b> HANGAR
      </div>

      {/* top-left: vessel + map + beacon count */}
      <div className="fh-corner fh-tl">
        <div className="fh-vessel">{spec.name} <span className="fh-map">· {MAP_LABEL[map]}</span></div>
        <div className="fh-beacons" data-testid="flight-beacons">
          {beacons}<span>/20 BEACONS</span>
        </div>
      </div>

      {/* bottom-center: speed */}
      <div className="fh-speed">
        <span className="fh-speed-val" data-testid="flight-speed">{tel.speed.toFixed(1)}</span>{' '}
        <span className="fh-speed-unit">u/s</span>
        {tel.boost && <span className="fh-boost">BOOST</span>}
      </div>

      {/* right: proximity card */}
      <aside className="fh-prox" data-testid="flight-prox">
        <div className="fh-prox-label">NEAREST BODY</div>
        {n ? (
          <>
            <div className="fh-prox-name">{shortName(names, n.index)}</div>
            <div className="fh-prox-desig">{designationOf(n.index)} · {CLASS_LABEL[n.cls]}</div>
            <div className="fh-prox-row"><span>RANGE</span><b>{n.dist.toFixed(1)}u</b></div>
            <div className="fh-prox-row fh-prox-pull"><span>PULL</span><b>{n.pull.toFixed(2)}g</b></div>
            <div className="fh-prox-row"><span>UNIVERSE</span><b>{stars.universe[n.index] === 0 ? 'MARVEL' : 'DC'}</b></div>
          </>
        ) : (
          <div className="fh-prox-empty">— open space —</div>
        )}
      </aside>

      {/* bottom-left: flight log */}
      <div className="fh-log" data-testid="flight-log">
        <div className="fh-log-title">FLIGHT LOG</div>
        {log.length === 0 && <div className="fh-log-line">AWAITING FIRST BEACON…</div>}
        {log.map((l, i) => (
          <div key={l.key} className={`fh-log-line${i === 0 ? ' new' : ''}`}>
            <span className="lc">BEACON</span> · {shortName(names, l.index).toUpperCase()} · CLOSEST APPROACH {l.dist.toFixed(1)}u
          </div>
        ))}
      </div>

      {complete && (
        <div className="fh-complete" data-testid="flight-complete">
          <div className="fh-complete-inner">
            <div className="fh-complete-title">SURVEY COMPLETE</div>
            <div className="fh-complete-sub">ALL 20 BEACONS LOGGED · ESC TO RETURN</div>
          </div>
        </div>
      )}
    </div>
  );
}
