import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSurvey, type StarFields } from './data/parser';
import { StarField, type LayoutName, type Lens } from './scene/field';
import { Hud } from './ui/Hud';
import { Verbs, designationOf } from './ui/Verbs';
import { Calibration, CALIBRATED_FLAG } from './ui/Calibration';
import { Key } from './ui/Key';
import { DesignPage } from './ui/DesignPage';
import { MethodologyPage } from './ui/MethodologyPage';

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
  const [calibRun, setCalibRun] = useState(() => !localStorage.getItem(CALIBRATED_FLAG));

  useEffect(() => {
    let cancelled = false;

    loadSurvey()
      .then(async (s) => {
        if (cancelled || !canvasRef.current) return;
        setStars(s);
        const f = new StarField(canvasRef.current, s);
        fieldRef.current = f;
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

  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0 }} />
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
      />
      <Key
        layout={layout}
        onRecalibrate={() => {
          localStorage.removeItem(CALIBRATED_FLAG);
          setCalibRun(true);
        }}
      />
      <Calibration ignite={ignite} run={calibRun} onDone={() => setCalibRun(false)} />
      {field && stars && (
        <Verbs field={field} stars={stars} names={names} onLockChange={onLockChange} />
      )}
    </>
  );
}
