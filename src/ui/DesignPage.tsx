/** FIELD MANUAL — hidden design-system page at /design (not linked anywhere).
 * The living reference for palette, type, motion, and the rules that keep
 * PAPER SKY from drifting into slop. Verification artifact for the art direction.
 */
import './design.css';

const SWATCHES = [
  { name: 'Void', hex: '#08090D', note: 'never pure black' },
  { name: 'Ink wash', hex: '#11141A', note: 'HUD plates, +2% over void' },
  { name: 'Newsprint bone', hex: '#E9E2D0', note: 'all primary text' },
  { name: 'Annotation', hex: '#8A8E98', note: 'labels, ticks, designations' },
  { name: 'Halation Coral', hex: '#FF5C49', note: 'THE accent · interaction only' },
];

const EMISSIONS = [
  { name: 'Marvel emission', hex: '#ED2B24' },
  { name: 'DC emission', hex: '#0478F1' },
  { name: 'Ember (deceased)', hex: '#6E3B33' },
];

export function DesignPage() {
  return (
    <main className="manual">
      <header className="manual-head">
        <span className="mono dim">PS · INTERNAL · NOT LINKED</span>
        <h1 data-testid="design-title" className="display">
          FIELD MANUAL
        </h1>
        <p className="mono dim">
          PAPER SKY · design system v1 · data-noir observatory
        </p>
      </header>

      <section>
        <h2 className="mono section-label">01 · PALETTE · CHROME</h2>
        <div className="swatch-row">
          {SWATCHES.map((s) => (
            <figure key={s.hex} className="swatch">
              <div className="chip" style={{ background: s.hex }} />
              <figcaption className="mono">
                {s.name}
                <br />
                <span className="dim">{s.hex} · {s.note}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <h2 className="mono section-label">01b · EMISSIONS · CANVAS-ONLY</h2>
        <p className="body rule">
          The law: Marvel red and DC blue exist <em>only as light inside the
          canvas</em>: data encoding, rendered additive with bloom. UI chrome
          never touches them. Chrome is void, bone, and coral. Break this rule
          and the whole thing collapses into a fan site.
        </p>
        <div className="swatch-row">
          {EMISSIONS.map((s) => (
            <figure key={s.hex} className="swatch">
              <div className="chip glow" style={{ background: s.hex, color: s.hex }} />
              <figcaption className="mono">
                {s.name}
                <br />
                <span className="dim">{s.hex}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mono section-label">02 · TYPE</h2>
        <div className="specimen">
          <span className="mono dim">Fraunces · variable (wght 300–900, opsz 9–144) · display</span>
          <p className="display spec-display">The Paper Sky</p>
          <p className="display spec-display heavy">SPIDER-MAN</p>
        </div>
        <div className="specimen">
          <span className="mono dim">IBM Plex Mono · the instrument voice</span>
          <p className="mono spec-mono">
            PS-00001 · SPIDER-MAN (PETER PARKER) · M/1962 · 4,043 OBS
            <br />
            LUMINOSITY · brighter than 99.996% of the printed sky
          </p>
        </div>
        <div className="specimen">
          <span className="mono dim">Inter Tight · body prose</span>
          <p className="body spec-body">
            A survey catalogs data, not artwork. We treat eighty years of
            fiction with the deadpan rigor of real astronomy: alignment is a
            spectral class, death is stellar death, and the 1990s is a
            starburst epoch the sky never repeated.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mono section-label">03 · MOTION</h2>
        <p className="body rule">
          Slow and weighty. Nothing bounces. Camera 600–900ms, morphs
          1.8–2.4s staggered by debut year. Hover the bar:
        </p>
        <div className="ease-demo">
          <div className="ease-dot" />
        </div>
        <p className="mono dim">cubic-bezier(0.16, 1, 0.3, 1) · var(--ease-weighty)</p>
      </section>

      <section>
        <h2 className="mono section-label">04 · THE FOUR VERBS</h2>
        <ul className="mono verbs">
          <li><span className="coral">SWEEP</span> · click void → the space answers</li>
          <li><span className="coral">LOCK</span> · click star → dossier unfolds from its rings</li>
          <li><span className="coral">EXPOSE</span> · press &amp; hold → the faint sky develops</li>
          <li><span className="coral">NAVIGATE</span> · dial · expeditions · ⌘K warp</li>
        </ul>
      </section>

      <footer className="mono dim manual-foot">
        PAPER SKY · survey of the printed multiverse · /design is never linked
      </footer>
    </main>
  );
}
