/** The star field — one Points system holding all 23,272 characters.
 *
 * Morph engine: two position buffers (position = from, aTarget = to) blended in
 * the vertex shader by uMix, staggered per-star by debut year (aDelay) so every
 * layout change ripples through time. GSAP animates one uniform; the GPU does
 * the rest. Atmosphere layers (nebula/core/wisps) fade per layout.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { StarFields } from '../data/parser';
import { NA_APPEARANCES, NA_YEAR } from '../data/parser';
import { galaxySpiral, armPoint } from './layouts/spiral';
import { expandingUniverse } from './layouts/shells';
import { timeTunnel, TUNNEL_LENGTH } from './layouts/tunnel';
import { constellations } from './layouts/constellations';
import { makeBackground, makeCoreGlow, makeWisps } from './nebula';
import { LabelLayer } from './labels';

const MARVEL = new THREE.Color('#ff4438');
const DC = new THREE.Color('#4595ff');
const FLARE_THRESHOLD = 1200;
const MORPH_SECONDS = 2.2;
const STAGGER = 0.35; // fraction of the morph spent rippling through years

export type LayoutName = 'spiral' | 'shells' | 'tunnel' | 'constellations';

interface CameraPreset {
  pos: [number, number, number];
  target: [number, number, number];
  /** which atmosphere layers belong to this sky */
  wisps: number;
  glow: number;
}

