/** LOD body system for FLIGHT mode.
 *
 * The star Points field stays as the background sky. As the ship flies near
 * characters, the ~60 closest materialise as real meshes via InstancedMesh:
 *   - STAR (≥1200 app) — emissive sphere, scale 3–8u, glow sprite
 *   - PLANET (100–1199) — shaded sphere, scale 1.2–3u; ringed (torus) when align===2
 *   - MOON (2–99) — small grey sphere, 0.4–1.2u
 *   - DUST (≤1 or NA 65535) — stays a point, not materialised
 *
 * Deceased characters get ember treatment; deceased STAR → dwarf (×0.6, ember).
 * All logic is deterministic from survey arrays (no Math.random).
 *
 * NearBodies builds a cell-40u spatial hash from the positions array once, then
 * per-frame updates instance matrices/colors and returns a sorted NearBody list.
 *
 * Zero allocations in the update() hot path where reasonable (reused vectors /
 * matrices / scratch arrays).
 */
import * as THREE from 'three';
import type { StarFields } from '../data/parser';
import { NA_APPEARANCES } from '../data/parser';

export type BodyClass = 'star' | 'planet' | 'moon' | 'dust';

export interface BodyInfo {
  cls: BodyClass;
  scale: number;
  ringed: boolean;
  ember: boolean;
}

export interface NearBody {
  index: number;
  dist: number;
  pos: THREE.Vector3;
  info: BodyInfo;
}


// ---------- pure functions ----------

/** Classify a survey character into a flight-world body.
 * app = appearances (65535 = NA), align = alignment u8 (255 = NA),
 * alive = fate u8 (0 Living, 1 Deceased, 255 NA). */
export function classify(app: number, align: number, alive: number): BodyInfo {
  const isNA = app === NA_APPEARANCES; // 65535
  const deceased = alive === 1;

  if (isNA || app <= 1) {
    // dust — stays a Point in the background
    return { cls: 'dust', scale: 0, ringed: false, ember: deceased };
  }

  if (app >= 1200) {
    // STAR tier
    const raw = 3 + (Math.log(app) / Math.log(1200)) * 5; // 3..8u
    const scale = deceased ? raw * 0.6 : raw; // dwarf if deceased
    return { cls: 'star', scale, ringed: false, ember: deceased };
  }

  if (app >= 100) {
    // PLANET tier: log-scaled 1.2..3u; ringed if alignment === 2 (Bad)
    const t = (app - 100) / (1200 - 100);
    const scale = 1.2 + t * 1.8;
    const ringed = align === 2; // Bad alignment wears a ring
    return { cls: 'planet', scale, ringed, ember: deceased };
  }

  // MOON tier: 2–99 app → 0.4..1.2u
  const t = (app - 2) / (99 - 2);
  const scale = 0.4 + t * 0.8;
  return { cls: 'moon', scale, ringed: false, ember: deceased };
}

/** Soft-falloff gravity pull.
 * influence radius = scale * 12; monotone decreasing, exactly 0 at/beyond
 * influence, finite at dist 0 (soft² guard).
 *
 * Formula: k * scale³ / (dist² + soft²)
 * where k normalises to ~1.0g at dist = scale (i.e. touching the surface). */
export function gravityPull(dist: number, scale: number): number {
  const influence = scale * 12;
  if (dist >= influence) return 0;
  const soft = scale * 0.5; // prevents infinity at dist=0
  const k = (scale * scale + soft * soft); // normalisation: pull(scale,scale) ~ 1
  const raw = k * (scale * scale * scale) / (dist * dist + soft * soft);
  // hard clamp at influence boundary so it's strictly 0 at/beyond
  const fade = 1 - dist / influence;
  return raw * fade * fade; // smooth falloff to 0 at boundary
}

// ---------- palette ----------

const MARVEL_COL = new THREE.Color('#ff4438');
const DC_COL = new THREE.Color('#4595ff');
const EMBER_COL = new THREE.Color('#8a8e98');

const MAX_BODIES = 60;
const MAX_RINGS = 16;
const MAX_GLOW = 8;
const CELL_SIZE = 40;

function cellKey(cx: number, cy: number, cz: number): number {
  // deterministic integer hash for 3D cell coordinates
  // uses Cantor-ish packing + prime mix; works for moderate coordinate ranges
  const x = cx + 512;
  const y = cy + 512;
  const z = cz + 512;
  return ((x * 1619 + y * 31337 + z * 6271) | 0);
}

