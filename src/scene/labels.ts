/** DESIGNATIONS — floating character names above stars.
 *
 * 23k HTML labels is impossible; the trick is screen-space prominence culling:
 * every few frames, project the stars, keep those whose projected size clears a
 * threshold, greedily take the top K by prominence with a minimum pixel
 * separation (so labels never jam), and recycle a small pooled set of DOM nodes.
 * Type size + opacity scale with projected star size, so names resolve exactly
 * as far as the eye could resolve them — never a wall of text at either extreme.
 */

export interface LabelCandidate {
  index: number;
  x: number; // css px
  y: number;
  px: number; // projected star size in px
}

const POOL = 18;
const MIN_PX = 9; // star must be at least this big on screen to earn a name
const SEPARATION = 84; // min px between label anchors

export class LabelLayer {
  readonly root: HTMLDivElement;
  private pool: HTMLSpanElement[] = [];
  private names: string[] | null = null;
  enabled = true;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.dataset.testid = 'labels';
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '5',
      overflow: 'hidden',
    } satisfies Partial<CSSStyleDeclaration>);
    for (let i = 0; i < POOL; i++) {
      const s = document.createElement('span');
      Object.assign(s.style, {
        position: 'absolute',
        transform: 'translate(-50%, -100%)',
        fontFamily: "'IBM Plex Mono', monospace",
        color: '#e9e2d0',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
        textShadow: '0 1px 8px rgba(8,9,13,0.9)',
        display: 'none',
        transition: 'opacity 180ms linear',
      } satisfies Partial<CSSStyleDeclaration>);
      this.root.appendChild(s);
      this.pool.push(s);
    }
    parent.appendChild(this.root);
  }

  setNames(names: string[]) {
    this.names = names;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.root.style.display = on ? 'block' : 'none';
  }

  /** Place labels for this frame from pre-filtered candidates (any order). */
  update(candidates: LabelCandidate[]) {
    if (!this.enabled || !this.names) return;
    candidates.sort((a, b) => b.px - a.px);

    const placed: LabelCandidate[] = [];
    for (const c of candidates) {
      if (placed.length >= POOL) break;
      let clear = true;
      for (const p of placed) {
        const dx = c.x - p.x;
        const dy = c.y - p.y;
        if (dx * dx + dy * dy < SEPARATION * SEPARATION) {
          clear = false;
          break;
        }
      }
      if (clear) placed.push(c);
    }

    for (let i = 0; i < POOL; i++) {
      const el = this.pool[i];
      const c = placed[i];
      if (!c) {
        el.style.display = 'none';
        continue;
      }
      const name = this.names[c.index] ?? '';
      el.textContent = name.split(' (')[0];
      const font = Math.min(15, Math.max(9, c.px * 0.42));
      el.style.display = 'block';
      el.style.fontSize = `${font.toFixed(1)}px`;
      el.style.left = `${c.x.toFixed(1)}px`;
      el.style.top = `${(c.y - c.px * 0.55 - 6).toFixed(1)}px`;
      el.style.opacity = String(Math.min(1, (c.px - MIN_PX) / 16));
    }
  }

  static readonly MIN_PX = MIN_PX;

  dispose() {
    this.root.remove();
  }
}
