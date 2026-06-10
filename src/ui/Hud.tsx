import type { StarFields } from '../data/parser';
import type { LayoutName } from '../scene/field';
import './hud.css';

const LAYOUTS: { id: LayoutName; label: string }[] = [
  { id: 'spiral', label: 'GALAXY SPIRAL' },
  { id: 'shells', label: 'EXPANDING UNIVERSE' },
  { id: 'tunnel', label: 'TIME TUNNEL' },
  { id: 'constellations', label: 'CONSTELLATIONS' },
];

const LEGENDS: Record<LayoutName, string> = {
  spiral:
    'Eight decades wind outward from the 1935 core — heroes ride above the plane, villains below.',
  shells:
    'The printed big bang: every shell is a year, expanding from 1935 to the 2013 rim.',
  tunnel:
    'Depth is time. Fly forward through the corridor — it bulges where 1993 minted 763 souls.',
  constellations:
    'The multiverse, mapped honestly: two great galaxies and the dwarf realities that orbit them.',
};

interface HudProps {
  stars: StarFields | null;
  error: string | null;
  layout: LayoutName;
  onLayout: (l: LayoutName) => void;
  names: boolean;
  onNames: (on: boolean) => void;
  ignite: number;
}

export function Hud({ stars, error, layout, onLayout, names, onNames, ignite }: HudProps) {
  return (
    <div className="hud">
      <header className="hud-bar">
        <span className="wordmark" data-testid="wordmark">
          PAPER SKY<span className="cursor">_</span>
        </span>

        <nav className="dial" data-testid="dial">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              className={`dial-btn${l.id === layout ? ' active' : ''}`}
              data-testid={`dial-${l.id}`}
              onClick={() => onLayout(l.id)}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <button
          className={`dial-btn names-btn${names ? ' active' : ''}`}
          data-testid="names-toggle"
          onClick={() => onNames(!names)}
        >
          DESIGNATIONS {names ? 'ON' : 'OFF'}
        </button>
      </header>

      <footer className="hud-bar hud-bottom">
        <span data-testid="status" className="hud-note">
          {error
            ? `ACQUISITION FAILED — ${error}`
            : stars
              ? ignite < 1
                ? `IGNITING — ${Math.floor(stars.count * ignite).toLocaleString()} OBJECTS`
                : `${stars.count.toLocaleString()} OBJECTS · ${stars.meta.categories.reality.length} REALITIES · 1935–2013`
              : 'ACQUIRING SURVEY DATA…'}
        </span>
        <span className="hud-layout">
          <span className="hud-layout-name">
            {LAYOUTS.find((l) => l.id === layout)!.label}
          </span>
          {stars && (
            <span
              key={layout}
              className="hud-legend glitch"
              data-testid="legend"
              data-text={LEGENDS[layout]}
            >
              {LEGENDS[layout]}
            </span>
          )}
        </span>
      </footer>
    </div>
  );
}