// ---------- NearBodies ----------

export class NearBodies {
  private scene: THREE.Scene;
  private stars: StarFields;
  private positions: Float32Array;

  // spatial hash: Map from cellKey → array of star indices
  private grid = new Map<number, number[]>();

  // InstancedMesh for sphere bodies (MAX_BODIES capacity)
  private sphereIM: THREE.InstancedMesh;
  // InstancedMesh for ring tori (MAX_RINGS capacity)
  private ringIM: THREE.InstancedMesh;
  // Glow sprites for star-class bodies (MAX_GLOW capacity)
  private glowSprites: THREE.Sprite[] = [];

  // scratch objects reused every frame — no per-frame alloc
  private _mat4 = new THREE.Matrix4();
  private _scale = new THREE.Matrix4();
  private _col = new THREE.Color();

  constructor(scene: THREE.Scene, stars: StarFields, positions: Float32Array) {
    this.scene = scene;
    this.stars = stars;
    this.positions = positions;

    // build spatial hash once
    const n = stars.count;
    for (let i = 0; i < n; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const cx = Math.floor(x / CELL_SIZE);
      const cy = Math.floor(y / CELL_SIZE);
      const cz = Math.floor(z / CELL_SIZE);
      const key = cellKey(cx, cy, cz);
      let bucket = this.grid.get(key);
      if (!bucket) {
        bucket = [];
        this.grid.set(key, bucket);
      }
      bucket.push(i);
    }

    // sphere InstancedMesh: MeshStandardMaterial (lights arrive in Batch B)
    // For star-class instances the instanceColor drives brightness since no
    // scene lights yet — effectively MeshBasicMaterial-like appearance.
    // Note: full PBR look comes in Batch B when FlightMode adds scene lights.
    const sphereGeo = new THREE.SphereGeometry(1, 20, 16);
    const sphereMat = new THREE.MeshStandardMaterial({
      roughness: 0.65,
      metalness: 0.1,
      vertexColors: false,
    });
    this.sphereIM = new THREE.InstancedMesh(sphereGeo, sphereMat, MAX_BODIES);
    this.sphereIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sphereIM.count = 0;
    this.sphereIM.frustumCulled = false;
    scene.add(this.sphereIM);

    // ring InstancedMesh for planets with align===2
    const ringGeo = new THREE.TorusGeometry(1, 0.12, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: EMBER_COL, roughness: 0.8, metalness: 0.05,
    });
    this.ringIM = new THREE.InstancedMesh(ringGeo, ringMat, MAX_RINGS);
    this.ringIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ringIM.count = 0;
    this.ringIM.frustumCulled = false;
    scene.add(this.ringIM);

