import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSurvey, type StarFields } from './data/parser';
import { StarField, type LayoutName } from './scene/field';
import { Hud } from './ui/Hud';
import { DesignPage } from './ui/DesignPage';

export default function App() {
  // hidden, never-linked design reference (no router needed for one path)
  if (window.location.pathname === '/design') return <DesignPage />;
  return <Survey />;
}

function Survey() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<StarField | null>(null);
  const [stars, setStars] = useState<StarFields | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutName>('spiral');
  const [names, setNames] = useState(true);

  useEffect(() => {
    let cancelled = false;

    loadSurvey()
      .then(async (s) => {
        if (cancelled || !canvasRef.current) return;
        setStars(s);
        const field = new StarField(canvasRef.current, s);
        fieldRef.current = field;
        // designations default ON — lazy-load the catalog names
        const res = await fetch('/data/names.json');
        const data = (await res.json()) as { name: string[] };
        if (!cancelled) field.labels.setNames(data.name);
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
    setNames(on);
  }, []);

  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0 }} />
      <Hud
        stars={stars}
        error={error}
        layout={layout}
        onLayout={onLayout}
        names={names}
        onNames={onNames}
      />
    </>
  );
}
