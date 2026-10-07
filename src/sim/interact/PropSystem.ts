// Adapted from Bruno Simon folio-2025 Objects.js (MIT): sleeping dynamic bodies, sync only while awake, reset when fallen.
import * as RAPIER from '@dimforge/rapier3d-compat';
import { staticCollision } from '../../assets/staticCollision';
import { pushableProps } from '../../data/pushableProps';
import type { Placement } from '../../levels/districts/types';
import type { DistrictWorld } from '../world/DistrictWorld';
import type { SimWorld } from '../world/SimWorld';

/** Plain pose mirror of a body: render sync and snapshots never touch WASM. Quaternion is x, y, z, w. */
export interface PropPose { p: [number, number, number]; q: [number, number, number, number] }
export interface PushProp { id: string; assetId: string; mass: number; radius: number; home: PropPose; pose: PropPose; body: RAPIER.RigidBody; collider: RAPIER.Collider; awake: boolean; fixed: boolean }
export type PropSnapshot = { id: string; p: [number, number, number]; q: [number, number, number, number] }[];

/** Simultaneously simulated props; the farthest settle first beyond this (Bruno keeps most asleep). */
export const MAX_AWAKE_PROPS = 12;
/** Running infected shove props up to this speed (m/s) along their approach. */
const SHOVE_SPEED = 1.6;
const yawPose = (p: Placement): PropPose => ({ p: [...p.position], q: [0, Math.sin(p.yaw / 2), 0, Math.cos(p.yaw / 2)] });

/** E26 light-prop subset (PO finding #15): pushable instanced props as deterministic Rapier bodies in the fixed-step
 * sim. The courier's character controller applies its contact impulses; infected shove them on contact. */
