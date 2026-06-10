import type { StarFields } from '../data/parser';
import './hud.css';

export function Hud({ stars, error }: { stars: StarFields | null; error: string | null }) {
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
        <span className="hud-note">GALAXY SPIRAL</span>
      </footer>
    </div>
  );
}
