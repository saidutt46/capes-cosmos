/** The star field — one Points system holding all 23,272 characters.
 *
 * P2: the four verbs live here.
 *  - pointer arbiter: drag = orbit · quick click on star = LOCK · quick click
 *    on void = SWEEP · stationary hold = EXPOSE
 *  - all verb visuals are per-star math in the vertex shader (dim, sweep wave,
 *    exposure lift, ignition cascade) driven by a handful of uniforms
 *  - React chrome (tooltip / dossier / field notes) subscribes via `events`
 */
import * as THREE from 'three';
import gsap from 'gsap';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
  BlendFunction,
} from 'postprocessing';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { StarFields } from '../data/parser';
import { NA_APPEARANCES, NA_YEAR } from '../data/parser';
import { galaxySpiral, armPoint } from './layouts/spiral';
import { expandingUniverse } from './layouts/shells';
import { timeTunnel, TUNNEL_LENGTH } from './layouts/tunnel';
import { constellations, CENTERS } from './layouts/constellations';
import { makeBackground, makeCoreGlow, makeWisps } from './nebula';
import { LabelLayer } from './labels';
import { ProjectedTagLayer, type PlacedTag } from './tags';
import { ChartMarkers } from './markers';
import { GpuPicker } from './picking';
import type { SweepCensus } from '../data/fieldnotes';

const MARVEL = new THREE.Color('#ff4438');
const DC = new THREE.Color('#4595ff');
const FLARE_THRESHOLD = 1200;
const MORPH_SECONDS = 2.2;
const STAGGER = 0.35;
const SWEEP_RADIUS = 70; // layout-space census radius
const COHORT_MAX = 10;

export type LayoutName = 'spiral' | 'shells' | 'tunnel' | 'constellations';

export interface LockInfo {
  index: number;
  cohort: number[];
}

/** lens = dim everything that doesn't match one data facet */
export type LensField = 'none' | 'fate' | 'class' | 'universe';
export interface Lens {
  field: LensField;
  value: number; // code within the facet's category table
}

interface CameraPreset {
  pos: [number, number, number];
  target: [number, number, number];
  wisps: number;
  glow: number;
}

const CAMERA_PRESETS: Record<LayoutName, CameraPreset> = {
  spiral: { pos: [0, 110, 300], target: [0, 0, 0], wisps: 1, glow: 1 },
  shells: { pos: [0, 150, 540], target: [0, 0, 0], wisps: 0, glow: 1 },
  tunnel: { pos: [85, 48, -60], target: [0, 0, TUNNEL_LENGTH * 0.62], wisps: 0, glow: 0 },
  constellations: { pos: [30, 130, 470], target: [0, 0, 0], wisps: 0, glow: 0 },
};

