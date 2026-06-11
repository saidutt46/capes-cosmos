import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSurvey, type StarFields } from './data/parser';
import { StarField, type LayoutName, type Lens } from './scene/field';
import { Hud } from './ui/Hud';
import { Verbs, designationOf } from './ui/Verbs';
import { Calibration, QUIET_FLAG } from './ui/Calibration';
import { Key } from './ui/Key';
import { DesignPage } from './ui/DesignPage';
import { MethodologyPage } from './ui/MethodologyPage';
import { RadioBand } from './audio/radio';
import { signatureOf } from './audio/signature';
import { setSoundMuted, wakeSounds, launchSound } from './audio/ticks';
import { FlightMode } from './game/flight';
import type { ShipId } from './game/ships';
import { Hangar } from './game/hud/Hangar';
import { FlightHud } from './game/hud/FlightHud';

function parseDeepLink(): number {
  const m = window.location.pathname.match(/^\/star\/PS-(\d{1,5})$/);
  if (!m) return -1;
  const idx = parseInt(m[1], 10) - 1;
  return idx >= 0 && idx < 23272 ? idx : -1;
}

export default function App() {
  // two static pages; everything else is the survey (no router needed)
  if (window.location.pathname === '/design') return <DesignPage />;
  if (window.location.pathname === '/methodology') return <MethodologyPage />;
  return <Survey />;
}

