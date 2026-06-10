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
