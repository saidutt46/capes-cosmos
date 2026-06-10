/** The star field — one Points system holding all 23,272 characters.
 *
 * Visual grammar:
 *  - core color = universe emission (Marvel red / DC blue), deceased dim to embers
 *  - size/brightness = appearances (power law: a few suns, vast dust)
 *  - every star carries a UNIQUE identity hue, rendered as a thin ring around
 *    its core — invisible at field scale, resolves as you fly close (LOD in-shader)
 *  - the brightest objects (>1200 obs) get diffraction spikes, like overexposed
 *    stars on a survey plate
 * Atmosphere (nebula.ts): deep-space FBM background, galactic core glow, arm wisps.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { StarFields } from '../data/parser';
import { NA_APPEARANCES } from '../data/parser';
import { galaxySpiral, armPoint } from './layouts/spiral';
import { makeBackground, makeCoreGlow, makeWisps } from './nebula';

const MARVEL = new THREE.Color('#ff4438');
const DC = new THREE.Color('#4595ff');
const FLARE_THRESHOLD = 1200; // appearances → diffraction spikes

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute vec3 aRing;
  attribute float aFlare;
  attribute float aTwinkle;
  uniform float uTime;
  varying vec3 vColor;
  varying vec3 vRing;
  varying float vFlare;
  varying float vPx;
  void main() {
    vColor = aColor;
    vRing = aRing;
    vFlare = aFlare;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
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

    // emission core + halo
    float core = smoothstep(0.42, 0.0, d);
    float halo = smoothstep(1.0, 0.15, d) * 0.45;
    vec3 col = vColor * (core * 2.1 + halo);
    float alpha = core + halo;

    // identity ring — each character's unique hue; resolves only when the
    // star is large enough on screen to actually be seen (fly close)
    float ringVis = smoothstep(13.0, 34.0, vPx);
    float ring = smoothstep(0.07, 0.0, abs(d - 0.62)) * ringVis;
    col += vRing * ring * 1.6;
    alpha = max(alpha, ring * 0.9);

    // diffraction spikes for the giants (overexposed survey-plate look)
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
  private points!: THREE.Points;
  private starMat!: THREE.ShaderMaterial;
  private bg!: ReturnType<typeof makeBackground>;
  private wisps!: ReturnType<typeof makeWisps>;
  private clock = new THREE.Clock();
  private raf = 0;

  constructor(canvas: HTMLCanvasElement, stars: StarFields) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor('#08090d');

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 6000);
    this.camera.position.set(0, 110, 300);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    // fly toward whatever the cursor points at; near-unlimited range —
    // this is space, the scroll should take you THERE
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 2200;

    this.buildAtmosphere();
    this.buildPoints(stars);
    this.onResize();
    window.addEventListener('resize', this.onResize);
    this.loop();
  }

  private buildAtmosphere() {
    this.bg = makeBackground();
    this.scene.add(this.bg.mesh);

    this.scene.add(makeCoreGlow());

    this.wisps = makeWisps((year, universe, j1, j2) =>
      armPoint(year, universe, j1, j2),
    );
    this.scene.add(this.wisps.points);
  }

  private buildPoints(stars: StarFields) {
    const n = stars.count;
    const positions = galaxySpiral(stars);
    const colors = new Float32Array(n * 3);
    const rings = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const flares = new Float32Array(n);
    const twinkles = new Float32Array(n);

    const ringColor = new THREE.Color();
    const GOLDEN = 0.6180339887498949;

    for (let i = 0; i < n; i++) {
      const c = stars.universe[i] === 0 ? MARVEL : DC;
      // deceased dim to embers of their universe color (but stay visible)
      const dim = stars.alive[i] === 1 ? 0.45 : 1.0;
      colors[i * 3] = c.r * dim;
      colors[i * 3 + 1] = c.g * dim;
      colors[i * 3 + 2] = c.b * dim;

      // unique identity hue per character — golden-angle walk covers the
      // wheel without repeats clustering
      ringColor.setHSL((i * GOLDEN) % 1, 0.85, 0.62);
      rings[i * 3] = ringColor.r;
      rings[i * 3 + 1] = ringColor.g;
      rings[i * 3 + 2] = ringColor.b;

      const app = stars.appearances[i] === NA_APPEARANCES ? 1 : stars.appearances[i];
      sizes[i] = 1.3 + Math.log1p(app) * 0.95;
      flares[i] = app >= FLARE_THRESHOLD ? 1 : 0;
      twinkles[i] = ((i * 2654435761) >>> 8) % 1000 / 1000;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aRing', new THREE.BufferAttribute(rings, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aFlare', new THREE.BufferAttribute(flares, 1));
    geo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1));

    this.starMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.starMat);
    this.scene.add(this.points);
  }

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
    // slow idle drift — the sky breathes even when untouched
    this.points.rotation.y += 0.00012;
    this.wisps.points.rotation.y += 0.00012;
    this.starMat.uniforms.uTime.value = t;
    this.bg.update(t);
    this.wisps.update(t);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.renderer.dispose();
  }
}
