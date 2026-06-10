/** The star field — one Points system holding all 23,272 characters.
 *
 * P0 boilerplate: renders the field in the Galaxy Spiral layout with true
 * Marvel/DC emission colors, sized by appearances (power law → a few suns,
 * vast dust), with slow idle drift + orbit controls. The layout-morph engine,
 * verbs (sweep/lock/expose) and post stack land in later phases.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { StarFields } from '../data/parser';
import { galaxySpiral } from './layouts/spiral';

const MARVEL = new THREE.Color('#ed2b24');
const DC = new THREE.Color('#0478f1');

const VERT = /* glsl */ `
  attribute float aSize;
  varying vec3 vColor;
  attribute vec3 aColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    // soft circular sprite with a hot core — emission, not a flat dot
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(0.5, 0.0, d);
    float halo = smoothstep(1.0, 0.2, d) * 0.35;
    gl_FragColor = vec4(vColor * (core * 1.6 + halo), core + halo);
  }
`;

export class StarField {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  private points!: THREE.Points;
  private raf = 0;

  constructor(canvas: HTMLCanvasElement, stars: StarFields) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor('#08090d');

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 4000);
    this.camera.position.set(0, 160, 420);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 40;
    this.controls.maxDistance = 1200;

    this.buildPoints(stars);
    this.onResize();
    window.addEventListener('resize', this.onResize);
    this.loop();
  }

  private buildPoints(stars: StarFields) {
    const n = stars.count;
    const positions = galaxySpiral(stars);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const c = stars.universe[i] === 0 ? MARVEL : DC;
      // deceased dim to embers of their universe color
      const dim = stars.alive[i] === 1 ? 0.35 : 1.0;
      colors[i * 3] = c.r * dim;
      colors[i * 3 + 1] = c.g * dim;
      colors[i * 3 + 2] = c.b * dim;
      // power-law sizing: log scale, dust stays dust, suns glare
      const app = stars.appearances[i] === 65535 ? 1 : stars.appearances[i];
      sizes[i] = 0.6 + Math.log1p(app) * 0.55;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
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
    // slow idle drift — the sky breathes even when untouched
    this.points.rotation.y += 0.0003;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}
