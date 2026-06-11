/** Ship specs + primitive mesh builders for FLIGHT mode.
 *
 * Three vessels, pure THREE.js primitives — zero assets. Each has a distinct
 * silhouette matching the spec: DART (needle + swept wings), ATLAS (drum +
 * sensor torus + outboard pods), MOTH (capsule + translucent sail planes).
 *
 * Hull palette: bone (#E9E2D0 dimmed to #9e9890) + ink (#1a1c23); coral
 * emissive engine (#ff5c49); annot annotation lines (#6b7280) via EdgesGeometry.
 *
 * Ships face -Z forward (three.js convention). Overall length ~3 units.
 * No Math.random — all jitter is hash-driven in scene code; ships are pure.
 */
import * as THREE from 'three';

export type ShipId = 'dart' | 'atlas' | 'moth';

export interface ShipSpec {
  id: ShipId;
  name: string;
  blurb: string;
  thrust: number;
  mass: number;
  turn: number;
  /** 0..1 per-second velocity retention factor base */
  damping: number;
  /** u/s */
  maxSpeed: number;
  /** sensor range multiplier (atlas 1.6, others 1.0) */
  sensor: number;
}

export const SHIPS: Record<ShipId, ShipSpec> = {
  dart: {
    id: 'dart',
    name: 'PS DART',
    blurb: 'Built to fall through the sky.',
    thrust: 1.5,
    mass: 0.7,
    turn: 1.3,
    damping: 0.82,
    maxSpeed: 28,
    sensor: 1.0,
  },
  atlas: {
    id: 'atlas',
    name: 'PS ATLAS',
    blurb: 'Sees everything, hurries nowhere.',
    thrust: 0.9,
    mass: 1.6,
    turn: 0.7,
    damping: 0.88,
    maxSpeed: 18,
    sensor: 1.6,
  },
  moth: {
    id: 'moth',
    name: 'PS MOTH',
    blurb: 'A leaf on the solar wind.',
    thrust: 1.1,
    mass: 0.5,
    turn: 1.6,
    damping: 0.64, // low damping = drifty
    maxSpeed: 22,
    sensor: 1.0,
  },
};

// ---------- palette ----------

const BONE = new THREE.Color('#c8c2b4');        // hull light face (dimmed bone)
const INK = new THREE.Color('#1a1c23');         // hull dark face
const CORAL = new THREE.Color('#ff5c49');       // engine emissive
const ANNOT = new THREE.Color('#6b7280');       // EdgeGeometry annotation lines

function hullMat(emissive = false): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: emissive ? CORAL : BONE,
    emissive: emissive ? CORAL : INK,
    emissiveIntensity: emissive ? 1.8 : 0,
    roughness: 0.7,
    metalness: 0.15,
  });
}

function annotLines(geo: THREE.BufferGeometry): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geo, 15);
  const mat = new THREE.LineBasicMaterial({ color: ANNOT, transparent: true, opacity: 0.55 });
  return new THREE.LineSegments(edges, mat);
}

function engineSprite(): THREE.Sprite {
  // 16×16 additive coral glow sprite generated on a canvas
  const size = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,92,73,0.95)');
  grad.addColorStop(0.35, 'rgba(255,92,73,0.5)');
  grad.addColorStop(1, 'rgba(255,92,73,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    color: CORAL,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.name = 'engine'; // contract: must be named 'engine'
  sprite.scale.setScalar(0.55);
  return sprite;
}

// ---------- ship builders ----------

/** DART — interceptor. Needle body + swept delta wings + engine cone.
 * Length ≈ 3u nose-to-exhaust, faces -Z. */
function buildDart(): THREE.Group {
  const g = new THREE.Group();

  // fuselage: sharp cone pointing -Z (nose) + short cylinder body
  const noseGeo = new THREE.ConeGeometry(0.12, 1.6, 5);
  const nose = new THREE.Mesh(noseGeo, hullMat());
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.1;
  g.add(nose);
  g.add(annotLines(noseGeo));

  const bodyGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.9, 5);
  const body = new THREE.Mesh(bodyGeo, hullMat());
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.1;
  g.add(body);
  g.add(annotLines(bodyGeo));

  // swept wings: two flat boxes angled outward and back
  const wingGeo = new THREE.BoxGeometry(0.06, 0.65, 0.7);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, hullMat());
    wing.position.set(side * 0.52, 0, 0.28);
    wing.rotation.y = side * 0.38; // swept back
    wing.rotation.z = side * 0.18; // dihedral
    g.add(wing);
    g.add(annotLines(wingGeo));
  }

  // engine exhaust cone (coral)
  const engGeo = new THREE.ConeGeometry(0.16, 0.35, 6);
  const eng = new THREE.Mesh(engGeo, hullMat(true));
  eng.rotation.x = Math.PI / 2;
  eng.position.z = 0.68;
  g.add(eng);
  g.add(annotLines(engGeo));

  const sprite = engineSprite();
  sprite.position.set(0, 0, 0.92);
  g.add(sprite);

  return g;
}

