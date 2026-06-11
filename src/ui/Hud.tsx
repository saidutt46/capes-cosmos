import type { StarFields } from '../data/parser';
import type { LayoutName, Lens } from '../scene/field';
import './hud.css';

/** lens facets: label → (field, category code) */
const LENSES: { group: string; field: Lens['field']; options: [string, number][] }[] = [
  { group: 'FATE', field: 'fate', options: [['LIVING', 0], ['DECEASED', 1]] },
  { group: 'CLASS', field: 'class', options: [['GOOD', 0], ['NEUTRAL', 1], ['BAD', 2]] },
  { group: 'UNIVERSE', field: 'universe', options: [['MARVEL', 0], ['DC', 1]] },
];

const LAYOUTS: { id: LayoutName; label: string }[] = [
  { id: 'spiral', label: 'GALAXY SPIRAL' },
  { id: 'shells', label: 'EXPANDING UNIVERSE' },
  { id: 'tunnel', label: 'TIME TUNNEL' },
  { id: 'constellations', label: 'CONSTELLATIONS' },
];

const LEGENDS: Record<LayoutName, string> = {
  spiral:
    'Eight decades wind outward from the 1935 core; heroes ride above the plane, villains below.',
  shells:
    'The printed big bang: every shell is a year, expanding from 1935 to the 2013 rim.',
  tunnel:
    'Depth is time. Fly forward through the corridor; it bulges where 1993 minted 763 souls.',
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
  lens: Lens;
  onLens: (l: Lens) => void;
  radio: boolean;
  onRadio: (on: boolean) => void;
  radioSupported: boolean;
}

export function Hud({ stars, error, layout, onLayout, names, onNames, ignite, lens, onLens, radio, onRadio, radioSupported }: HudProps) {
  return (
    <div className="hud">
      <header className="hud-bar hud-top">
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

        <span className="hud-right">
          {radioSupported && (
            <button
              className={`dial-btn names-btn${radio ? ' active' : ''}`}
              data-testid="radio-toggle"
              onClick={() => onRadio(!radio)}
            >
              RADIO {radio ? 'ON' : 'OFF'}
            </button>
          )}
          <button
            className={`dial-btn names-btn${names ? ' active' : ''}`}
            data-testid="names-toggle"
            onClick={() => onNames(!names)}
          >
            DESIGNATIONS {names ? 'ON' : 'OFF'}
          </button>
        </span>
      </header>

      <nav className="lens-bar" data-testid="lens-bar">
        {lens.field !== 'none' && (
          <button
            className="dial-btn lens-btn lens-clear"
            data-testid="lens-clear"
            onClick={() => onLens({ field: 'none', value: 0 })}
          >
            ✕ ALL
          </button>
        )}
        {LENSES.map((g) => (
          <span key={g.group} className="lens-group">
            <span className="lens-label">{g.group}</span>
            {g.options.map(([label, code]) => {
              const active = lens.field === g.field && lens.value === code;
              return (
                <button
                  key={label}
                  className={`dial-btn lens-btn${active ? ' active' : ''}`}
                  data-testid={`lens-${label.toLowerCase()}`}
                  onClick={() =>
                    onLens(active ? { field: 'none', value: 0 } : { field: g.field, value: code })
                  }
                >
                  {label}
                </button>
              );
            })}
          </span>
        ))}
      </nav>

      <footer className="hud-bar hud-bottom">
        <span data-testid="status" className="hud-note">
          {error
            ? `ACQUISITION FAILED · ${error}`
            : stars
              ? ignite < 1
                ? `IGNITING · ${Math.floor(stars.count * ignite).toLocaleString()} OBJECTS`
                : `${stars.count.toLocaleString()} OBJECTS · ${stars.meta.categories.reality.length} REALITIES · 1935–2013`
              : 'ACQUIRING SURVEY DATA…'}
          {'  '}
          <a className="hud-link" href="/methodology">
            · METHODOLOGY
          </a>
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
