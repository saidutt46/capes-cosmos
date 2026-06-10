import { useEffect, useRef, useState } from 'react';
import { loadSurvey, type StarFields } from './data/parser';
import { StarField } from './scene/field';
import { Hud } from './ui/Hud';
import { DesignPage } from './ui/DesignPage';

export default function App() {
  // hidden, never-linked design reference (no router needed for one path)
  if (window.location.pathname === '/design') return <DesignPage />;
  return <Survey />;
}

function Survey() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stars, setStars] = useState<StarFields | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let field: StarField | null = null;
    let cancelled = false;

    loadSurvey()
      .then((s) => {
        if (cancelled || !canvasRef.current) return;
        setStars(s);
        field = new StarField(canvasRef.current, s);
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      cancelled = true;
      field?.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0 }} />
      <Hud stars={stars} error={error} />
    </>
  );
}
