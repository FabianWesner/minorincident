// Adapted from Bruno Simon folio-2025 Confetti.js, Leaves.js, Trails.js and Noises.js (MIT, 41046b5).
import { Color, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, PlaneGeometry, type Node } from 'three/webgpu';
import { attribute, cameraWorldMatrix, cos, float, Fn, mix, positionGeometry, sin, uniform, uv, vec3, vec4, viewportDepthTexture, linearDepth } from 'three/tsl';

/** Fixed GPU slots. Only spawn writes attributes; ballistic motion, fading and noise run in TSL.
 * Ground shapes: 0 splat, 1 ring, 2 lane, 3 chevron, 4 cross. Particles use billboards.
 * Light-field consumers (E25/E27) may supply a world-position sampling node at construction. */
export class FxPool {
  readonly clock = uniform(0);
  readonly mesh: InstancedMesh;
  private readonly origin: InstancedBufferAttribute;
  private readonly motion: InstancedBufferAttribute;
  private readonly style: InstancedBufferAttribute;
  private readonly colors: InstancedBufferAttribute;
  private readonly expires: Float64Array;
  private readonly tint = new Color();
  private cursor = 0;
  constructor(readonly cap: number, readonly mode: 'particle' | 'ground', lightSample?: Node<'vec3'>) {
    const geometry = new PlaneGeometry(1, 1);
    this.origin = new InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(DynamicDrawUsage);
    this.motion = new InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(DynamicDrawUsage);
    this.style = new InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(DynamicDrawUsage);
    this.colors = new InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(DynamicDrawUsage);
    geometry.setAttribute('fxOrigin', this.origin); geometry.setAttribute('fxMotion', this.motion);
    geometry.setAttribute('fxStyle', this.style); geometry.setAttribute('fxColor', this.colors);
    const origin = attribute('fxOrigin', 'vec4'), motion = attribute('fxMotion', 'vec4'), style = attribute('fxStyle', 'vec4');
    const age = this.clock.sub(origin.w), life = motion.w.max(0.001), progress = age.div(life).clamp(0, 1);
    const alive = age.greaterThanEqual(0).and(age.lessThan(life)).select(1, 0);
    const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide });
    material.positionNode = Fn(() => {
      const size = style.x.mul(alive);
      if (mode === 'particle') {
        const billboard = cameraWorldMatrix.mul(vec4(positionGeometry.xy.mul(size), 0, 0)).xyz;
        const offset = motion.xyz.mul(age.max(0));
        return origin.xyz.add(offset).add(vec3(0, age.max(0).pow(2).mul(style.z).mul(-0.5), 0)).add(billboard);
      }
      const growth = style.z.greaterThan(0).select(progress.mul(2).min(1), 1);
      const x = positionGeometry.x.mul(size).mul(growth), z = positionGeometry.y.mul(size).mul(style.w).mul(growth);
      return origin.xyz.add(vec3(x.mul(cos(motion.x)).sub(z.mul(sin(motion.x))), 0, x.mul(sin(motion.x)).add(z.mul(cos(motion.x)))));
    })();
    material.outputNode = Fn(() => {
      const p = uv().sub(0.5).mul(2), r = p.length();
      // Bruno's sine/dot hash, animated analytically: no flipbook or per-emission textures.
      const noise = sin(p.x.mul(127.1).add(p.y.mul(311.7)).add(mode === 'particle' ? age.mul(2) : 0)).mul(43758.5453).fract();
      let mask;
      if (mode === 'particle') {
        const edge = float(1).sub(r).max(0).pow(1.5);
        const depth = linearDepth(viewportDepthTexture()).sub(linearDepth()).mul(150).clamp(0, 1);
        mask = edge.mul(mix(0.65, 1, noise)).mul(depth);
      } else {
        const splat = r.lessThan(float(0.84).add(noise.mul(0.16))).select(1, 0);
        const ring = r.lessThan(1).and(r.greaterThan(0.82)).select(1, 0);
        const lane = p.x.abs().greaterThan(0.82).or(p.y.abs().greaterThan(0.82)).select(1, 0);
        const chevron = p.y.sub(p.x.abs().mul(0.7)).abs().lessThan(0.16).select(1, 0);
        const cross = p.x.abs().lessThan(0.18).or(p.y.abs().lessThan(0.18)).select(1, 0);
        mask = style.y.equal(1).select(ring, style.y.equal(2).select(lane, style.y.equal(3).select(chevron, style.y.equal(4).select(cross, splat))));
      }
      const fade = float(1).sub(progress).min(1).mul(alive);
      const lit = lightSample ?? vec3(1);
      return vec4(attribute('fxColor', 'vec3').mul(lit), mask.mul(fade));
    })();
    this.mesh = new InstancedMesh(geometry, material, cap); this.mesh.frustumCulled = false;
    this.mesh.renderOrder = mode === 'ground' ? 1 : 2;
    const identity = new Matrix4(); for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, identity);
    this.expires = new Float64Array(cap);
  }
  /** Returns a stable slot index; callers retain it only for attack-lifetime telegraphs. */
  spawn(now: number, life: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, shape: number, color: string, gravity = 0, aspect = 1): number {
    const slot = this.cursor++ % this.cap;
    this.origin.setXYZW(slot, x, y, z, now); this.motion.setXYZW(slot, vx, vy, vz, life);
    this.style.setXYZW(slot, size, shape, gravity, aspect);
    this.tint.set(color); this.colors.setXYZ(slot, this.tint.r, this.tint.g, this.tint.b);
    this.expires[slot] = now + life;
    this.origin.needsUpdate = this.motion.needsUpdate = this.style.needsUpdate = this.colors.needsUpdate = true;
    return slot;
  }
  remove(slot: number): void { this.expires[slot] = 0; this.motion.setW(slot, 0); this.motion.needsUpdate = true; }
  advance(now: number): void { this.clock.value = now; }
  get count(): number { let n = 0; for (const expiry of this.expires) if (expiry > this.clock.value) n++; return n; }
  reset(): void { this.expires.fill(0); this.motion.array.fill(0); this.motion.needsUpdate = true; this.cursor = 0; this.clock.value = 0; }
  dispose(): void { this.mesh.dispose(); this.mesh.geometry.dispose(); (this.mesh.material as MeshBasicNodeMaterial).dispose(); }
}