const CAMERA_PRESETS: Record<LayoutName, CameraPreset> = {
  spiral: { pos: [0, 110, 300], target: [0, 0, 0], wisps: 1, glow: 1 },
  shells: { pos: [0, 150, 540], target: [0, 0, 0], wisps: 0, glow: 1 },
  // off-axis + slightly inside the bore so the corridor stretches away in depth
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
  uniform float uTime;
  uniform float uMix;
  varying vec3 vColor;
  varying vec3 vRing;
  varying float vFlare;
  varying float vPx;
  void main() {
    // year-staggered morph: early debuts move first, the ripple crosses 8 decades
    float p = clamp((uMix * (1.0 + ${STAGGER}) - aDelay * ${STAGGER}), 0.0, 1.0);
    p = p * p * (3.0 - 2.0 * p);
    vec3 pos = mix(position, aTarget, p);

    vColor = aColor;
    vRing = aRing;
    vFlare = aFlare;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float tw = 1.0 + 0.18 * sin(uTime * 1.7 + aTwinkle * 6.28318);
    float px = aSize * tw * (420.0 / -mv.z);
    px = clamp(px, 1.75, 160.0);
    vPx = px;
    gl_PointSize = px;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vRing;
  varying float vFlare;
  varying float vPx;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;

    float core = smoothstep(0.42, 0.0, d);
    float halo = smoothstep(1.0, 0.15, d) * 0.45;
    vec3 col = vColor * (core * 2.1 + halo);
    float alpha = core + halo;

    // identity ring — resolves only when the star is large enough to be seen
    float ringVis = smoothstep(13.0, 34.0, vPx);
    float ring = smoothstep(0.07, 0.0, abs(d - 0.62)) * ringVis;
    col += vRing * ring * 1.6;
    alpha = max(alpha, ring * 0.9);

    if (vFlare > 0.5) {
      float sx = pow(max(0.0, 1.0 - abs(uv.x) * 9.0), 2.0);
      float sy = pow(max(0.0, 1.0 - abs(uv.y) * 9.0), 2.0);
      float spike = (sx + sy) * smoothstep(1.0, 0.0, d) * 0.8;
      col += vColor * spike;
      alpha = max(alpha, spike * 0.6);
    }

    gl_FragColor = vec4(col, alpha);
  }
`;

export class StarField {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly labels: LabelLayer;

  private points!: THREE.Points;
  private starMat!: THREE.ShaderMaterial;
  private geo!: THREE.BufferGeometry;
  private bg!: ReturnType<typeof makeBackground>;
  private wisps!: ReturnType<typeof makeWisps>;
  private glow!: THREE.Mesh;
  private clock = new THREE.Clock();
  private raf = 0;
  private frame = 0;

  private stars: StarFields;
  private layouts: Record<LayoutName, Float32Array>;
  private sizes!: Float32Array;
  private delays!: Float32Array;
  private currentLayout: LayoutName = 'spiral';
  private morphing = false;
  /** spin applies only to the spiral sky (a galaxy turns; a tunnel doesn't) */
  private spin = 1;

  // scratch
  private v3 = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, stars: StarFields) {
    this.stars = stars;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    this.buildAtmosphere();
    this.buildPoints(stars);
    this.onResize();
    window.addEventListener('resize', this.onResize);
    this.loop();
  }

  // ---------- construction ----------

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
      this.delays[i] =
        stars.year[i] === NA_YEAR ? 1 : (stars.year[i] - 1935) / (2013 - 1935);
    }

    this.geo = new THREE.BufferGeometry();
    const from = this.layouts.spiral.slice();
    this.geo.setAttribute('position', new THREE.BufferAttribute(from, 3));
    // own copy — aliasing this.layouts.spiral here would let setLayout()
    // overwrite the stored layout and corrupt every return trip to spiral
    this.geo.setAttribute('aTarget', new THREE.BufferAttribute(this.layouts.spiral.slice(), 3));
    this.geo.setAttribute('aDelay', new THREE.BufferAttribute(this.delays, 1));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    this.geo.setAttribute('aRing', new THREE.BufferAttribute(rings, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geo.setAttribute('aFlare', new THREE.BufferAttribute(flares, 1));
    this.geo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3000); // skip recompute

    this.starMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uTime: { value: 0 }, uMix: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geo, this.starMat);
    this.scene.add(this.points);
  }

  // ---------- layout morphing ----------

  get layout(): LayoutName {
    return this.currentLayout;
  }

  setLayout(name: LayoutName) {
    if (name === this.currentLayout || this.morphing) return;
    this.morphing = true;

    // freeze current evaluated positions into `position` (handles mid-flight
    // simplicity: we only allow morphs from a settled state, uMix is 1)
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const tgt = this.geo.getAttribute('aTarget') as THREE.BufferAttribute;
    (pos.array as Float32Array).set(tgt.array as Float32Array);
    pos.needsUpdate = true;
    (tgt.array as Float32Array).set(this.layouts[name]);
    tgt.needsUpdate = true;

    this.starMat.uniforms.uMix.value = 0;
    this.currentLayout = name;

    const preset = CAMERA_PRESETS[name];
    const dur = MORPH_SECONDS;

    gsap.to(this.starMat.uniforms.uMix, { value: 1, duration: dur, ease: 'power2.inOut', onComplete: () => (this.morphing = false) });
    gsap.to(this.camera.position, { x: preset.pos[0], y: preset.pos[1], z: preset.pos[2], duration: dur, ease: 'power3.inOut' });
    gsap.to(this.controls.target, { x: preset.target[0], y: preset.target[1], z: preset.target[2], duration: dur, ease: 'power3.inOut' });

    // atmosphere belongs to specific skies
    const wispMat = (this.wisps.points.material as THREE.ShaderMaterial).uniforms.uFade;
    const glowMat = ((this.glow.material as THREE.ShaderMaterial).uniforms as { uFade: { value: number } }).uFade;
    gsap.to(wispMat, { value: preset.wisps, duration: dur * 0.7 });
    gsap.to(glowMat, { value: preset.glow, duration: dur * 0.7 });

    // a galaxy turns; the other skies hold still
    gsap.to(this, { spin: name === 'spiral' ? 1 : 0, duration: dur * 0.5 });
  }

  // ---------- labels ----------

  async enableNames(): Promise<void> {
    if (!this.labels.enabled) this.labels.setEnabled(true);
  }

  /** project + cull: candidates whose on-screen size clears the threshold */
  private collectLabelCandidates(): { index: number; x: number; y: number; px: number }[] {
    const out: { index: number; x: number; y: number; px: number }[] = [];
    const pos = this.geo.getAttribute('position').array as Float32Array;
    const tgt = this.geo.getAttribute('aTarget').array as Float32Array;
    const mixV = this.starMat.uniforms.uMix.value as number;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rotY = this.points.rotation.y;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);

    for (let i = 0; i < this.stars.count; i++) {
      // same easing as the shader so labels track during morphs
      let p = Math.min(1, Math.max(0, mixV * (1 + STAGGER) - this.delays[i] * STAGGER));
      p = p * p * (3 - 2 * p);
      const x0 = pos[i * 3] + (tgt[i * 3] - pos[i * 3]) * p;
      const y0 = pos[i * 3 + 1] + (tgt[i * 3 + 1] - pos[i * 3 + 1]) * p;
      const z0 = pos[i * 3 + 2] + (tgt[i * 3 + 2] - pos[i * 3 + 2]) * p;

      // apply the field's idle Y-rotation
      const wx = x0 * cos + z0 * sin;
      const wz = -x0 * sin + z0 * cos;

      this.v3.set(wx, y0, wz);
      const dist = this.v3.distanceTo(this.camera.position);
      const px = Math.min(160, Math.max(1.75, this.sizes[i] * (420 / dist)));
      if (px < LabelLayer.MIN_PX) continue;

      this.v3.project(this.camera);
      if (this.v3.z > 1 || this.v3.z < -1) continue;
      if (Math.abs(this.v3.x) > 0.96 || Math.abs(this.v3.y) > 0.96) continue;

      out.push({
        index: i,
        x: (this.v3.x * 0.5 + 0.5) * w,
        y: (-this.v3.y * 0.5 + 0.5) * h,
        px,
      });
    }
    return out;
  }

  // ---------- frame loop ----------

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
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
    this.renderer.render(this.scene, this.camera);

    if (this.labels.enabled && this.frame % 3 === 0) {
      this.labels.update(this.collectLabelCandidates());
    }
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.labels.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.renderer.dispose();
  }
}
