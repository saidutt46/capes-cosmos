/** Epoch markers — chart furniture that answers "where am I in time".
 * Dashed decade rings (spiral), year shells (shells), decade gates (tunnel).
 * The 3D lines live in a group parented to the star Points (inherits spin);
 * year tags are DOM, projected by StarField through ProjectedTagLayer.
 */
import * as THREE from 'three';
import type { LayoutName } from './field';

const Y0 = 1935;
const SPAN = 2013 - 1935;
const INK = '#8a8e98';

const spiralR = (y: number) => 14 + 286 * Math.pow((y - Y0) / SPAN, 0.8);
const shellR = (y: number) => 26 + 304 * Math.sqrt((y - Y0) / SPAN);
const tunnelZ = (y: number) => (y - Y0) * 9;

export interface EpochTag {
  pos: [number, number, number]; // layout space
  title: string;
}

function dashedCircle(r: number, opacity: number): THREE.Line {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= 128; k++) {
    const a = (k / 128) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({
    color: INK,
    dashSize: 4,
    gapSize: 7,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  return line;
}

function gate(z: number): THREE.LineLoop {
  const pts = [
    new THREE.Vector3(-120, -85, z),
    new THREE.Vector3(120, -85, z),
    new THREE.Vector3(120, 95, z),
    new THREE.Vector3(-120, 95, z),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: INK,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  });
  return new THREE.LineLoop(geo, mat);
}

export class ChartMarkers {
  readonly group = new THREE.Group();
  private sub = new Map<LayoutName, THREE.Group>();
  private tags = new Map<LayoutName, EpochTag[]>();

  constructor() {
    // spiral: dashed decade rings in the galactic plane
    const spiral = new THREE.Group();
    const spiralTags: EpochTag[] = [{ pos: [0, 3, 0], title: '1935 · FIRST LIGHT' }];
    for (const y of [1940, 1960, 1980, 2000]) {
      const r = spiralR(y);
      spiral.add(dashedCircle(r, 0.22));
      spiralTags.push({ pos: [Math.cos(0.9) * r, 3, Math.sin(0.9) * r], title: String(y) });
    }
    this.register('spiral', spiral, spiralTags);

    // shells: three reference shells, equator rings
    const shells = new THREE.Group();
    const shellTags: EpochTag[] = [];
    for (const [y, label] of [
      [1950, '1950'],
      [1985, '1985'],
      [2013, '2013 · SURVEY RIM'],
    ] as [number, string][]) {
      const r = shellR(y);
      shells.add(dashedCircle(r, 0.18));
      shellTags.push({ pos: [Math.cos(2.2) * r, 4, Math.sin(2.2) * r], title: label });
    }
    this.register('shells', shells, shellTags);

    // tunnel: decade gates the camera flies through
    const tunnel = new THREE.Group();
    const tunnelTags: EpochTag[] = [];
    for (let y = 1940; y <= 2010; y += 10) {
      tunnel.add(gate(tunnelZ(y)));
      tunnelTags.push({ pos: [0, 100, tunnelZ(y)], title: String(y) });
    }
    this.register('tunnel', tunnel, tunnelTags);

    // constellations: the reality placards carry the meaning
    this.register('constellations', new THREE.Group(), []);
    this.setLayout('spiral');
  }

  private register(name: LayoutName, g: THREE.Group, tags: EpochTag[]) {
    g.visible = false;
    this.group.add(g);
    this.sub.set(name, g);
    this.tags.set(name, tags);
  }

  setLayout(name: LayoutName) {
    for (const [k, g] of this.sub) g.visible = k === name;
  }

  tagsFor(name: LayoutName): EpochTag[] {
    return this.tags.get(name) ?? [];
  }
}