/** ATLAS — survey barge. Drum hull + wide sensor torus ring + two outboard pods.
 * Length ≈ 3u. */
function buildAtlas(): THREE.Group {
  const g = new THREE.Group();

  // main drum hull
  const drumGeo = new THREE.CylinderGeometry(0.34, 0.28, 1.4, 8);
  const drum = new THREE.Mesh(drumGeo, hullMat());
  drum.rotation.x = Math.PI / 2;
  g.add(drum);
  g.add(annotLines(drumGeo));

  // nose cap
  const capGeo = new THREE.SphereGeometry(0.28, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, hullMat());
  cap.rotation.x = Math.PI / 2;
  cap.position.z = -0.7;
  g.add(cap);

  // sensor torus ring around the middle
  const torusGeo = new THREE.TorusGeometry(0.62, 0.04, 8, 24);
  const torus = new THREE.Mesh(torusGeo, new THREE.MeshStandardMaterial({
    color: BONE, emissive: CORAL, emissiveIntensity: 0.3,
    roughness: 0.5, metalness: 0.3,
  }));
  torus.rotation.y = Math.PI / 2; // ring in the YZ plane (perpendicular to -Z travel)
  torus.position.z = 0.05;
  g.add(torus);
  g.add(annotLines(torusGeo));

  // outboard engine pods
  const podGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.9, 6);
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(podGeo, hullMat());
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 0.72, 0, 0.2);
    g.add(pod);
    g.add(annotLines(podGeo));

    // pod engine cones
    const podEngGeo = new THREE.ConeGeometry(0.09, 0.22, 5);
    const podEng = new THREE.Mesh(podEngGeo, hullMat(true));
    podEng.rotation.x = Math.PI / 2;
    podEng.position.set(side * 0.72, 0, 0.74);
    g.add(podEng);
  }

  // main engine block
  const engGeo = new THREE.CylinderGeometry(0.22, 0.16, 0.28, 8);
  const eng = new THREE.Mesh(engGeo, hullMat(true));
  eng.rotation.x = Math.PI / 2;
  eng.position.z = 0.84;
  g.add(eng);
  g.add(annotLines(engGeo));

  const sprite = engineSprite();
  sprite.scale.setScalar(0.72); // atlas is bigger
  sprite.position.set(0, 0, 1.06);
  g.add(sprite);

  return g;
}

/** MOTH — solar skiff. Small capsule body + two large translucent sail planes.
 * Length ≈ 3u (sails extend wide). */
function buildMoth(): THREE.Group {
  const g = new THREE.Group();

  // small capsule body: short cylinder + hemisphere nose
  const bodyGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.9, 7);
  const body = new THREE.Mesh(bodyGeo, hullMat());
  body.rotation.x = Math.PI / 2;
  g.add(body);
  g.add(annotLines(bodyGeo));

  const noseGeo = new THREE.SphereGeometry(0.13, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, hullMat());
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -0.45;
  g.add(nose);

  // two large sail planes — translucent, slightly iridescent
  const sailMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b0c8e8'),
    emissive: new THREE.Color('#2244aa'),
    emissiveIntensity: 0.18,
    roughness: 0.25,
    metalness: 0.45,
    transparent: true,
    opacity: 0.52,
    side: THREE.DoubleSide,
  });
  const sailGeo = new THREE.PlaneGeometry(1.4, 1.0);
  for (const side of [-1, 1]) {
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(side * 0.82, 0.06, -0.05);
    sail.rotation.y = side * 0.12; // slight toe-out
    g.add(sail);
    g.add(annotLines(sailGeo));
  }

  // small strut braces connecting sails to hull
  const strutGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.7, 4);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(strutGeo, hullMat());
    strut.rotation.z = Math.PI / 2;
    strut.position.set(side * 0.44, 0, -0.05);
    g.add(strut);
  }

  // tiny engine nozzle
  const engGeo = new THREE.ConeGeometry(0.1, 0.25, 5);
  const eng = new THREE.Mesh(engGeo, hullMat(true));
  eng.rotation.x = Math.PI / 2;
  eng.position.z = 0.58;
  g.add(eng);
  g.add(annotLines(engGeo));

  const sprite = engineSprite();
  sprite.scale.setScalar(0.42); // moth is small
  sprite.position.set(0, 0, 0.78);
  g.add(sprite);

  return g;
}

/** Build a ship Group from its id. Caller owns the group and must add it to the
 * scene and dispose geometries/materials when done. The engine glow sprite is
 * accessible via `group.getObjectByName('engine')`. */
export function buildShip(id: ShipId): THREE.Group {
  switch (id) {
    case 'dart': return buildDart();
    case 'atlas': return buildAtlas();
    case 'moth': return buildMoth();
  }
}
