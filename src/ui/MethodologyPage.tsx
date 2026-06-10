/** METHODOLOGY — the colophon. How the survey was made, what it does and
 * deliberately does not show. Linked from the HUD; reuses FIELD MANUAL styles. */
import './design.css';

export function MethodologyPage() {
  return (
    <main className="manual">
      <header className="manual-head">
        <span className="mono dim">PS · COLOPHON</span>
        <h1 data-testid="methodology-title" className="display">
          METHODOLOGY
        </h1>
        <p className="mono dim">how the printed sky was surveyed</p>
      </header>

      <section>
        <h2 className="mono section-label">01 · THE DATA</h2>
        <p className="body rule">
          23,272 characters from the public-domain (CC0){' '}
          <a className="hud-link" href="https://www.kaggle.com/datasets/ibrahimqasimi/marvel-dc-comic-characters-database">
            Marvel + DC Comic Characters Database
          </a>{' '}
          — itself derived from the FiveThirtyEight comic-characters dataset, compiled
          from the Marvel and DC fan wikis. Cleaning, analysis, and the binary survey
          bundle live in the companion repo{' '}
          <a className="hud-link" href="https://github.com/saidutt46/capes-and-cowls">
            capes-and-cowls
          </a>
          : the two publishers&apos; mutually exclusive year columns were coalesced
          (debut-year coverage rose from ~30% to 96.2%), categorical suffixes
          normalized, and missing values kept missing — no debut year was ever imputed.
        </p>
      </section>

      <section>
        <h2 className="mono section-label">02 · WHAT THE SKY ENCODES</h2>
        <p className="body rule">
          Star color is the publisher&apos;s emission (Marvel red / DC blue); deceased
          characters dim to embers. Size and brightness follow appearance counts — a
          power law, so a few suns glare over a vast dust of characters seen once or
          twice. Each star carries a unique identity hue as a ring that resolves only
          up close. The &quot;galaxies&quot; in the Constellations sky are the fictional
          realities parsed from character designations: Earth-616, New Earth, and the
          dwarf alternates.
        </p>
      </section>

      <section>
        <h2 className="mono section-label">03 · WHAT IS DELIBERATELY ABSENT</h2>
        <p className="body rule">
          No character artwork, no logos, no cover scans. The dataset is public domain;
          the characters&apos; likenesses are not — they remain the property of Marvel
          and DC. This survey maps <em>data as light</em>, nothing else. Names and
          facts are uncopyrightable; everything you see is computed from them.
        </p>
      </section>

      <section>
        <h2 className="mono section-label">04 · INSTRUMENT</h2>
        <p className="body rule">
          Three.js (one GPU points system, layout morphs in the vertex shader), React
          for the chrome, GSAP for motion, GPU ID-buffer picking for the verbs.
          Typography: Fraunces · IBM Plex Mono · Inter Tight. Honors
          prefers-reduced-motion. Open source at{' '}
          <a className="hud-link" href="https://github.com/saidutt46/capes-cosmos">
            saidutt46/capes-cosmos
          </a>
          .
        </p>
      </section>

      <footer className="mono dim manual-foot">
        <a className="hud-link" href="/">
          ← RETURN TO THE SURVEY
        </a>
      </footer>
    </main>
  );
}