const VERT = /* glsl */ `
  attribute vec3 aTarget;
  attribute float aDelay;
  attribute float aSize;
  attribute vec3 aColor;
  attribute vec3 aRing;
  attribute float aFlare;
  attribute float aTwinkle;
  attribute float aIndex;
  attribute float aCohort;
  attribute vec3 aFilter; // (universe, align|99, alive) for the lenses
  uniform float uTime;
  uniform float uMix;
  uniform float uIgnite;
  uniform float uHover;
  uniform float uLock;
  uniform float uDim;
  uniform float uSweepR;
  uniform vec3 uSweepOrigin;
  uniform float uExposure;
  uniform float uLensField; // 0 none · 1 fate · 2 class · 3 universe
  uniform float uLensValue;
  uniform float uMotion; // 0 under prefers-reduced-motion
  varying vec3 vColor;
  varying vec3 vRing;
  varying float vFlare;
  varying float vPx;
  varying float vBoost;
  varying float vRingForce;
  varying float vAlpha;
  void main() {
    // year-staggered morph
    float p = clamp((uMix * (1.0 + ${STAGGER}) - aDelay * ${STAGGER}), 0.0, 1.0);
    p = p * p * (3.0 - 2.0 * p);
    vec3 pos = mix(position, aTarget, p);

    // ignition cascade: stars exist only once the survey reaches their year
    float ig = smoothstep(aDelay, aDelay + 0.08, uIgnite);

    // sweep wavefront: stars flare as the ping crosses them
    float sw = 0.0;
    if (uSweepR >= 0.0) {
      float dd = abs(distance(pos, uSweepOrigin) - uSweepR);
      sw = exp(-dd * dd * 0.006);
    }

    // long exposure develops the faint dust
    float faint = 1.0 - smoothstep(1.8, 3.2, aSize);
    float ex = uExposure * faint;

    float isLock = step(abs(aIndex - uLock), 0.5);
    float isHover = step(abs(aIndex - uHover), 0.5);
    float keep = max(isLock, aCohort);
    float dim = 1.0 - uDim * (1.0 - keep);

    // lens: non-matching stars fall to a faint substrate (never deleted)
    if (uLensField > 0.5) {
      float val = uLensField < 1.5 ? aFilter.z : (uLensField < 2.5 ? aFilter.y : aFilter.x);
      float match = step(abs(val - uLensValue), 0.5);
      dim *= mix(0.10, 1.0, max(match, max(isLock, isHover)));
    }

    float tw = 1.0 + 0.18 * uMotion * sin(uTime * 1.7 + aTwinkle * 6.28318);
    float size = aSize * tw * (1.0 + ex * 1.5);
    size *= 1.0 + isHover * 0.55 + isLock * 0.9;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float px = clamp(size * (420.0 / -mv.z), 1.75, 160.0);
    vPx = px;
    gl_PointSize = px;
    gl_Position = projectionMatrix * mv;

    vColor = aColor;
    vRing = aRing;
    vFlare = aFlare;
    vBoost = (1.0 + sw * 2.4 + ex * 1.8) * dim * (1.0 + isHover * 0.6 + isLock * 0.8);
    vRingForce = max(isHover, isLock);
    vAlpha = dim * ig * (1.0 + ex * 0.8);
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vRing;
  varying float vFlare;
  varying float vPx;
  varying float vBoost;
  varying float vRingForce;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;

    float core = smoothstep(0.42, 0.0, d);
    float halo = smoothstep(1.0, 0.15, d) * 0.45;
    vec3 col = vColor * (core * 2.1 + halo) * vBoost;
    float alpha = (core + halo);

    float ringVis = max(smoothstep(13.0, 34.0, vPx), vRingForce);
    float ring = smoothstep(0.07, 0.0, abs(d - 0.62)) * ringVis;
    col += vRing * ring * 1.6;
    alpha = max(alpha, ring * 0.9);

    if (vFlare > 0.5) {
      float sx = pow(max(0.0, 1.0 - abs(uv.x) * 9.0), 2.0);
      float sy = pow(max(0.0, 1.0 - abs(uv.y) * 9.0), 2.0);
      float spike = (sx + sy) * smoothstep(1.0, 0.0, d) * 0.8;
      col += vColor * spike * vBoost;
      alpha = max(alpha, spike * 0.6);
    }

    gl_FragColor = vec4(col, alpha * vAlpha);
  }
`;

export class StarField {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly labels: LabelLayer;
  /** chrome subscribes here: hover / lock / release / sweep / expose / ignite / lockframe */
  readonly events = new EventTarget();

  /** true while a FlightMode instance owns this field; guards hover/label/tag work */
  flightActive = false;

  private points!: THREE.Points;
  private starMat!: THREE.ShaderMaterial;
  private geo!: THREE.BufferGeometry;
  private cohortAttr!: THREE.BufferAttribute;
  private bg!: ReturnType<typeof makeBackground>;
  private wisps!: ReturnType<typeof makeWisps>;
  private glow!: THREE.Mesh;
  private picker!: GpuPicker;
  private cohortLines!: THREE.LineSegments;
  private clock = new THREE.Clock();
  private raf = 0;
  private frame = 0;

  private stars: StarFields;
  private layouts: Record<LayoutName, Float32Array>;
  private sizes!: Float32Array;
  private delays!: Float32Array;
  private currentLayout: LayoutName = 'spiral';
  private morphing = false;
  private spin = 1;

  // verb state
  private lockedIndex = -1;
  private hoverIndex = -1;
  private exposing = false;
  private exposeStart = 0;
  private down: { x: number; y: number; t: number; moved: boolean } | null = null;
  private holdTimer = 0;

  private v3 = new THREE.Vector3();
  private ray = new THREE.Raycaster();

  /** labels.enabled state saved by beginFlight, restored by endFlight */
  private _labelsEnabledBeforeFlight = false;

  private tags!: ProjectedTagLayer;
  private placardDefs: { center: [number, number, number]; title: string; sub: string }[] = [];
  private markers!: ChartMarkers;

  /** prefers-reduced-motion: instant ignition, short crossfade morphs, no twinkle/spin */
  readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** coarse pointers (phones/tablets): skip post FX, lower DPR cap */
  readonly lowPower = window.matchMedia('(pointer: coarse)').matches;
  private composer: EffectComposer | null = null;

  /** clamp animation durations under reduced motion */
  private dur(seconds: number): number {
    return this.reducedMotion ? Math.min(seconds, 0.4) : seconds;
  }

