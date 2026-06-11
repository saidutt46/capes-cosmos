/** FLIGHT MODE — the survey becomes a place you fly.
 *
 * Imperative three.js alongside StarField. The field keeps rendering its own
 * loop; FlightMode runs its OWN rAF only to mutate the ship + camera + bodies +
 * wake (it never calls render() itself). On enter it calls field.beginFlight()
 * (orbit controls + verbs already suspended); on dispose it removes everything
 * it added and calls field.endFlight().
 *
 * Physics: auto-cruise forward (no input needed), arrows pitch/yaw with banking
 * roll, SPACE boost (×3.2 speed + FOV kick), B brake, per-ship inertia/damping,
 * and gravity wells from the nearest ≤8 star/planet bodies — soft, no fail
 * states (a close pass slingshots; inside 1.2× body scale a gentle repulsion
 * lets you skim rather than sink).
 *
 * Surfaces: telemetry (~6/s), beacon, complete, exit events; doppler radio drones
 * fed from the nearest bodies; a typed FLIGHT LOG via beacon events.
 */
import * as THREE from 'three';
import type { StarField, LayoutName } from '../scene/field';
import type { StarFields } from '../data/parser';
import { SHIPS, buildShip, type ShipId } from './ships';
import { NearBodies, type NearBody, type BodyClass } from './bodies';
import { gravityPull } from './bodies';
import { beaconChime, fanfare } from '../audio/ticks';
import { EngineSound } from '../audio/engine';
import { signatureOf } from '../audio/signature';
import type { RadioBand } from '../audio/radio';

export interface FlightEventMap {
  telemetry: {
    speed: number;
    boost: boolean;
    nearest: { index: number; dist: number; cls: BodyClass; pull: number } | null;
  };
  beacon: { index: number; dist: number; count: number; total: number };
  complete: null;
  exit: null;
}

interface Checkpoint {
  pos: [number, number, number];
  /** point the ship is looking at on spawn */
  look: [number, number, number];
}

const CHECKPOINTS: Record<LayoutName, Checkpoint> = {
  // above the 1935 core, nosed down the arms toward galactic center
  spiral: { pos: [0, 90, 160], look: [0, 0, 0] },
  // out on the rim, facing the expanding center
  shells: { pos: [0, 0, 420], look: [0, 0, 0] },
  // at the 1935 mouth, flying +Z down the corridor toward 2013
  tunnel: { pos: [0, 10, -40], look: [0, 10, 400] },
  // off Earth-616's cluster (CENTERS[0] = [-150,0,0]), facing it
  constellations: { pos: [-150, 60, 220], look: [-150, 0, 0] },
};

const CRUISE_BASE = 6; // u/s base auto-cruise speed
const BOOST_MULT = 3.2;
const FOV_BASE = 55;
const FOV_BOOST = 66;
const GRAVITY_BODIES = 8; // sum pull from this many nearest bodies
const WAKE_COUNT = 120;
const C_LIGHT = 60; // doppler reference speed (u/s)
const TELEMETRY_HZ = 6;
const DOPPLER_HZ = 10;
const BEACON_TOTAL = 20;
const BEACON_BASE_RADIUS = 25;

const UP = new THREE.Vector3(0, 1, 0);

export class FlightMode {
  readonly events = new EventTarget();

  private field: StarField;
  private stars: StarFields;
  private shipId: ShipId;
  private radio: RadioBand | undefined;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private positions: Float32Array;

  private ship: THREE.Group;
  private bodies: NearBodies;
  private engine: EngineSound | null = null;

  private dirLight: THREE.DirectionalLight;
  private ambLight: THREE.AmbientLight;

  // physics state
  private vel = new THREE.Vector3();
  private quat = new THREE.Quaternion(); // ship orientation
  private roll = 0; // current banking roll (rad)
  private fov = FOV_BASE;
  private boosting = false;
  private braking = false;
  private keys = { up: false, down: false, left: false, right: false };

  // wake particles
  private wake!: THREE.Points;
  private wakePos!: Float32Array;
  private wakeAge!: Float32Array;
  private wakeCount: number;
  private wakeHead = 0;

  // beacons
  private beaconIdx: number[] = [];
  private beaconHit: boolean[] = [];
  private beaconCount = 0;
  private completed = false;

  // timing
  private raf = 0;
  private lastT = 0;
  private telAccum = 0;
  private dopAccum = 0;

