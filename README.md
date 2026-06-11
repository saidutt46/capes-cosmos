# PAPER SKY

*A sky survey of the printed multiverse.* Every soul Marvel and DC ever printed
— 23,272 characters — mapped as light in an interactive 3D void.

The data is the protagonist: no character artwork, no logos (the dataset is CC0;
the IP is not). Marvel red and DC blue exist only as emission light inside the
canvas. The instrument grammar is four verbs: **SWEEP** (click void → the space
answers), **LOCK** (click star → its dossier unfolds from its own rings),
**EXPOSE** (press & hold → the faint sky develops like a long-exposure
photograph), **NAVIGATE** (layout dial · expeditions · ⌘K warp).

## Run

```bash
npm install
npm run dev        # http://localhost:5180  (5173 belongs to switchboard on this machine)
```

`/design` — hidden FIELD MANUAL (palette, type, motion, the rules). Never linked.
`/methodology` — the colophon: data provenance, what the sky encodes, what's deliberately absent.
`/star/PS-00001` — deep link straight into any character's dossier.

## The instrument

- **Layout dial** — four skies, morphing all 23,272 stars in a year-staggered
  ripple: Galaxy Spiral · Expanding Universe · Time Tunnel · Constellations.
- **SWEEP** — click the void: a wavefront crosses the field and the survey
  answers with a sector census and era annotation.
- **LOCK** — click a star: the camera flies in, the field dims, ring gauges
  unfold around the star, cohort hairlines connect its debut-year kin, and the
  dossier opens (luminosity percentile, reality, spectral class). Esc releases.
- **EXPOSE** — press and hold: long-exposure develops the ~6,200 characters
  who appeared exactly once. Release, and they fade back into the dark.
- **LENSES** (left edge) — FATE / CLASS / UNIVERSE dim everything that doesn't
  match; `✕ ALL` (or Esc) returns the full sky. **DESIGNATIONS** (top right) —
  distance-culled floating names.
- **RADIO** (top right) — the survey's audio band: every character has a
  deterministic pulsar signature (rhythm from designation, pitch from debut
  year, decay from luminosity, timbre from alignment; the deceased echo).
  Lock a star and it broadcasts; sweep and the sector answers in chord.
  Off by default; zero samples, pure WebAudio.
- **CALIBRATION** — epoch rings and decade gates mark time in every sky, a
  skippable first-light sequence teaches the chart on each launch, and the
  KEY chip (bottom left) is the permanent legend. Constellations carry
  reality placards (EARTH-616 · NEW EARTH · the dwarf realities).
- Honors `prefers-reduced-motion`; coarse-pointer devices skip post FX.

## Verify

```bash
npm run typecheck
npm test           # vitest — parser contract against the real bundle
npm run test:e2e   # playwright — boots the app, checks 23,272 objects render
```

## Data

`public/data/` is the survey bundle exported from the
[capes-and-cowls](https://github.com/saidutt46/capes-and-cowls) analysis repo
(`python -m capes.webexport`): `stars.bin` (233KB structure-of-arrays for all
23,272 characters), `meta.json` (byte layout + category tables), `names.json`
(designations), `aggregates.json` (HUD series).

## Stack

Vite · React 19 (chrome/HUD only) · three.js driven imperatively (one Points
system, layout morphs in the vertex shader) · GSAP · vitest + Playwright.
Fonts: Fraunces (display) · IBM Plex Mono (instrument) · Inter Tight (body).