  constructor(canvas: HTMLCanvasElement, stars: StarFields) {
    this.stars = stars;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lowPower ? 1.5 : 2));
    this.renderer.setClearColor('#08090d');

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 6000);
    this.camera.position.set(...CAMERA_PRESETS.spiral.pos);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 2200;

    this.layouts = {
      spiral: galaxySpiral(stars),
      shells: expandingUniverse(stars),
      tunnel: timeTunnel(stars),
      constellations: constellations(stars),
    };

    this.labels = new LabelLayer(canvas.parentElement ?? document.body);
    this.tags = new ProjectedTagLayer(canvas.parentElement ?? document.body);
    this.placardDefs = stars.meta.realities.map((r, k) => ({
      center: CENTERS[Math.min(k, CENTERS.length - 1)],
      title: r.name.toUpperCase(),
      sub: r.count >= 1000 ? `${r.count.toLocaleString()} SOULS` : `DWARF REALITY · ${r.count}`,
    }));

    this.buildAtmosphere();
    this.buildPoints(stars);
    this.markers = new ChartMarkers();
    this.points.add(this.markers.group); // inherits field spin like the cohort lines
    this.picker = new GpuPicker(this.geo);
    this.buildPost();
    this.bindPointer(canvas);
    this.onResize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    if (this.reducedMotion) this.spin = 0;
    this.ignite();
    this.loop();

    // test/debug hook — lets Playwright locate stars deterministically
    (window as unknown as Record<string, unknown>).__paperSky = this;
  }

  // ---------- construction ----------

  /** halation + grain + vignette — the survey-plate finish (skipped on low power) */
  private buildPost() {
    if (this.lowPower) return;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new BloomEffect({
      intensity: 0.72,
      luminanceThreshold: 0.32, // stars bloom; the nebula haze must not
      luminanceSmoothing: 0.22,
      mipmapBlur: true,
    });
    const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    grain.blendMode.opacity.value = 0.28;
    const vignette = new VignetteEffect({ darkness: 0.46, offset: 0.28 });
    this.composer.addPass(new EffectPass(this.camera, bloom, grain, vignette));
  }

  private buildAtmosphere() {
    this.bg = makeBackground();
    this.scene.add(this.bg.mesh);
    this.glow = makeCoreGlow();
    this.scene.add(this.glow);
    this.wisps = makeWisps((year, universe, j1, j2) => armPoint(year, universe, j1, j2));
    this.scene.add(this.wisps.points);
  }

  private buildPoints(stars: StarFields) {
    const n = stars.count;
    const colors = new Float32Array(n * 3);
    const rings = new Float32Array(n * 3);
    this.sizes = new Float32Array(n);
    this.delays = new Float32Array(n);
    const flares = new Float32Array(n);
    const twinkles = new Float32Array(n);
    const indices = new Float32Array(n);
    const filters = new Float32Array(n * 3);

    const ringColor = new THREE.Color();
    const GOLDEN = 0.6180339887498949;

    for (let i = 0; i < n; i++) {
      const c = stars.universe[i] === 0 ? MARVEL : DC;
      const dim = stars.alive[i] === 1 ? 0.45 : 1.0;
      colors[i * 3] = c.r * dim;
      colors[i * 3 + 1] = c.g * dim;
      colors[i * 3 + 2] = c.b * dim;

      ringColor.setHSL((i * GOLDEN) % 1, 0.85, 0.62);
      rings[i * 3] = ringColor.r;
      rings[i * 3 + 1] = ringColor.g;
      rings[i * 3 + 2] = ringColor.b;

      const app = stars.appearances[i] === NA_APPEARANCES ? 1 : stars.appearances[i];
      this.sizes[i] = 1.3 + Math.log1p(app) * 0.95;
      flares[i] = app >= FLARE_THRESHOLD ? 1 : 0;
      twinkles[i] = (((i * 2654435761) >>> 8) % 1000) / 1000;
      indices[i] = i;
      this.delays[i] =
        stars.year[i] === NA_YEAR ? 1 : (stars.year[i] - 1935) / (2013 - 1935);
      // lens facets; 99 = unrecorded, matches nothing, dims honestly
      filters[i * 3] = stars.universe[i];
      filters[i * 3 + 1] = stars.align[i] === 255 ? 99 : stars.align[i];
      filters[i * 3 + 2] = stars.alive[i] === 255 ? 99 : stars.alive[i];
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.layouts.spiral.slice(), 3));
    // own copy — aliasing the stored layout would corrupt return morphs
    this.geo.setAttribute('aTarget', new THREE.BufferAttribute(this.layouts.spiral.slice(), 3));
    this.geo.setAttribute('aDelay', new THREE.BufferAttribute(this.delays, 1));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    this.geo.setAttribute('aRing', new THREE.BufferAttribute(rings, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geo.setAttribute('aFlare', new THREE.BufferAttribute(flares, 1));
    this.geo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1));
    this.geo.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1));
    this.geo.setAttribute('aFilter', new THREE.BufferAttribute(filters, 3));
    this.cohortAttr = new THREE.BufferAttribute(new Float32Array(n), 1);
    this.geo.setAttribute('aCohort', this.cohortAttr);
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3000);

    this.starMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uMix: { value: 1 },
        uIgnite: { value: 0 },
        uHover: { value: -1 },
        uLock: { value: -1 },
        uDim: { value: 0 },
        uSweepR: { value: -1 },
        uSweepOrigin: { value: new THREE.Vector3() },
        uExposure: { value: 0 },
        uLensField: { value: 0 },
        uLensValue: { value: 0 },
        uMotion: { value: this.reducedMotion ? 0 : 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geo, this.starMat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    // cohort hairlines (built once, repositioned per lock)
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(COHORT_MAX * 2 * 3), 3),
    );
    const lineMat = new THREE.LineBasicMaterial({
      color: '#ff5c49',
      transparent: true,
      opacity: 0,
    });
    this.cohortLines = new THREE.LineSegments(lineGeo, lineMat);
    this.cohortLines.visible = false;
    this.points.add(this.cohortLines); // child of points → inherits field rotation

    // percentile support: appearances sorted desc, once
    this.sortedApps = Float64Array.from(stars.appearances).filter(
      (v) => v !== NA_APPEARANCES,
    ) as unknown as Float64Array;
    (this.sortedApps as unknown as number[]).sort?.call(this.sortedApps, (a: number, b: number) => b - a);
  }

  private sortedApps!: Float64Array;

  // ---------- ignition ----------

  private ignite() {
    const u = this.starMat.uniforms.uIgnite;
    if (this.reducedMotion) {
      u.value = 1;
      // constructor runs before React subscribes — defer past this task
      queueMicrotask(() => this.emit('ignite', { progress: 1 }));
      return;
    }
    gsap.to(u, {
      value: 1,
      duration: 2.6,
      ease: 'none',
      onUpdate: () => this.emit('ignite', { progress: u.value as number }),
      onComplete: () => this.emit('ignite', { progress: 1 }),
    });
  }

  // ---------- lenses ----------

  setLens(lens: Lens) {
    const fieldCode = { none: 0, fate: 1, class: 2, universe: 3 }[lens.field];
    gsap.to(this.starMat.uniforms.uLensField, {
      value: fieldCode,
      duration: 0.01,
    });
    this.starMat.uniforms.uLensValue.value = lens.value;
  }

  // ---------- events ----------

  private emit(type: string, detail: unknown) {
    this.events.dispatchEvent(new CustomEvent(type, { detail }));
  }

  // ---------- geometry helpers ----------

  /** evaluated layout-space position of star i (matches the shader's mix) */
  private evalPosition(i: number, out: THREE.Vector3): THREE.Vector3 {
    const pos = this.geo.getAttribute('position').array as Float32Array;
    const tgt = this.geo.getAttribute('aTarget').array as Float32Array;
    const mixV = this.starMat.uniforms.uMix.value as number;
    let p = Math.min(1, Math.max(0, mixV * (1 + STAGGER) - this.delays[i] * STAGGER));
    p = p * p * (3 - 2 * p);
    return out.set(
      pos[i * 3] + (tgt[i * 3] - pos[i * 3]) * p,
      pos[i * 3 + 1] + (tgt[i * 3 + 1] - pos[i * 3 + 1]) * p,
      pos[i * 3 + 2] + (tgt[i * 3 + 2] - pos[i * 3 + 2]) * p,
    );
  }

  /** layout-space → world (apply field spin) */
  private toWorld(v: THREE.Vector3): THREE.Vector3 {
    return v.applyAxisAngle(UP, this.points.rotation.y);
  }

  /** screen position + projected px size of star i (css px) */
  screenPosOf(i: number): { x: number; y: number; px: number } | null {
    this.evalPosition(i, this.v3);
    this.toWorld(this.v3);
    const dist = this.v3.distanceTo(this.camera.position);
    const px = Math.min(160, Math.max(1.75, this.sizes[i] * (420 / dist)));
    this.v3.project(this.camera);
    if (this.v3.z > 1) return null;
    return {
      x: (this.v3.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.v3.y * 0.5 + 0.5) * window.innerHeight,
      px,
    };
  }

  // ---------- pointer arbiter ----------

  private bindPointer(canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', (e) => {
      if (this.flightActive) return;
      this.down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      // stationary hold ⇒ EXPOSE
      this.holdTimer = window.setTimeout(() => {
        if (this.down && !this.down.moved && this.lockedIndex < 0) this.beginExpose();
      }, 300);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (this.flightActive) return;
      if (this.down) {
        const dx = e.clientX - this.down.x;
        const dy = e.clientY - this.down.y;
        if (dx * dx + dy * dy > 36) {
          this.down.moved = true;
          window.clearTimeout(this.holdTimer);
          if (this.exposing) this.endExpose();
        }
      }
      // hover (throttled via frame counter in loop)
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
    });

    canvas.addEventListener('pointerup', (e) => {
      if (this.flightActive) return;
      window.clearTimeout(this.holdTimer);
      const wasExposing = this.exposing;
      if (wasExposing) this.endExpose();
      const d = this.down;
      this.down = null;
      if (!d || d.moved || wasExposing) return;
      if (performance.now() - d.t > 420) return;

      const hit = this.pickAt(e.clientX, e.clientY);
      if (hit >= 0) {
        this.lock(hit);
      } else if (this.lockedIndex >= 0) {
        this.release();
      } else {
        this.sweep(e.clientX, e.clientY);
      }
    });

    canvas.addEventListener('pointerleave', () => {
      if (this.flightActive) return;
      this.setHover(-1);
    });
  }

  private pointerX = -1;
  private pointerY = -1;

  /** star index under css pixel, or -1 — shared by the arbiter, hover, tests */
  pickAt(x: number, y: number): number {
    return this.picker.pick(
      this.renderer,
      this.camera,
      this.points.rotation.y,
      this.starMat.uniforms.uMix.value as number,
      x,
      y,
    );
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (this.flightActive) return; // flight handles its own ESC
    if (this.lockedIndex >= 0) this.release();
    else if ((this.starMat.uniforms.uLensField.value as number) > 0) this.emit('escape', null);
  };

  private setHover(i: number) {
    if (i === this.hoverIndex) return;
    this.hoverIndex = i;
    this.starMat.uniforms.uHover.value = i;
    const sp = i >= 0 ? this.screenPosOf(i) : null;
    this.emit('hover', i >= 0 && sp ? { index: i, ...sp } : null);
  }

  // ---------- SWEEP ----------

  sweep(cx: number, cy: number) {
    // 3D origin: the point on the click ray at focal distance, in layout space
    const ndc = new THREE.Vector2(
      (cx / window.innerWidth) * 2 - 1,
      -(cy / window.innerHeight) * 2 + 1,
    );
    this.ray.setFromCamera(ndc, this.camera);
    const focal = this.camera.position.distanceTo(this.controls.target);
    const origin = this.ray.ray.at(focal, new THREE.Vector3());
    origin.applyAxisAngle(UP, -this.points.rotation.y); // world → layout space

    (this.starMat.uniforms.uSweepOrigin.value as THREE.Vector3).copy(origin);
    const u = this.starMat.uniforms.uSweepR;
    u.value = 0;
    gsap.to(u, {
      value: 380,
      duration: 1.5,
      ease: 'power1.out',
      onComplete: () => (u.value = -1),
    });

    // census within radius
    const census = this.census(origin, SWEEP_RADIUS);
    this.emit('sweep', { census, x: cx, y: cy });
  }

  private census(origin: THREE.Vector3, radius: number): SweepCensus {
    const r2 = radius * radius;
    let count = 0;
    let marvel = 0;
    const years: number[] = [];
    const top: number[] = []; // indices, appearances desc, max 5
    const v = new THREE.Vector3();
    for (let i = 0; i < this.stars.count; i++) {
      this.evalPosition(i, v);
      const dx = v.x - origin.x;
      const dy = v.y - origin.y;
      const dz = v.z - origin.z;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      count++;
      if (this.stars.universe[i] === 0) marvel++;
      if (this.stars.year[i] !== NA_YEAR) years.push(this.stars.year[i]);
      const app = this.stars.appearances[i];
      if (app !== NA_APPEARANCES) {
        let k = top.length;
        while (k > 0 && this.stars.appearances[top[k - 1]] < app) k--;
        if (k < 5) {
          top.splice(k, 0, i);
          if (top.length > 5) top.pop();
        }
      }
    }
    years.sort((a, b) => a - b);
    return {
      count,
      marvelPct: count ? (marvel / count) * 100 : 0,
      medianYear: years.length ? years[Math.floor(years.length / 2)] : 0,
      brightestIndex: top[0] ?? -1,
      brightestApp: top.length ? this.stars.appearances[top[0]] : -1,
      topIndices: top,
    };
  }

  // ---------- LOCK ----------

  get locked(): number {
    return this.lockedIndex;
  }

  lock(i: number) {
    if (this.lockedIndex === i) return;
    this.lockedIndex = i;
    this.starMat.uniforms.uLock.value = i;
    this.markers.group.visible = false;
    gsap.to(this.starMat.uniforms.uDim, { value: 0.68, duration: 0.9 });

    // cohort: same universe + same debut year, nearest by index distance
    const cohort = this.findCohort(i);
    const mask = this.cohortAttr.array as Float32Array;
    mask.fill(0);
    for (const c of cohort) mask[c] = 1;
    this.cohortAttr.needsUpdate = true;
    this.positionCohortLines(i, cohort);

    // camera: fly to frame the star left-of-center
    const star = this.evalPosition(i, new THREE.Vector3());
    this.toWorld(star);
    const dir = this.camera.position.clone().sub(star).normalize();
    const camPos = star.clone().add(dir.multiplyScalar(34));
    camPos.y += 5;
    const right = new THREE.Vector3()
      .crossVectors(this.camera.getWorldDirection(new THREE.Vector3()), UP)
      .normalize();
    const target = star.clone().add(right.multiplyScalar(7)); // pushes star to left third

    this.controls.enabled = false;
    gsap.to(this.camera.position, {
      x: camPos.x, y: camPos.y, z: camPos.z,
      duration: this.dur(1.4), ease: 'power3.inOut',
    });
    gsap.to(this.controls.target, {
      x: target.x, y: target.y, z: target.z,
      duration: this.dur(1.4), ease: 'power3.inOut',
      onComplete: () => (this.controls.enabled = true),
    });

    const lineMat = this.cohortLines.material as THREE.LineBasicMaterial;
    this.cohortLines.visible = true;
    gsap.to(lineMat, { opacity: 0.4, duration: 1.2, delay: 0.5 });

    this.emit('lock', { index: i, cohort } satisfies LockInfo);
  }

  release() {
    if (this.lockedIndex < 0) return;
    this.lockedIndex = -1;
    this.starMat.uniforms.uLock.value = -1;
    this.markers.group.visible = true;
    gsap.to(this.starMat.uniforms.uDim, { value: 0, duration: 0.7 });
    const lineMat = this.cohortLines.material as THREE.LineBasicMaterial;
    gsap.to(lineMat, {
      opacity: 0,
      duration: 0.4,
      onComplete: () => (this.cohortLines.visible = false),
    });
    (this.cohortAttr.array as Float32Array).fill(0);
    this.cohortAttr.needsUpdate = true;

    // ease back to the layout's home vantage
    const preset = CAMERA_PRESETS[this.currentLayout];
    this.controls.enabled = false;
    gsap.to(this.camera.position, {
      x: preset.pos[0], y: preset.pos[1], z: preset.pos[2],
      duration: this.dur(1.2), ease: 'power3.inOut',
    });
    gsap.to(this.controls.target, {
      x: preset.target[0], y: preset.target[1], z: preset.target[2],
      duration: this.dur(1.2), ease: 'power3.inOut',
      onComplete: () => (this.controls.enabled = true),
    });

    this.emit('release', null);
  }

  private findCohort(i: number): number[] {
    const year = this.stars.year[i];
    const uni = this.stars.universe[i];
    if (year === NA_YEAR) return [];
    const out: number[] = [];
    // scan outward from i so "nearest" cohort members are catalog-adjacent
    for (let d = 1; d < this.stars.count && out.length < COHORT_MAX; d++) {
      const a = i - d;
      const b = i + d;
      if (a >= 0 && this.stars.year[a] === year && this.stars.universe[a] === uni) out.push(a);
      if (out.length >= COHORT_MAX) break;
      if (b < this.stars.count && this.stars.year[b] === year && this.stars.universe[b] === uni)
        out.push(b);
      if (a < 0 && b >= this.stars.count) break;
    }
    return out;
  }

  private positionCohortLines(i: number, cohort: number[]) {
    const arr = this.cohortLines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const data = arr.array as Float32Array;
    const from = this.evalPosition(i, new THREE.Vector3());
    const v = new THREE.Vector3();
    for (let k = 0; k < COHORT_MAX; k++) {
      const j = cohort[k];
      const o = k * 6;
      if (j === undefined) {
        data[o] = data[o + 3] = from.x;
        data[o + 1] = data[o + 4] = from.y;
        data[o + 2] = data[o + 5] = from.z;
        continue;
      }
      this.evalPosition(j, v);
      data[o] = from.x; data[o + 1] = from.y; data[o + 2] = from.z;
      data[o + 3] = v.x; data[o + 4] = v.y; data[o + 5] = v.z;
    }
    arr.needsUpdate = true;
  }

  /** "brighter than X% of the sky" = fraction with STRICTLY fewer appearances
   * (so even the brightest star never claims to outshine itself) */
  percentileOf(i: number): number {
    const app = this.stars.appearances[i];
    if (app === NA_APPEARANCES) return 0;
    const arr = this.sortedApps; // desc
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] >= app) lo = mid + 1;
      else hi = mid;
    }
    return ((arr.length - lo) / arr.length) * 100;
  }

  // ---------- EXPOSE ----------

  private beginExpose() {
    this.exposing = true;
    this.exposeStart = performance.now();
    gsap.killTweensOf(this.starMat.uniforms.uExposure);
    gsap.to(this.starMat.uniforms.uExposure, { value: 1, duration: 2.4, ease: 'power1.in' });
    this.emit('expose', { active: true, seconds: 0 });
  }

  private endExpose() {
    if (!this.exposing) return;
    this.exposing = false;
    gsap.killTweensOf(this.starMat.uniforms.uExposure);
    gsap.to(this.starMat.uniforms.uExposure, { value: 0, duration: 5, ease: 'power2.out' });
    this.emit('expose', { active: false, seconds: 0 });
  }

  // ---------- layout morphing ----------

  get layout(): LayoutName {
    return this.currentLayout;
  }

  setLayout(name: LayoutName) {
    if (name === this.currentLayout || this.morphing) return;
    if (this.lockedIndex >= 0) this.release();
    this.morphing = true;

    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const tgt = this.geo.getAttribute('aTarget') as THREE.BufferAttribute;
    (pos.array as Float32Array).set(tgt.array as Float32Array);
    pos.needsUpdate = true;
    (tgt.array as Float32Array).set(this.layouts[name]);
    tgt.needsUpdate = true;

    this.starMat.uniforms.uMix.value = 0;
    this.currentLayout = name;
    this.markers.group.visible = false;

    const preset = CAMERA_PRESETS[name];
    const dur = this.dur(MORPH_SECONDS);

    gsap.to(this.starMat.uniforms.uMix, {
      value: 1, duration: dur, ease: 'power2.inOut',
      onComplete: () => {
        this.morphing = false;
        this.markers.setLayout(name);
        this.markers.group.visible = true;
      },
    });
    gsap.to(this.camera.position, { x: preset.pos[0], y: preset.pos[1], z: preset.pos[2], duration: dur, ease: 'power3.inOut' });
    gsap.to(this.controls.target, { x: preset.target[0], y: preset.target[1], z: preset.target[2], duration: dur, ease: 'power3.inOut' });

    const wispFade = (this.wisps.points.material as THREE.ShaderMaterial).uniforms.uFade;
    const glowFade = (this.glow.material as THREE.ShaderMaterial).uniforms.uFade;
    gsap.to(wispFade, { value: preset.wisps, duration: dur * 0.7 });
    gsap.to(glowFade, { value: preset.glow, duration: dur * 0.7 });
    gsap.to(this, { spin: name === 'spiral' ? 1 : 0, duration: dur * 0.5 });
  }

  // ---------- flight hooks ----------

  /** Return the raw layout Float32Array for the named layout.
   * FlightMode uses this to seed NearBodies with the correct position buffer. */
  layoutPositionsFor(name: LayoutName): Float32Array {
    return this.layouts[name];
  }

  /** Called by FlightMode on launch. Suspends all survey interactivity so the
   * flight loop can own the scene without interference. */
  beginFlight(): void {
    this.flightActive = true;
    // release any existing star lock silently (no camera tween needed; flight will move it)
    if (this.lockedIndex >= 0) {
      this.lockedIndex = -1;
      this.starMat.uniforms.uLock.value = -1;
      gsap.to(this.starMat.uniforms.uDim, { value: 0, duration: 0.3 });
      const lineMat = this.cohortLines.material as THREE.LineBasicMaterial;
      lineMat.opacity = 0;
      this.cohortLines.visible = false;
      (this.cohortAttr.array as Float32Array).fill(0);
      this.cohortAttr.needsUpdate = true;
    }
    this.controls.enabled = false;
    this._labelsEnabledBeforeFlight = this.labels.enabled;
    this.labels.setEnabled(false);
    this.tags.clear();
    this.markers.group.visible = false;
    this.spin = 0;
  }

  /** Called by FlightMode on exit. Restores survey interactivity and tweens the
   * camera back to the current layout's home preset (mirrors the release() pattern). */
  endFlight(): void {
    this.controls.enabled = false; // keep disabled until tween finishes
    this.labels.setEnabled(this._labelsEnabledBeforeFlight);
    // restore spin: spiral spins, all others are static (mirrors setLayout)
    this.spin = this.currentLayout === 'spiral' ? (this.reducedMotion ? 0 : 1) : 0;
    // markers re-shown only after morph is settled (same as setLayout/release)
    this.markers.setLayout(this.currentLayout);
    this.markers.group.visible = true;
    const preset = CAMERA_PRESETS[this.currentLayout];
    gsap.to(this.camera.position, {
      x: preset.pos[0], y: preset.pos[1], z: preset.pos[2],
      duration: this.dur(1.2), ease: 'power3.inOut',
    });
    gsap.to(this.controls.target, {
      x: preset.target[0], y: preset.target[1], z: preset.target[2],
      duration: this.dur(1.2), ease: 'power3.inOut',
      onComplete: () => (this.controls.enabled = true),
    });
    this.flightActive = false;
  }

  // ---------- labels ----------

  private collectLabelCandidates(): { index: number; x: number; y: number; px: number }[] {
    const out: { index: number; x: number; y: number; px: number }[] = [];
    const w = window.innerWidth;
    const h = window.innerHeight;
    const v = this.v3;
    for (let i = 0; i < this.stars.count; i++) {
      this.evalPosition(i, v);
      this.toWorld(v);
      const dist = v.distanceTo(this.camera.position);
      const px = Math.min(160, Math.max(1.75, this.sizes[i] * (420 / dist)));
      if (px < LabelLayer.MIN_PX) continue;
      v.project(this.camera);
      if (v.z > 1 || v.z < -1) continue;
      if (Math.abs(v.x) > 0.96 || Math.abs(v.y) > 0.96) continue;
      out.push({ index: i, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, px });
    }
    return out;
  }

  /** placards (constellations) / epoch tags (other layouts) — hidden while
   * locked or mid-morph so the dossier and the ripple own the stage */
  private updateChartTags() {
    const mixDone = (this.starMat.uniforms.uMix.value as number) >= 0.99;
    if (this.lockedIndex >= 0 || !mixDone) {
      this.tags.clear();
      return;
    }
    const out: PlacedTag[] = [];
    const v = this.v3;
    if (this.currentLayout === 'constellations') {
      for (const p of this.placardDefs) {
        v.set(p.center[0], p.center[1], p.center[2]);
        this.toWorld(v);
        const dist = v.distanceTo(this.camera.position);
        v.project(this.camera);
        if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
        out.push({
          x: (v.x * 0.5 + 0.5) * window.innerWidth,
          y: (-v.y * 0.5 + 0.5) * window.innerHeight - 14,
          opacity: Math.max(0.3, Math.min(0.95, 1.25 - dist / 1400)),
          title: p.title,
          sub: p.sub,
          hairline: true,
        });
      }
    } else {
      for (const t of this.markers.tagsFor(this.currentLayout)) {
        v.set(t.pos[0], t.pos[1], t.pos[2]);
        this.toWorld(v);
        v.project(this.camera);
        if (v.z > 1 || Math.abs(v.x) > 1.02 || Math.abs(v.y) > 1.02) continue;
        out.push({
          x: (v.x * 0.5 + 0.5) * window.innerWidth,
          y: (-v.y * 0.5 + 0.5) * window.innerHeight,
          opacity: 0.7,
          title: t.title,
        });
      }
    }
    this.tags.update(out);
  }

  // ---------- frame loop ----------

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  };

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const t = this.clock.getElapsedTime();
    this.frame++;

    this.points.rotation.y += 0.00012 * this.spin;
    this.wisps.points.rotation.y = this.points.rotation.y;

    this.starMat.uniforms.uTime.value = t;
    this.bg.update(t);
    this.wisps.update(t);
    this.controls.update();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);

    if (!this.flightActive && this.labels.enabled && this.frame % 3 === 0 && this.lockedIndex < 0) {
      this.labels.update(this.collectLabelCandidates());
    }

    if (!this.flightActive && this.frame % 3 === 1) this.updateChartTags();

    // hover picking, throttled; suppressed while exposing or mid-press
    if (!this.flightActive && this.frame % 6 === 0 && this.pointerX >= 0 && !this.exposing && !this.down) {
      this.setHover(this.pickAt(this.pointerX, this.pointerY));
    }

    // expose live counter
    if (this.exposing && this.frame % 6 === 0) {
      this.emit('expose', {
        active: true,
        seconds: (performance.now() - this.exposeStart) / 1000,
      });
    }

    // dossier anchor stream
    if (this.lockedIndex >= 0 && this.frame % 2 === 0) {
      const sp = this.screenPosOf(this.lockedIndex);
      if (sp) this.emit('lockframe', sp);
    }
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    this.controls.dispose();
    this.labels.dispose();
    this.tags.dispose();
    this.picker.dispose();
    this.composer?.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.renderer.dispose();
    delete (window as unknown as Record<string, unknown>).__paperSky;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
