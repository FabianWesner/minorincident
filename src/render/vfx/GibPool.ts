import * as RAPIER from '@dimforge/rapier3d-compat';
import { BoxGeometry, DynamicDrawUsage, InstancedMesh, Matrix4, MeshBasicNodeMaterial, Quaternion, Vector3, SphereGeometry, type BufferGeometry } from 'three/webgpu';
import { Rng } from '../../core/Rng';

/** Visual-only Rapier world with 80 preallocated bodies. It never shares sim bodies or impulses. */
export class GibPool {
  readonly cap = 80;
  readonly mesh: InstancedMesh;
  readonly heads: InstancedMesh;
  private readonly isHead = new Uint8Array(this.cap);
  private readonly ownsGeometry: boolean;
  private readonly physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  private readonly bodies: RAPIER.RigidBody[] = [];
  private readonly expires = new Float64Array(this.cap);
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly scale = new Vector3();
  private readonly velocity = { x: 0, y: 0, z: 0 };
  private cursor = 0;
  private remainder = 0;
  count = 0;
  constructor(geometries?: { limb: BufferGeometry; head: BufferGeometry }) {
    this.ownsGeometry = !geometries;
    const material = new MeshBasicNodeMaterial({ color: '#b3121f' });
    this.mesh = new InstancedMesh(geometries?.limb ?? new BoxGeometry(0.18, 0.36, 0.18), material, this.cap);
    this.heads = new InstancedMesh(geometries?.head ?? new SphereGeometry(0.2, 8, 6), material, this.cap);
    this.heads.frustumCulled = false; this.heads.instanceMatrix.setUsage(DynamicDrawUsage);
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.1, 200).setTranslation(0, -0.1, 0));
    for (let i = 0; i < this.cap; i++) {
      const body = this.physics.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setLinearDamping(0.5).setAngularDamping(0.5));
      this.physics.createCollider(RAPIER.ColliderDesc.cuboid(0.09, 0.18, 0.09).setRestitution(0.3), body);
      body.setEnabled(false); this.bodies.push(body);
    }
    this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(DynamicDrawUsage); this.reset();
  }
  spawn(now: number, x: number, y: number, z: number, rng: Rng, head = false): void {
    const slot = this.cursor++ % this.cap, body = this.bodies[slot];
    this.isHead[slot] = Number(head);
    this.velocity.x = x; this.velocity.y = y; this.velocity.z = z;
    body.setTranslation(this.velocity, false); body.setEnabled(true);
    this.velocity.x = (rng.next() - 0.5) * 5; this.velocity.y = 2 + rng.next() * 3; this.velocity.z = (rng.next() - 0.5) * 5;
    body.setLinvel(this.velocity, true); body.setAngvel(this.velocity, true); this.expires[slot] = now + 30;
  }
  advance(now: number, seconds: number): void {
    this.remainder += seconds;
    while (this.remainder + 1e-9 >= 1 / 60) { this.physics.timestep = 1 / 60; this.physics.step(); this.remainder -= 1 / 60; }
    this.count = 0;
    for (let i = 0; i < this.cap; i++) {
      const active = this.expires[i] > now, body = this.bodies[i];
      if (active) {
        this.count++; const p = body.translation(), q = body.rotation();
        this.position.set(p.x, p.y, p.z); this.rotation.set(q.x, q.y, q.z, q.w); this.scale.setScalar(1);
      } else { body.setEnabled(false); this.scale.setScalar(0); }
      this.matrix.compose(this.position, this.rotation, this.scale);
      const visible = this.isHead[i] ? this.heads : this.mesh, hidden = this.isHead[i] ? this.mesh : this.heads;
      visible.setMatrixAt(i, this.matrix); this.scale.setScalar(0); this.matrix.compose(this.position, this.rotation, this.scale); hidden.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = this.heads.instanceMatrix.needsUpdate = true;
  }
  reset(): void { this.expires.fill(0); this.cursor = this.remainder = this.count = 0; this.advance(0, 0); }
  dispose(): void { this.physics.free(); this.mesh.dispose(); this.heads.dispose(); if (this.ownsGeometry) { this.mesh.geometry.dispose(); this.heads.geometry.dispose(); } (this.mesh.material as MeshBasicNodeMaterial).dispose(); }
}