function Survey() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<StarField | null>(null);
  const [field, setField] = useState<StarField | null>(null);
  const [stars, setStars] = useState<StarFields | null>(null);
  const [names, setNames] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutName>('spiral');
  const [showNames, setShowNames] = useState(true);
  const [lens, setLens] = useState<Lens>({ field: 'none', value: 0 });
  const [ignite, setIgnite] = useState(0);
  const igniteRef = useRef(0);
  const [calibRun, setCalibRun] = useState(() => !localStorage.getItem(QUIET_FLAG));
  const radioRef = useRef<RadioBand | null>(null);
  const [radio, setRadio] = useState(RadioBand.supported); // the band is on by default
  const [armed, setArmed] = useState(false); // flips at the first user gesture

  // FLIGHT game mode
  const [mode, setMode] = useState<'survey' | 'hangar' | 'flight'>('survey');
  const [flightShip, setFlightShip] = useState<ShipId>('atlas');
  const [flightMap, setFlightMap] = useState<LayoutName>('tunnel');
  const flightRef = useRef<FlightMode | null>(null);
  const [flight, setFlight] = useState<FlightMode | null>(null);
  const launchTimer = useRef(0);

  const onRadio = useCallback((on: boolean) => {
    if (on) {
      radioRef.current ??= new RadioBand();
      radioRef.current.enable();
    } else {
      radioRef.current?.disable();
    }
    setSoundMuted(!on); // RADIO doubles as the global mute (nav + typing ticks)
    if (fieldRef.current) {
      (fieldRef.current as unknown as { radioActive: boolean }).radioActive = on;
    }
    setRadio(on);
  }, []);

  // default-on: the AudioContext must be BORN inside a user gesture — one
  // created at mount starts suspended and some browsers never let it recover.
  // So the band arms itself at the first pointerdown/keydown, and re-resumes
  // on later gestures in case the browser re-suspends it.
  useEffect(() => {
    if (!radio) return undefined;
    const wake = () => {
      radioRef.current ??= new RadioBand();
      radioRef.current.enable();
      wakeSounds();
      setArmed(true);
    };
    if (navigator.userActivation?.hasBeenActive) wake(); // gesture already happened
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [radio]);

  useEffect(() => {
    let cancelled = false;

    loadSurvey()
      .then(async (s) => {
        if (cancelled || !canvasRef.current) return;
        setStars(s);
        const f = new StarField(canvasRef.current, s);
        fieldRef.current = f;
        (f as unknown as { radioActive: boolean }).radioActive = RadioBand.supported;
        setField(f);

        f.events.addEventListener('ignite', (e) => {
          const p = ((e as CustomEvent).detail as { progress: number }).progress;
          if (p - igniteRef.current > 0.02 || p === 1) {
            igniteRef.current = p;
            setIgnite(p);
          }
        });

        // Esc with no lock → clear any active lens (field can't reach React state)
        f.events.addEventListener('escape', () => {
          f.setLens({ field: 'none', value: 0 });
          setLens({ field: 'none', value: 0 });
        });

        const res = await fetch('/data/names.json');
        const data = (await res.json()) as { name: string[] };
        if (cancelled) return;
        f.labels.setNames(data.name);
        setNames(data.name);

        // deep link: /star/PS-00001 → fly + lock once the sky has ignited
        const deep = parseDeepLink();
        if (deep >= 0) window.setTimeout(() => f.lock(deep), 1200);
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      cancelled = true;
      window.clearTimeout(launchTimer.current);
      flightRef.current?.dispose();
      flightRef.current = null;
      radioRef.current?.dispose();
      fieldRef.current?.dispose();
      fieldRef.current = null;
    };
  }, []);

  const onLayout = useCallback((l: LayoutName) => {
    fieldRef.current?.setLayout(l);
    setLayout(l);
  }, []);

  const onNames = useCallback((on: boolean) => {
    fieldRef.current?.labels.setEnabled(on);
    setShowNames(on);
  }, []);

  const onLens = useCallback((l: Lens) => {
    fieldRef.current?.setLens(l);
    setLens(l);
  }, []);

  const onLockChange = useCallback((index: number) => {
    const path = index >= 0 ? `/star/${designationOf(index)}` : '/';
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
  }, []);

  // ---------- FLIGHT orchestration ----------

  const disposeFlight = useCallback(() => {
    flightRef.current?.dispose();
    flightRef.current = null;
    setFlight(null);
    delete (window as unknown as Record<string, unknown>).__paperSkyFlight;
  }, []);

  const onFlight = useCallback(() => setMode('hangar'), []);

  // LAUNCH: morph the field to the chosen map, then start flight at its checkpoint
  const onLaunch = useCallback(() => {
    const f = fieldRef.current;
    if (!f || !stars) return;
    f.setLayout(flightMap); // a no-op if already on that layout (mix already 1)
    launchSound();
    window.clearTimeout(launchTimer.current);
    // wait for the morph to settle, then construct flight + take over the scene
    const begin = () => {
      const ff = fieldRef.current;
      if (!ff || !stars) return;
      const fm = new FlightMode(ff, stars, names, flightMap, flightShip, radioRef.current ?? undefined);
      flightRef.current = fm;
      setFlight(fm);
      fm.events.addEventListener('exit', () => {
        disposeFlight();
        setMode('hangar');
      });
      (window as unknown as Record<string, unknown>).__paperSkyFlight = {
        speed: () => fm.speed,
        heading: () => fm.heading,
        beacons: () => fm.beacons,
      };
      setMode('flight');
    };
    // if the field is already on the target layout the morph won't run; start soon.
    launchTimer.current = window.setTimeout(begin, f.layout === flightMap ? 120 : 2300);
  }, [stars, names, flightMap, flightShip, disposeFlight]);

  const onHangarClose = useCallback(() => setMode('survey'), []);

  // radio: locked star broadcasts; sweeps answer as a chord
  // (`armed` re-runs this once the first gesture has built the band)
  useEffect(() => {
    const f = field;
    const r = radioRef.current;
    if (!f || !stars || !radio || !r) return;
    void armed;
    const onLock = (e: Event) => {
      const { index } = (e as CustomEvent).detail as { index: number };
      r.playSignature(signatureOf(index, stars));
    };
    const onRelease = () => r.stopSignature();
    const onSweep = (e: Event) => {
      const { census } = (e as CustomEvent).detail as { census: { topIndices: number[] } };
      r.playChord(census.topIndices.map((i) => signatureOf(i, stars).freq));
    };
    f.events.addEventListener('lock', onLock);
    f.events.addEventListener('release', onRelease);
    f.events.addEventListener('sweep', onSweep);
    if (f.locked >= 0) r.playSignature(signatureOf(f.locked, stars)); // radio enabled mid-lock
    return () => {
      f.events.removeEventListener('lock', onLock);
      f.events.removeEventListener('release', onRelease);
      f.events.removeEventListener('sweep', onSweep);
      r.stopSignature();
    };
  }, [field, stars, radio, armed]);

  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0 }} />

      {mode === 'survey' && (
        <>
          <Hud
            stars={stars}
            error={error}
            layout={layout}
            onLayout={onLayout}
            names={showNames}
            onNames={onNames}
            ignite={ignite}
            lens={lens}
            onLens={onLens}
            radio={radio}
            onRadio={onRadio}
            radioSupported={RadioBand.supported}
            onFlight={onFlight}
          />
          <Key layout={layout} onRecalibrate={() => setCalibRun(true)} />
          <Calibration ignite={ignite} run={calibRun} onDone={() => setCalibRun(false)} />
          {field && stars && (
            <Verbs field={field} stars={stars} names={names} onLockChange={onLockChange} radio={radio} />
          )}
        </>
      )}

      {mode === 'hangar' && (
        <Hangar
          map={flightMap}
          ship={flightShip}
          onMap={setFlightMap}
          onShip={setFlightShip}
          onLaunch={onLaunch}
          onClose={onHangarClose}
        />
      )}

      {mode === 'flight' && flight && stars && (
        <FlightHud flight={flight} ship={flightShip} map={flightMap} stars={stars} names={names} />
      )}
    </>
  );
}