  // scratch (no per-frame alloc)
  private _fwd = new THREE.Vector3();
  private _v = new THREE.Vector3();
  private _v2 = new THREE.Vector3();
  private _camPos = new THREE.Vector3();
  private _camTarget = new THREE.Vector3();
  private _q = new THREE.Quaternion();
  private _prevDist = new Map<number, number>(); // for radial velocity (doppler)

  constructor(
    field: StarField,
    stars: StarFields,
    names: string[] | null,
    map: LayoutName,
    ship: ShipId,
    radio?: RadioBand,
  ) {
    this.field = field;
    this.stars = stars;
    this.shipId = ship;
    this.radio = radio;
    void names; // App resolves beacon names; contract keeps the arg for parity
    this.scene = field.scene;
    this.camera = field.camera;
    this.positions = field.layoutPositionsFor(map);

    field.beginFlight();

    // --- ship ---
    this.ship = buildShip(ship);
    const cp = CHECKPOINTS[map];
    this.ship.position.set(...cp.pos);
    // orient the ship: it faces -Z; aim that at the look target
    this._v.set(...cp.look).sub(this.ship.position).normalize();
    this.aimAt(this._v, this.quat);
    this.ship.quaternion.copy(this.quat);
    this.scene.add(this.ship);

    // --- lights (only while flying; star Points ignore them, bodies need them) ---
    this.dirLight = new THREE.DirectionalLight(0xfff2e0, 1.1);
    this.dirLight.position.set(0.4, 1, 0.6);
    this.scene.add(this.dirLight);
    this.ambLight = new THREE.AmbientLight(0x8090b0, 0.55);
    this.scene.add(this.ambLight);

    // --- bodies (LOD) ---
    this.bodies = new NearBodies(this.scene, stars, this.positions);

    // --- engine wake ---
    this.wakeCount = field.reducedMotion ? WAKE_COUNT / 2 : WAKE_COUNT;
    this.buildWake();

    // --- engine sound ---
    this.engine = new EngineSound();

    // --- beacons: top-20 by appearances in THIS map ---
    this.seedBeacons();

    // --- input ---
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // prime the camera behind the ship so frame 0 isn't a jump
    this.placeCameraInstant();

    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  // ---------- setup helpers ----------

  /** build a quaternion whose -Z (ship forward) axis points along `dir`.
   * THREE.Matrix4.lookAt(eye,target,up) puts -Z along (target-eye); with
   * eye at origin and target = dir, the ship's nose lines up with dir. */
  private aimAt(dir: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
    this._v2.copy(dir).normalize();
    _scratchMat.lookAt(_origin, this._v2, UP);
    return out.setFromRotationMatrix(_scratchMat);
  }

  private buildWake() {
    this.wakePos = new Float32Array(this.wakeCount * 3);
    this.wakeAge = new Float32Array(this.wakeCount).fill(1); // start fully aged (invisible)
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.wakePos, 3));
    const aAge = new THREE.BufferAttribute(this.wakeAge, 1);
    geo.setAttribute('aAge', aAge);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#ff5c49') } },
      vertexShader: /* glsl */ `
        attribute float aAge;
        varying float vAge;
        void main() {
          vAge = aAge;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(46.0 / -mv.z * (1.0 - aAge), 1.0, 22.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAge;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          if (d > 1.0) discard;
          float core = smoothstep(1.0, 0.0, d);
          gl_FragColor = vec4(uColor, core * (1.0 - vAge) * 0.7);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.wake = new THREE.Points(geo, mat);
    this.wake.frustumCulled = false;
    this.scene.add(this.wake);
  }

  private seedBeacons() {
    // top-20 brightest characters that actually materialise in this map
    // (appearances desc; ties broken by index for determinism)
    const idx: number[] = [];
    for (let i = 0; i < this.stars.count; i++) idx.push(i);
    idx.sort((a, b) => {
      const da = this.stars.appearances[a];
      const db = this.stars.appearances[b];
      if (db !== da) return db - da;
      return a - b;
    });
    this.beaconIdx = idx.slice(0, BEACON_TOTAL);
    this.beaconHit = new Array(this.beaconIdx.length).fill(false);
  }

  // ---------- input ----------

  private onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp': this.keys.up = true; e.preventDefault(); break;
      case 'ArrowDown': this.keys.down = true; e.preventDefault(); break;
      case 'ArrowLeft': this.keys.left = true; e.preventDefault(); break;
      case 'ArrowRight': this.keys.right = true; e.preventDefault(); break;
      case ' ': this.boosting = true; e.preventDefault(); break;
      case 'b': case 'B': this.braking = true; break;
      case 'Escape':
        this.emit('exit', null); // App orchestrates the actual teardown
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp': this.keys.up = false; break;
      case 'ArrowDown': this.keys.down = false; break;
      case 'ArrowLeft': this.keys.left = false; break;
      case 'ArrowRight': this.keys.right = false; break;
      case ' ': this.boosting = false; break;
      case 'b': case 'B': this.braking = false; break;
    }
  };

  // ---------- the loop ----------

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick);
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (dt > 0.1) dt = 0.1; // clamp after a tab stall so we don't teleport

    const spec = SHIPS[this.shipId];

    // --- steering: arrows → pitch/yaw, with banking roll on yaw ---
    const turnRate = 1.4 * spec.turn; // rad/s baseline
    const yawInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    const pitchInput = (this.keys.up ? 1 : 0) - (this.keys.down ? 1 : 0);

    if (yawInput !== 0) {
      this._q.setFromAxisAngle(UP_LOCAL, yawInput * turnRate * dt);
      this.quat.multiply(this._q);
    }
    if (pitchInput !== 0) {
      this._q.setFromAxisAngle(RIGHT_LOCAL, pitchInput * turnRate * dt);
      this.quat.multiply(this._q);
    }
    this.quat.normalize();

    // banking: ease roll toward a target proportional to yaw input (max ~0.6 rad)
    const rollTarget = -yawInput * 0.6;
    this.roll += (rollTarget - this.roll) * Math.min(1, dt * 6);

    // compose visible orientation = steer quat * banking roll about forward
    this._q.setFromAxisAngle(FWD_LOCAL, this.roll);
    this.ship.quaternion.copy(this.quat).multiply(this._q);

    // --- forward thrust (auto-cruise, boost, brake) ---
    this._fwd.set(0, 0, -1).applyQuaternion(this.quat); // ship faces -Z
    let targetSpeed = CRUISE_BASE * spec.thrust;
    if (this.boosting) targetSpeed *= BOOST_MULT;
    if (this.braking) targetSpeed *= 0.25;
    targetSpeed = Math.min(targetSpeed, spec.maxSpeed);

    // accelerate velocity toward forward*targetSpeed (thrust authority)
    this._v.copy(this._fwd).multiplyScalar(targetSpeed);
    const accel = this.braking ? 4 : 2.2; // brake bites faster
    this.vel.lerp(this._v, Math.min(1, dt * accel));

    // --- gravity from nearest ≤8 star/planet bodies ---
    const near = this.bodies.update(this.ship.position, spec.sensor);
    let gx = 0, gy = 0, gz = 0;
    let pulled = 0;
    for (const nb of near) {
      if (nb.info.cls !== 'star' && nb.info.cls !== 'planet') continue;
      const pull = gravityPull(nb.dist, nb.info.scale);
      if (pull <= 0) continue;
      // direction ship → body
      this._v2.copy(nb.pos).sub(this.ship.position);
      const d = this._v2.length() || 1;
      this._v2.multiplyScalar(1 / d);
      // soft repulsion inside 1.2× body scale so you skim, never sink
      const skin = nb.info.scale * 1.2;
      let signed = pull;
      if (nb.dist < skin) {
        const inside = 1 - nb.dist / skin; // 0..1 deeper = stronger push
        signed = pull - pull * 2.4 * inside; // flips negative inside the skin
      }
      const a = signed * 9; // pull → acceleration (u/s²); tuned with soft falloff
      gx += this._v2.x * a;
      gy += this._v2.y * a;
      gz += this._v2.z * a;
      if (++pulled >= GRAVITY_BODIES) break;
    }
    this.vel.x += gx * dt;
    this.vel.y += gy * dt;
    this.vel.z += gz * dt;

    // --- damping + max speed clamp ---
    const damp = Math.pow(spec.damping, dt); // per-second retention → per-frame
    this.vel.multiplyScalar(damp);
    if (this.vel.length() > spec.maxSpeed * BOOST_MULT) {
      this.vel.setLength(spec.maxSpeed * BOOST_MULT);
    }

    // --- integrate position ---
    this.ship.position.addScaledVector(this.vel, dt);

    // --- FOV kick on boost (skip under reduced motion) ---
    if (!this.field.reducedMotion) {
      const fovTarget = this.boosting ? FOV_BOOST : FOV_BASE;
      this.fov += (fovTarget - this.fov) * Math.min(1, dt * 4);
      if (Math.abs(this.camera.fov - this.fov) > 0.05) {
        this.camera.fov = this.fov;
        this.camera.updateProjectionMatrix();
      }
    }

    // --- chase camera ---
    this.updateCamera(dt);

    // --- wake ---
    this.updateWake(dt);

    // --- beacons ---
    this.checkBeacons(spec);

    // --- telemetry (throttled) ---
    this.telAccum += dt;
    if (this.telAccum >= 1 / TELEMETRY_HZ) {
      this.telAccum = 0;
      this.emitTelemetry(near);
    }

    // --- doppler drones (throttled) ---
    this.dopAccum += dt;
    if (this.dopAccum >= 1 / DOPPLER_HZ) {
      this.updateDoppler(near, this.dopAccum);
      this.dopAccum = 0;
    }

    // --- engine sound ---
    if (this.engine) {
      const cruise01 = Math.min(1, this.vel.length() / (spec.maxSpeed || 1));
      this.engine.setLevel(cruise01, this.boosting ? 1 : 0);
    }
  };

  private updateCamera(dt: number) {
    // offset behind + above ship in ship space: [0, 5, 14] (uses banked orientation)
    this._camPos.set(0, 5, 14).applyQuaternion(this.ship.quaternion).add(this.ship.position);
    // frame-rate-independent lerp around a ~0.08/frame@60 feel
    const k = 1 - Math.pow(1 - 0.08, dt * 60);
    this.camera.position.lerp(this._camPos, k);
    // look ahead of the ship (steer quat, not banked, so the horizon stays level)
    this._fwd.set(0, 0, -1).applyQuaternion(this.quat);
    this._camTarget.copy(this.ship.position).addScaledVector(this._fwd, 20);
    this.camera.up.copy(UP);
    this.camera.lookAt(this._camTarget);
  }

  private placeCameraInstant() {
    this._camPos.set(0, 5, 14).applyQuaternion(this.ship.quaternion).add(this.ship.position);
    this.camera.position.copy(this._camPos);
    this._fwd.set(0, 0, -1).applyQuaternion(this.quat);
    this._camTarget.copy(this.ship.position).addScaledVector(this._fwd, 20);
    this.camera.up.copy(UP);
    this.camera.lookAt(this._camTarget);
    this.camera.fov = FOV_BASE;
    this.camera.updateProjectionMatrix();
  }

  private updateWake(dt: number) {
    // emit from the engine sprite's world position
    const engine = this.ship.getObjectByName('engine');
    if (engine) {
      engine.getWorldPosition(this._v);
    } else {
      this._v.copy(this.ship.position);
    }
    // age all particles
    for (let i = 0; i < this.wakeCount; i++) {
      this.wakeAge[i] = Math.min(1, this.wakeAge[i] + dt * 1.6);
    }
    // spawn a couple fresh ones at the head each frame (recycled ring buffer)
    const spawns = this.vel.length() > 0.5 ? 2 : 0;
    for (let s = 0; s < spawns; s++) {
      const h = this.wakeHead;
      this.wakePos[h * 3] = this._v.x;
      this.wakePos[h * 3 + 1] = this._v.y;
      this.wakePos[h * 3 + 2] = this._v.z;
      this.wakeAge[h] = 0;
      this.wakeHead = (this.wakeHead + 1) % this.wakeCount;
    }
    (this.wake.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.wake.geometry.getAttribute('aAge') as THREE.BufferAttribute).needsUpdate = true;
  }

  private checkBeacons(spec: { sensor: number }) {
    if (this.completed) return;
    const radius = BEACON_BASE_RADIUS * spec.sensor;
    // beacons we can only register when their body is in the near list (or close)
    for (let b = 0; b < this.beaconIdx.length; b++) {
      if (this.beaconHit[b]) continue;
      const idx = this.beaconIdx[b];
      // distance from ship to the beacon's body position
      this._v.set(
        this.positions[idx * 3],
        this.positions[idx * 3 + 1],
        this.positions[idx * 3 + 2],
      );
      const dist = this._v.distanceTo(this.ship.position);
      if (dist <= radius) {
        this.beaconHit[b] = true;
        this.beaconCount++;
        beaconChime();
        this.emit('beacon', {
          index: idx,
          dist,
          count: this.beaconCount,
          total: this.beaconIdx.length,
        });
        if (this.beaconCount >= this.beaconIdx.length && !this.completed) {
          this.completed = true;
          fanfare();
          this.emit('complete', null);
        }
      }
    }
  }

  private emitTelemetry(near: NearBody[]) {
    const n0 = near[0];
    let nearest: FlightEventMap['telemetry']['nearest'] = null;
    if (n0) {
      nearest = {
        index: n0.index,
        dist: n0.dist,
        cls: n0.info.cls,
        pull: gravityPull(n0.dist, n0.info.scale),
      };
    }
    this.emit('telemetry', {
      speed: this.vel.length(),
      boost: this.boosting,
      nearest,
    });
  }

  private updateDoppler(near: NearBody[], dt: number) {
    if (!this.radio || !this.radio.enabled) {
      this.radio?.setProximityVoices([]);
      return;
    }
    const voices: { freq: number; gain: number; doppler: number }[] = [];
    let count = 0;
    for (const nb of near) {
      if (nb.info.cls !== 'star' && nb.info.cls !== 'planet') continue;
      // radial velocity: change in distance / dt (approaching = negative ddist)
      const prev = this._prevDist.get(nb.index);
      const ddist = prev === undefined ? 0 : (nb.dist - prev) / Math.max(dt, 1e-3);
      this._prevDist.set(nb.index, nb.dist);
      // approaching (ddist<0) → pitch up. doppler = 1 + (radialVel/60), clamped ±0.3
      const radialVel = -ddist; // +ve = approaching
      const doppler = 1 + Math.max(-0.3, Math.min(0.3, radialVel / C_LIGHT));
      const gain = Math.max(0, 1 - nb.dist / 200) * 0.06;
      const freq = signatureOf(nb.index, this.stars).freq;
      voices.push({ freq, gain, doppler });
      if (++count >= 4) break;
    }
    this.radio.setProximityVoices(voices);
    // prune stale prevDist entries (bodies no longer near) to bound the map
    if (this._prevDist.size > 64) {
      const keep = new Set(near.map((n) => n.index));
      for (const k of this._prevDist.keys()) if (!keep.has(k)) this._prevDist.delete(k);
    }
  }

  // ---------- events ----------

  private emit<K extends keyof FlightEventMap>(type: K, detail: FlightEventMap[K]) {
    this.events.dispatchEvent(new CustomEvent(type, { detail }));
  }

  // ---------- introspection (App test hook) ----------

  get speed(): number {
    return this.vel.length();
  }

  get heading(): [number, number, number] {
    this._fwd.set(0, 0, -1).applyQuaternion(this.quat);
    return [this._fwd.x, this._fwd.y, this._fwd.z];
  }

  get beacons(): number {
    return this.beaconCount;
  }

  // ---------- teardown ----------

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    // stop doppler drones + engine hum
    this.radio?.setProximityVoices([]);
    this.engine?.stop();
    this.engine = null;

    // remove + dispose ship
    this.scene.remove(this.ship);
    this.ship.traverse((o) => {
      const mesh = o as THREE.Mesh | THREE.LineSegments | THREE.Sprite;
      const anyMesh = mesh as unknown as { geometry?: THREE.BufferGeometry; material?: THREE.Material };
      anyMesh.geometry?.dispose?.();
      const mat = anyMesh.material;
      if (mat) {
        const sm = mat as THREE.Material & { map?: THREE.Texture };
        sm.map?.dispose?.();
        mat.dispose();
      }
    });

    // wake
    this.scene.remove(this.wake);
    this.wake.geometry.dispose();
    (this.wake.material as THREE.Material).dispose();

    // lights
    this.scene.remove(this.dirLight);
    this.scene.remove(this.ambLight);
    this.dirLight.dispose();

    // bodies
    this.bodies.dispose();

    // restore camera fov (endFlight tweens position/target)
    if (this.camera.fov !== FOV_BASE) {
      this.camera.fov = FOV_BASE;
      this.camera.updateProjectionMatrix();
    }

    this.field.endFlight();
  }
}

// module-scope scratch shared across the (singleton-ish) flight instance
const _scratchMat = new THREE.Matrix4();
const _origin = new THREE.Vector3();
const UP_LOCAL = new THREE.Vector3(0, 1, 0);
const RIGHT_LOCAL = new THREE.Vector3(1, 0, 0);
const FWD_LOCAL = new THREE.Vector3(0, 0, -1);
