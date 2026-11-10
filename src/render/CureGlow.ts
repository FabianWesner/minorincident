import { AdditiveBlending, Color, DataTexture, InstancedMesh, MeshBasicNodeMaterial, Object3D, PlaneGeometry, Quaternion, RGBAFormat, Vector3, type Camera } from 'three/webgpu';

let glowMap: DataTexture | null = null;
/** Soft round puff: a smooth core with a slightly lumpy rim, generated once (no DOM needed). */
function glowTexture(): DataTexture {
  if (glowMap) return glowMap;
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + .5) / n * 2 - 1, v = (y + .5) / n * 2 - 1, angle = Math.atan2(v, u);
    const edge = 1 + .12 * Math.sin(angle * 5) + .07 * Math.sin(angle * 9 + 1.3);
    const d = Math.hypot(u, v) / edge, a = Math.max(0, 1 - d) ** 1.6;
    const i = (y * n + x) * 4; data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(a * 255);
  }
  glowMap = new DataTexture(data, n, n, RGBAFormat); glowMap.needsUpdate = true;
  return glowMap;
}

/** Camera-facing additive puffs in one draw: the cure's glowing green dust (column, tide, motes).
 * Brightness rides in the instance colour, so fading a puff never touches the material. */
export class GlowPuffs extends InstancedMesh {
  private n = 0;
  private readonly slot = new Object3D();
  private readonly tint = new Color();
  private readonly facing = new Quaternion();
  /** Added to every puff (the montage draws its dust wall at the far stage). */
  readonly offset = new Vector3();
  constructor(capacity: number, color: string, opacity = 1) {
    super(new PlaneGeometry(1, 1), new MeshBasicNodeMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity, fog: false }), capacity);
    this.frustumCulled = false; this.renderOrder = 5;
    for (let i = 0; i < capacity; i++) this.setColorAt(i, this.tint.setScalar(0));
    // One dark instance keeps the pipeline in the warm-up pass and in every frame (additive black adds nothing).
    this.count = 1;
  }
  begin(camera: Camera): this {
    this.n = 0; camera.getWorldQuaternion(this.facing);
    // Parents never rotate in practice; keep the billboard correct if one does.
    if (this.parent) this.facing.premultiply(this.parent.getWorldQuaternion(new Quaternion()).invert());
    return this;
  }
  /** Local position, world size in metres, brightness 0..1+. */
  puff(x: number, y: number, z: number, size: number, brightness: number): void {
    if (this.n >= this.instanceMatrix.count || brightness <= .002 || size <= 0) return;
    this.slot.position.set(x + this.offset.x, y + this.offset.y, z + this.offset.z); this.slot.quaternion.copy(this.facing); this.slot.scale.setScalar(size); this.slot.updateMatrix();
    this.setMatrixAt(this.n, this.slot.matrix); this.setColorAt(this.n, this.tint.setScalar(brightness)); this.n++;
  }
  end(): void {
    if (!this.n) this.setColorAt(this.n++, this.tint.setScalar(0));
    this.count = this.n; this.instanceMatrix.needsUpdate = true;
    if (this.instanceColor) this.instanceColor.needsUpdate = true;
  }
  dispose(): this { this.geometry.dispose(); (this.material as MeshBasicNodeMaterial).dispose(); super.dispose(); return this; }
}
