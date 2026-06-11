/** Pooled DOM tags projected from 3D anchors — placards (constellations) and
 * epoch markers (spiral/shells/tunnel) share this layer; they never coexist.
 * Same recycling pattern as labels.ts. */

export interface PlacedTag {
  x: number; // css px
  y: number;
  opacity: number;
  title: string;
  sub?: string;
  hairline?: boolean; // 1px drop-line from the tag down to the 3D anchor
}

const POOL = 12;

interface Node {
  box: HTMLDivElement;
  title: HTMLSpanElement;
  sub: HTMLSpanElement;
  line: HTMLDivElement;
}

export class ProjectedTagLayer {
  readonly root: HTMLDivElement;
  private pool: Node[] = [];

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.dataset.testid = 'chart-tags';
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: '6',
      overflow: 'hidden',
    } satisfies Partial<CSSStyleDeclaration>);

    for (let i = 0; i < POOL; i++) {
      const box = document.createElement('div');
      Object.assign(box.style, {
        position: 'absolute',
        display: 'none',
        transform: 'translate(-50%, -100%)',
        textAlign: 'center',
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: '0.14em',
        transition: 'opacity 600ms ease',
      } satisfies Partial<CSSStyleDeclaration>);

      const title = document.createElement('span');
      Object.assign(title.style, {
        display: 'block',
        color: 'rgba(233, 226, 208, 0.8)',
        fontSize: '10px',
        whiteSpace: 'nowrap',
        textShadow: '0 1px 8px rgba(8,9,13,0.9)',
      } satisfies Partial<CSSStyleDeclaration>);

      const sub = document.createElement('span');
      Object.assign(sub.style, {
        display: 'none',
        color: '#8a8e98',
        fontSize: '9px',
        marginTop: '2px',
        whiteSpace: 'nowrap',
      } satisfies Partial<CSSStyleDeclaration>);

      const line = document.createElement('div');
      Object.assign(line.style, {
        display: 'none',
        width: '1px',
        height: '28px',
        margin: '4px auto 0',
        background: 'rgba(138, 142, 152, 0.5)',
      } satisfies Partial<CSSStyleDeclaration>);

      box.append(title, sub, line);
      this.root.appendChild(box);
      this.pool.push({ box, title, sub, line });
    }
    parent.appendChild(this.root);
  }

  update(tags: PlacedTag[]) {
    for (let i = 0; i < POOL; i++) {
      const t = tags[i];
      const n = this.pool[i];
      if (!t) {
        n.box.style.display = 'none';
        n.title.textContent = '';
        n.sub.textContent = '';
        continue;
      }
      n.box.style.display = 'block';
      n.box.style.left = `${t.x.toFixed(1)}px`;
      n.box.style.top = `${t.y.toFixed(1)}px`;
      n.box.style.opacity = String(t.opacity);
      n.title.textContent = t.title;
      n.sub.textContent = t.sub ?? '';
      n.sub.style.display = t.sub ? 'block' : 'none';
      n.line.style.display = t.hairline ? 'block' : 'none';
    }
  }

  clear() {
    this.update([]);
  }

  dispose() {
    this.root.remove();
  }
}