export class PropSystem {
  readonly items: PushProp[] = [];
  private readonly nearby: number[] = [];
  constructor(private readonly world: SimWorld) {}
  /** (Re)create every pushable of the district set in its placement order; `saved` poses survive a tier rebuild/checkpoint. */
  install(districts: DistrictWorld, saved?: PropSnapshot): void {
    this.items.length = 0;
    const poses = new Map(saved?.map(s => [s.id, s]));
    for (const d of districts.districts) for (const placement of d.pushables) {
      const shape = staticCollision[placement.assetId]?.boxes ?? [];
      if (!shape.length) continue;
      const min = [Infinity, 0, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const box of shape) for (let axis = 0; axis < 3; axis++) { if (axis !== 1) min[axis] = Math.min(min[axis], box.min[axis]); max[axis] = Math.max(max[axis], box.max[axis]); }
      const s = placement.scale, half = [0, 1, 2].map(i => (max[i] - min[i]) * s[i] / 2), center = [0, 1, 2].map(i => (max[i] + min[i]) * s[i] / 2);
      const home = yawPose(placement); home.p[0] += d.origin[0]; home.p[2] += d.origin[1];
      const id = `${d.id}/${placement.id}`, restored = poses.get(id), pose: PropPose = restored ? { p: [...restored.p], q: [...restored.q] } : { p: [...home.p], q: [...home.q] };
      const mass = pushableProps[placement.assetId].mass;
      const body = this.world.physics.world!.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(...pose.p).setRotation({ x: pose.q[0], y: pose.q[1], z: pose.q[2], w: pose.q[3] })
        .setLinearDamping(1.2).setAngularDamping(2.5).setSleeping(true));
      const collider = this.world.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2]).setTranslation(center[0], center[1], center[2])
        .setFriction(.7).setRestitution(.05)
        // Bottom-weighted, stiffer than a uniform box: props slide and only tip over when shoved hard.
        .setMassProperties(mass, { x: center[0], y: center[1] * .45, z: center[2] }, { x: mass * (half[1] ** 2 + half[2] ** 2) / 3 * 2.6, y: mass * (half[0] ** 2 + half[2] ** 2) / 3, z: mass * (half[0] ** 2 + half[1] ** 2) / 3 * 2.6 }, { x: 0, y: 0, z: 0, w: 1 }), body);
      this.items.push({ id, assetId: placement.assetId, mass, radius: Math.hypot(half[0], half[2]), home, pose, body, collider, awake: false, fixed: false });
    }
    // One probe step finds authored placements that already cut into static geometry (a reel tucked into a
    // fence): those stay fixed instead of popping out when touched. Every prop then rests asleep at its pose.
    const world = this.world.physics.world!;
    world.step();
    for (const item of this.items) {
      let embedded = false;
      world.contactPairsWith(item.collider, other => {
        const parent = other.parent(); // level statics are parentless colliders
        if (embedded || (parent && !parent.isFixed())) return;
        world.contactPair(item.collider, other, manifold => { for (let k = 0; k < manifold.numContacts(); k++) if (manifold.contactDist(k) < -.03) embedded = true; });
      });
      // Keep the settled contact pose (moving the body back would restart its ground contact and wake it).
      if (!poses.has(item.id)) { this.mirror(item); item.home = { p: [...item.pose.p], q: [...item.pose.q] }; }
      else this.place(item, item.pose);
      item.body.sleep();
      if (embedded) { item.body.setBodyType(RAPIER.RigidBodyType.Fixed, false); item.fixed = true; }
    }
  }
  /** Before the physics step: infected on contact shove props away from their body (they ignore props on the nav grid). */
  prePhysics(): void {
    for (const item of this.items) {
      if (item.fixed) continue;
      const [x, , z] = item.pose.p;
      this.world.spatial.query({ x, z, r: item.radius + .4 }, this.nearby);
      for (const id of this.nearby) {
        const entity = id === 1 ? undefined : this.world.entities.get(id);
        if (!entity?.infected || entity.health.current <= 0) continue;
        const dx = x - entity.transform.x, dz = z - entity.transform.z, distance = Math.hypot(dx, dz);
        if (distance < 1e-4 || distance > item.radius + .4) continue;
        const nx = dx / distance, nz = dz / distance, v = item.body.linvel(), along = v.x * nx + v.z * nz;
        if (along >= SHOVE_SPEED) continue;
        const impulse = item.mass * (SHOVE_SPEED - along);
        item.body.applyImpulse({ x: nx * impulse, y: 0, z: nz * impulse }, true);
      }
    }
  }
  /** After the physics step: mirror awake poses, reset fallen props, and settle the farthest beyond the awake cap. */
  postPhysics(): void {
    const player = this.world.entities.get(1)?.transform;
    let awake = 0;
    for (const item of this.items) {
      item.awake = !item.fixed && !item.body.isSleeping();
      if (!item.awake) continue;
      awake++;
      const t = item.body.translation();
      if (t.y < -2) { this.place(item, item.home); continue; }
      this.mirror(item);
    }
    if (awake <= MAX_AWAKE_PROPS || !player) return;
    const ranked = this.items.filter(i => i.awake).map(i => ({ i, d: (i.pose.p[0] - player.x) ** 2 + (i.pose.p[2] - player.z) ** 2 }))
      .sort((a, b) => b.d - a.d || (a.i.id < b.i.id ? -1 : 1));
    for (let n = 0; n < awake - MAX_AWAKE_PROPS; n++) { const item = ranked[n].i; item.body.setLinvel({ x: 0, y: 0, z: 0 }, false); item.body.setAngvel({ x: 0, y: 0, z: 0 }, false); item.body.sleep(); item.awake = false; }
  }
  private mirror(item: PushProp): void {
    const t = item.body.translation(), r = item.body.rotation();
    item.pose.p[0] = t.x; item.pose.p[1] = t.y; item.pose.p[2] = t.z;
    item.pose.q[0] = r.x; item.pose.q[1] = r.y; item.pose.q[2] = r.z; item.pose.q[3] = r.w;
  }
  private place(item: PushProp, pose: PropPose): void {
    item.pose = { p: [...pose.p], q: [...pose.q] };
    item.body.setTranslation({ x: pose.p[0], y: pose.p[1], z: pose.p[2] }, false);
    item.body.setRotation({ x: pose.q[0], y: pose.q[1], z: pose.q[2], w: pose.q[3] }, false);
    item.body.setLinvel({ x: 0, y: 0, z: 0 }, false); item.body.setAngvel({ x: 0, y: 0, z: 0 }, false); item.body.sleep(); item.awake = false;
  }
  /** Displaced props only (home poses are implied by the layout), in placement order. */
  snapshot(): PropSnapshot {
    const moved = (a: PropPose, b: PropPose) => a.p.some((v, i) => Math.abs(v - b.p[i]) > 1e-4) || a.q.some((v, i) => Math.abs(v - b.q[i]) > 1e-4);
    return this.items.filter(i => moved(i.pose, i.home)).map(i => ({ id: i.id, p: [...i.pose.p], q: [...i.pose.q] }));
  }
  /** Checkpoint seam: every prop returns to its saved (or home) pose, asleep. */
  restore(saved: unknown): void {
    const poses = new Map((saved as PropSnapshot | undefined)?.map(s => [s.id, s]));
    for (const item of this.items) if (!item.fixed) this.place(item, poses.get(item.id) ?? item.home);
  }
}
