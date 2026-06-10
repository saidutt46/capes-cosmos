import type { StarFields } from '../data/parser';
import './hud.css';

const LAYOUT_LEGENDS: Record<string, string> = {
  'GALAXY SPIRAL':
    'Eight decades wind outward from the 1935 core — heroes ride above the plane, villains below.',
};

export function Hud({ stars, error }: { stars: StarFields | null; error: string | null }) {
  const layout = 'GALAXY SPIRAL';
  return (
    <div className="hud">
      <header className="hud-bar">
        <span className="wordmark" data-testid="wordmark">
          PAPER SKY<span className="cursor">_</span>
        </span>
        <span className="hud-note">SURVEY OF THE PRINTED MULTIVERSE</span>
      </header>

      <footer className="hud-bar hud-bottom">
        <span data-testid="status" className="hud-note">
          {error
            ? `ACQUISITION FAILED — ${error}`
            : stars
              ? `${stars.count.toLocaleString()} OBJECTS · ${stars.meta.categories.reality.length} REALITIES · 1935–2013`
              : 'ACQUIRING SURVEY DATA…'}
        </span>
        <span className="hud-layout">
          <span className="hud-layout-name">{layout}</span>
          {stars && (
            <span
              key={layout}
              className="hud-legend glitch"
              data-testid="legend"
              data-text={LAYOUT_LEGENDS[layout]}
            >
              {LAYOUT_LEGENDS[layout]}
            </span>
          )}
        </span>
      </footer>
    </div>
  );
}