    // glow sprites (additive) for star-class bodies
    for (let g = 0; g < MAX_GLOW; g++) {
      const size = 64;
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const ctx = cv.getContext('2d')!;
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,200,0.9)');
      grad.addColorStop(0.4, 'rgba(255,180,100,0.4)');
      grad.addColorStop(1, 'rgba(255,100,50,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      const tex = new THREE.CanvasTexture(cv);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.glowSprites.push(sprite);
    }
  }

  /** Query near bodies, update instanced meshes, return sorted NearBody[] (≤60).
   * sensor: ship sensor multiplier (affects detection but not classification). */
  update(shipPos: THREE.Vector3, sensor: number): NearBody[] {
    const cell = Math.floor; // shorthand
    const cx0 = cell(shipPos.x / CELL_SIZE);
    const cy0 = cell(shipPos.y / CELL_SIZE);
    const cz0 = cell(shipPos.z / CELL_SIZE);

    // collect candidates from 27 cells (3×3×3 around ship)
    // reuse _lastNear array — clear without realloc
    const candidates: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = cellKey(cx0 + dx, cy0 + dy, cz0 + dz);
          const bucket = this.grid.get(key);
          if (!bucket) continue;
          for (const idx of bucket) candidates.push(idx);
        }
      }
    }

    // compute distances and classify, skipping dust
    const near: NearBody[] = [];
    const stars = this.stars;
    const pos = this.positions;
    const sensorRadius = CELL_SIZE * 2 * sensor; // cut-off: must be within 2 cells (sensor-scaled)

    for (const idx of candidates) {
      const px = pos[idx * 3];
      const py = pos[idx * 3 + 1];
      const pz = pos[idx * 3 + 2];
      const dx = px - shipPos.x;
      const dy = py - shipPos.y;
      const dz = pz - shipPos.z;
      const dist2 = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(dist2);
      if (dist > sensorRadius) continue;

      const app = stars.appearances[idx];
      const align = stars.align[idx];
      const alive = stars.alive[idx];
      const info = classify(app, align, alive);
      if (info.cls === 'dust') continue; // dust stays as a point

      near.push({
        index: idx,
        dist,
        pos: new THREE.Vector3(px, py, pz),
        info,
      });
    }

    // sort by distance, keep ≤MAX_BODIES
    near.sort((a, b) => a.dist - b.dist);
    if (near.length > MAX_BODIES) near.length = MAX_BODIES;

    // --- update instanced sphere mesh ---
    const mat4 = this._mat4;
    const scaleMat = this._scale;
    const col = this._col;

    let sphereCount = 0;
    let ringCount = 0;
    let glowIdx = 0;

    for (const nb of near) {
      const { info, pos: bpos } = nb;
      const uni = stars.universe[nb.index]; // 0 Marvel, 1 DC
      const baseCol = uni === 0 ? MARVEL_COL : DC_COL;

      // tint: ember bodies drift toward annot grey
      if (info.ember) {
        col.lerpColors(baseCol, EMBER_COL, 0.55);
      } else {
        col.copy(baseCol);
      }

      // for star-class, boost brightness (no scene lights yet — see constructor note)
      if (info.cls === 'star') {
        col.multiplyScalar(info.ember ? 1.4 : 2.2);
      }

      // compose matrix: identity rotation + position + uniform scale
      mat4.identity();
      scaleMat.makeScale(info.scale, info.scale, info.scale);
      mat4.setPosition(bpos);
      mat4.multiply(scaleMat);

      if (sphereCount < MAX_BODIES) {
        this.sphereIM.setMatrixAt(sphereCount, mat4);
        this.sphereIM.setColorAt(sphereCount, col);
        sphereCount++;
      }

      // ring for ringed planets
      if (info.ringed && ringCount < MAX_RINGS) {
        const ringScale = info.scale * 1.65;
        scaleMat.makeScale(ringScale, ringScale * 0.08, ringScale);
        mat4.identity();
        mat4.setPosition(bpos);
        mat4.multiply(scaleMat);
        this.ringIM.setMatrixAt(ringCount, mat4);
        this.ringIM.setColorAt?.(ringCount, col.clone().multiplyScalar(0.7));
        ringCount++;
      }

      // glow sprite for star-class bodies
      if (info.cls === 'star' && glowIdx < MAX_GLOW) {
        const sp = this.glowSprites[glowIdx];
        sp.position.copy(bpos);
        const glowSize = info.scale * 3.5;
        sp.scale.setScalar(glowSize);
        sp.visible = true;
        // tint the sprite toward the universe color
        (sp.material as THREE.SpriteMaterial).color.copy(info.ember ? EMBER_COL : baseCol);
        glowIdx++;
      }
    }

    // hide unused sphere instances
    this.sphereIM.count = sphereCount;
    this.sphereIM.instanceMatrix.needsUpdate = true;
    if (this.sphereIM.instanceColor) this.sphereIM.instanceColor.needsUpdate = true;

    // hide unused ring instances
    this.ringIM.count = ringCount;
    this.ringIM.instanceMatrix.needsUpdate = true;
    if (this.ringIM.instanceColor) this.ringIM.instanceColor.needsUpdate = true;

    // hide unused glow sprites
    for (let g = glowIdx; g < MAX_GLOW; g++) {
      this.glowSprites[g].visible = false;
    }

    return near;
  }

  dispose(): void {
    this.scene.remove(this.sphereIM);
    this.sphereIM.geometry.dispose();
    (this.sphereIM.material as THREE.Material).dispose();

    this.scene.remove(this.ringIM);
    this.ringIM.geometry.dispose();
    (this.ringIM.material as THREE.Material).dispose();

    for (const sp of this.glowSprites) {
      this.scene.remove(sp);
      (sp.material as THREE.SpriteMaterial).map?.dispose();
      (sp.material as THREE.SpriteMaterial).dispose();
    }
    this.glowSprites.length = 0;
    this.grid.clear();
  }
}
