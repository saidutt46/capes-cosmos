/** GPU ID-buffer picking — exact star identification at 23k scale.
 *
 * A parallel Points object shares the star geometry but renders each point's
 * index encoded as a color into a 1×1 render target aimed at the cursor (via
 * camera.setViewOffset). One readPixels gives the star under the pointer with
 * zero CPU raycasting. Points are slightly inflated in the picking pass so
 * small stars remain clickable.
 */
import * as THREE from 'three';

const PICK_VERT = /* glsl */ `
  attribute vec3 aTarget;
  attribute float aDelay;
  attribute float aSize;
  attribute float aIndex;
  uniform float uMix;
  varying vec3 vId;
  void main() {
    float p = clamp((uMix * 1.35 - aDelay * 0.35), 0.0, 1.0);
    p = p * p * (3.0 - 2.0 * p);
    vec3 pos = mix(position, aTarget, p);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float px = aSize * (420.0 / -mv.z);
    gl_PointSize = clamp(px * 1.4, 7.0, 170.0); // inflated for pickability
    gl_Position = projectionMatrix * mv;
    float id = aIndex + 1.0; // 0 = background
    vId = vec3(
      mod(id, 256.0),
      mod(floor(id / 256.0), 256.0),
      floor(id / 65536.0)
    ) / 255.0;
  }
`;

const PICK_FRAG = /* glsl */ `
  varying vec3 vId;
  void main() {
    if (length(gl_PointCoord - 0.5) > 0.5) discard;
    gl_FragColor = vec4(vId, 1.0);
  }
`;

export class GpuPicker {
  private scene = new THREE.Scene();
  private points: THREE.Points;
  private target = new THREE.WebGLRenderTarget(1, 1);
  private buf = new Uint8Array(4);
  readonly material: THREE.ShaderMaterial;

  constructor(geometry: THREE.BufferGeometry) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: PICK_VERT,
      fragmentShader: PICK_FRAG,
      uniforms: { uMix: { value: 1 } },
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.scene.background = new THREE.Color(0x000000);
  }

  /** Star index under css pixel (x, y), or -1 for void. */
  pick(
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    fieldRotationY: number,
    uMix: number,
    x: number,
    y: number,
  ): number {
    this.points.rotation.y = fieldRotationY;
    this.material.uniforms.uMix.value = uMix;

    const dpr = renderer.getPixelRatio();
    const size = renderer.getSize(new THREE.Vector2());
    camera.setViewOffset(
      size.x * dpr,
      size.y * dpr,
      Math.floor(x * dpr),
      Math.floor(y * dpr),
      1,
      1,
    );
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, camera);
    renderer.setRenderTarget(null);
    camera.clearViewOffset();

    renderer.readRenderTargetPixels(this.target, 0, 0, 1, 1, this.buf);
    const id = this.buf[0] + this.buf[1] * 256 + this.buf[2] * 65536;
    return id - 1;
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
  }
}
