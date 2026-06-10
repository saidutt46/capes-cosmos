/** Atmosphere pass — what turns 23k dots into a galaxy.
 *
 * Three cheap layers, all additive:
 *  1. deep-space background sphere (FBM nebula haze, faintly tinted by the two arms)
 *  2. galactic core glow (billboard sprite, warm bone-white)
 *  3. arm wisps — a few hundred huge soft particles tracing the spiral arms
 */
import * as THREE from 'three';

// ---------- 1 · background nebula sphere ----------

const BG_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BG_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform float uTime;

  // cheap 3D value noise + 4-octave fbm
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = vDir;
    float n = fbm(d * 3.0 + vec3(uTime * 0.004));
    float n2 = fbm(d * 7.0 - vec3(uTime * 0.002));

    // two faint emission lobes matching the arms (red hemisphere / blue hemisphere)
    float side = d.x; // arm axis
    vec3 marvel = vec3(0.55, 0.10, 0.10);
    vec3 dc     = vec3(0.08, 0.22, 0.55);
    vec3 violet = vec3(0.16, 0.10, 0.28); // deep-space connective tissue
    vec3 tint = mix(dc, marvel, smoothstep(-0.7, 0.7, side));
    tint = mix(violet, tint, 0.55);

    // concentrate haze toward the galactic plane (y ~ 0)
    float plane = 1.0 - smoothstep(0.0, 0.55, abs(d.y));
    float haze = pow(n, 2.4) * (0.35 + 0.65 * plane);
    float sparkle = pow(n2, 9.0) * 0.5; // pinprick distant-star shimmer

    vec3 col = tint * haze * 0.42 + vec3(0.8, 0.85, 1.0) * sparkle * 0.12;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function makeBackground(): { mesh: THREE.Mesh; update: (t: number) => void } {
  const mat = new THREE.ShaderMaterial({
    vertexShader: BG_VERT,
    fragmentShader: BG_FRAG,
    uniforms: { uTime: { value: 0 } },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 32), mat);
  return { mesh, update: (t) => (mat.uniforms.uTime.value = t) };
}

// ---------- 2 · galactic core glow ----------

const GLOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv - 0.5;
    // billboard: strip rotation from the modelView basis
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy;
    gl_Position = projectionMatrix * mv;
  }
`;

const GLOW_FRAG = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float d = length(vUv) * 2.0;
    float core = exp(-d * 5.5);
    float bloom = exp(-d * 1.8) * 0.35;
    vec3 warm = vec3(1.0, 0.85, 0.62); // old starlight, not UI coral
    gl_FragColor = vec4(warm * (core + bloom), core + bloom);
  }
`;

export function makeCoreGlow(size = 130): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const geo = new THREE.PlaneGeometry(size, size);
  return new THREE.Mesh(geo, mat);
}

// ---------- 3 · arm wisps ----------

const WISP_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  varying vec3 vColor;
  varying float vPulse;
  void main() {
    vColor = aColor;
    vPulse = 0.75 + 0.25 * sin(uTime * 0.25 + aPhase);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (340.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const WISP_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vPulse;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = exp(-d * 3.0) * 0.06 * vPulse;
    gl_FragColor = vec4(vColor, a);
  }
`;

function hash(i: number, salt: number): number {
  let h = (i * 2654435761 + salt * 40503) >>> 0;
  h ^= h >> 13;
  h = (h * 2246822519) >>> 0;
  return ((h >>> 8) & 0xffff) / 0xffff;
}

/** Soft nebula clouds tracing both arms, colored toward each arm's emission. */
export function makeWisps(
  armPosition: (year: number, universe: number, j1: number, j2: number) => [number, number, number],
): { points: THREE.Points; update: (t: number) => void } {
  const N = 700;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const phase = new Float32Array(N);

  const marvel = new THREE.Color('#a03030');
  const dc = new THREE.Color('#2858a8');
  const violet = new THREE.Color('#5a3f8a');
  const teal = new THREE.Color('#2a7a78');

  for (let i = 0; i < N; i++) {
    const universe = i % 2; // alternate arms
    const year = 1938 + Math.floor(hash(i, 11) * 74);
    const [x, y, z] = armPosition(year, universe, hash(i, 12), hash(i, 13));
    pos[i * 3] = x;
    pos[i * 3 + 1] = y + (hash(i, 14) - 0.5) * 26;
    pos[i * 3 + 2] = z;

    const base = universe === 0 ? marvel : dc;
    const accent = hash(i, 15) > 0.72 ? (hash(i, 16) > 0.5 ? violet : teal) : base;
    const c = base.clone().lerp(accent, 0.6);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;

    size[i] = 30 + hash(i, 17) * 90;
    phase[i] = hash(i, 18) * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: WISP_VERT,
    fragmentShader: WISP_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  return { points, update: (t) => (mat.uniforms.uTime.value = t) };
}
