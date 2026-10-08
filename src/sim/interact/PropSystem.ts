// Adapted from Bruno Simon folio-2025 Objects.js (MIT): sleeping dynamic bodies, sync only while awake, reset when fallen.
import { overlapsRoad } from '../../levels/districts/validate';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { pushableProps } from '../../data/pushableProps';
import type { Placement } from '../../levels/districts/types';
import type { DistrictWorld } from '../world/DistrictWorld';
import type { SimWorld } from '../world/SimWorld';

/** Plain pose mirror of a body: render sync and snapshots never touch WASM. Quaternion is x, y, z, w. */
export interface PropPose { p: [number, number, number]; q: [number, number, number, number] }
export interface PushProp { entityId: number; half: number[]; metadata: import('../../data/pushableProps').PhysicsAsset; braced: boolean; id: string; assetId: string; mass: number; radius: number; home: PropPose; pose: PropPose; body: RAPIER.RigidBody; collider: RAPIER.Collider; awake: boolean; fixed: boolean }
export type PropSnapshot = { id: string; p: [number, number, number]; q: [number, number, number, number] }[];

/** Simultaneously simulated props; the farthest settle first beyond this (Bruno keeps most asleep). */
export const MAX_AWAKE_PROPS = 12;
/** Running infected shove props up to this speed (m/s) along their approach. */
const SHOVE_SPEED = 1.6;
const yawPose = (p: Placement): PropPose => ({ p: [...p.position], q: [0, Math.sin(p.yaw / 2), 0, Math.cos(p.yaw / 2)] });

/** E26 authored movable props: pushable instanced props as deterministic Rapier bodies in the fixed-step
 * sim. The survivor pushes with class speed penalties; infected shove light/medium bodies on contact. */
export class PropSystem {
  private rebuildingIds = new Map<string, number>();
  /** Fixture-only stress override; production keeps the established 12-body cap. */
  awakeBudget = MAX_AWAKE_PROPS;
  private burstUntil = 0;
  /** E27: a blast lets launched props fly (up to the spec 07 §8 low-tier cap of 60) instead of freezing mid-air at 12. */
  burst(untilTick: number): void { this.burstUntil = Math.max(this.burstUntil, untilTick); }
  readonly items: PushProp[] = [];
  private readonly nearby: number[] = [];
  constructor(private readonly world: SimWorld) {
    world.events.on('combat.hit', e => {
      if (e.type !== 'combat.hit') return;
      const item = this.items.find(i => i.entityId === e.targetId);
      if (item && this.world.entities.get(item.entityId)!.health.current <= 0) { item.body.setEnabled(false); item.awake = false; this.world.spatial.delete(item.entityId); this.world.events.emit({ type: 'prop.broken', tick: world.tick, id: item.entityId, pieces: 0 }); }
    });
  }
  /** (Re)create every pushable of the district set in its placement order; `saved` poses survive a tier rebuild/checkpoint. */
  install(districts: DistrictWorld, saved?: PropSnapshot, preserveDisplaced = false): void {
    const previousItems = this.items.slice();
    const ids = new Map(this.items.map(i => [i.id, i.entityId]));
    this.items.length = 0;
    this.rebuildingIds = ids;
    const poses = new Map(saved?.map(s => [s.id, s]));
    for (const d of districts.districts) for (const placement of d.pushables) {
      const id = `${d.id}/${placement.id}`, savedPose = poses.get(id);
      // Level assembly rejects displaced furniture on roads. Checkpoint restore below keeps gameplay poses.
      if (savedPose && districts.composition.id === 'L2' && !preserveDisplaced) {
        const dx = savedPose.p[0] - d.origin[0] - placement.position[0], dz = savedPose.p[2] - d.origin[1] - placement.position[2];
        const box = { min: [...placement.visualAabb.min] as [number, number, number], max: [...placement.visualAabb.max] as [number, number, number] };
        for (const k of ['min', 'max'] as const) { box[k][0] += dx; box[k][2] += dz; }
        if (overlapsRoad(d.layout, box)) poses.delete(id);
      }
      this.spawn(placement, d.origin, poses.get(id), id);
    }
    for (const previous of previousItems) if (!this.items.some(p => p.id === previous.id)) { this.world.spatial.delete(previous.entityId); this.world.entities.delete(previous.entityId); }
    this.settle(poses); this.rebuildingIds.clear();
    for (const p of this.items) p.body.setEnabled((this.world.entities.get(p.entityId)?.health.current ?? 0) > 0);
  }
  /** Spawn one authored prop, also used by deterministic prop-yard fixtures. */
  spawn(placement: Placement, origin: [number, number] = [0, 0], restored?: PropSnapshot[number], id = placement.id): PushProp {
      const metadata = pushableProps[placement.assetId];
      if (!metadata) throw new Error(`Not movable: ${placement.assetId}`);
      const shape = metadata.boxes;
      const min = [Infinity, 0, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const box of shape) for (let axis = 0; axis < 3; axis++) { if (axis !== 1) min[axis] = Math.min(min[axis], box.min[axis]); max[axis] = Math.max(max[axis], box.max[axis]); }
      const s = placement.scale, half = [0, 1, 2].map(i => (max[i] - min[i]) * s[i] / 2), center = [0, 1, 2].map(i => (max[i] + min[i]) * s[i] / 2);
      const home = yawPose(placement); home.p[0] += origin[0]; home.p[2] += origin[1];
      const pose: PropPose = restored ? { p: [...restored.p], q: [...restored.q] } : { p: [...home.p], q: [...home.q] };
      const mass = metadata.mass;
      const body = this.world.physics.world!.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(...pose.p).setRotation({ x: pose.q[0], y: pose.q[1], z: pose.q[2], w: pose.q[3] })
        .setLinearDamping(1.2).setAngularDamping(2.5).setSleeping(true));
      const collider = this.world.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2]).setTranslation(center[0], center[1], center[2])
        .setFriction(metadata.friction ?? .7).setRestitution(metadata.restitution ?? .05)
        // Bottom-weighted, stiffer than a uniform box: props slide and only tip over when shoved hard.
        .setMassProperties(mass, { x: (metadata.centerOfMass ? metadata.centerOfMass[0] * s[0] : center[0]), y: (metadata.centerOfMass ? metadata.centerOfMass[1] * s[1] : center[1] * .45), z: (metadata.centerOfMass ? metadata.centerOfMass[2] * s[2] : center[2]) }, { x: mass * (half[1] ** 2 + half[2] ** 2) / 3 * 2.6, y: mass * (half[0] ** 2 + half[2] ** 2) / 3, z: mass * (half[0] ** 2 + half[1] ** 2) / 3 * 2.6 }, { x: 0, y: 0, z: 0, w: 1 }), body);
      const hp = metadata.breakable?.hp ?? metadata.barricadeHP ?? 80;
      const entityId = this.rebuildingIds.get(id) ?? this.world.entities.create({ kind: 'physics-prop', archetype: placement.assetId, faction: 'environment', transform: { x: pose.p[0], y: pose.p[1], z: pose.p[2], yaw: placement.yaw }, health: { current: hp, max: hp }, combat: { radius: Math.max(half[0], half[2]), armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] } }).id;
      this.world.spatial.set(entityId, pose.p[0], pose.p[2]);
      const item = { entityId, half, metadata, braced: false, id, assetId: placement.assetId, mass, radius: Math.hypot(half[0], half[2]), home, pose, body, collider, awake: false, fixed: false };
      this.items.push(item); return item;
  }
  settle(poses = new Map<string, PropSnapshot[number]>()): void {
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
      if (item.fixed || item.braced || !item.body.isEnabled()) continue;
      if (item.metadata.class === 'heavy') {
        if (!this.shoulderPush && !item.body.isFixed()) item.body.setBodyType(RAPIER.RigidBodyType.Fixed, false);
        else if (this.shoulderPush && item.body.isFixed()) item.body.setBodyType(RAPIER.RigidBodyType.Dynamic, false);
        continue;
      }
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
  /** Mirror awake poses, recover props that fall through ground, and settle the farthest beyond the awake cap. */
  postPhysics(): void {
    const player = this.world.entities.get(1)?.transform;
    let awake = 0;
    for (const item of this.items) {
      item.awake = !item.fixed && !item.braced && item.body.isEnabled() && !item.body.isFixed() && !item.body.isSleeping();
      if (!item.awake) continue;
      awake++;
      const t = item.body.translation();
      if (t.y < -5) {
        const r = item.body.rotation(), ground = this.world.districts?.groundHeight(t.x, t.z) ?? 0;
        // Keep the displaced location and orientation. A physics escape must not
        // delete a knocked prop or silently return it to its authored placement.
        this.place(item, { p: [t.x, ground + Math.hypot(...item.half) * 2, t.z], q: [r.x, r.y, r.z, r.w] });
        item.body.wakeUp(); continue;
      }
      this.mirror(item);
    }
    const budget = this.world.tick < this.burstUntil ? Math.max(this.awakeBudget, 60) : this.awakeBudget;
    if (awake <= budget || !player) return;
    const ranked = this.items.filter(i => i.awake).map(i => ({ i, d: (i.pose.p[0] - player.x) ** 2 + (i.pose.p[2] - player.z) ** 2 }))
      .sort((a, b) => b.d - a.d || (a.i.id < b.i.id ? -1 : 1));
    for (let n = 0; n < awake - budget; n++) { const item = ranked[n].i; item.body.setLinvel({ x: 0, y: 0, z: 0 }, false); item.body.setAngvel({ x: 0, y: 0, z: 0 }, false); item.body.sleep(); item.awake = false; }
  }
  /** Upgrade seam; false by default. Heavy props retain collision until unlocked. */
  shoulderPush = false;
  /** Called before player intent so the existing locomotion controller applies the push penalty. */
  pushSpeed(input: import('../../input/InputFrame').InputFrame): number {
    const p = this.world.entities.get(1)!; const length = Math.hypot(input.move.x, input.move.z);
    if (!length || this.world.vehicles?.active != null || p.riding !== undefined) return 1;
    const nx = input.move.x / length, nz = input.move.z / length;
    let scale = 1;
    for (const item of this.items) {
      if (item.fixed || item.braced || !item.body.isEnabled()) continue;
      const dx = item.pose.p[0] - p.transform.x, dz = item.pose.p[2] - p.transform.z;
      if (dx * nx + dz * nz <= 0 || Math.hypot(dx, dz) > item.radius + .55) continue;
      if (item.metadata.class === 'heavy') {
        if (!this.shoulderPush) { item.body.setBodyType(RAPIER.RigidBodyType.Fixed, false); continue; }
        item.body.setBodyType(RAPIER.RigidBodyType.Dynamic, false); scale = Math.min(scale, .25);
      } else if (item.metadata.class === 'medium') scale = Math.min(scale, .55);
      if (item.metadata.class !== 'light') {
        const v = item.body.linvel(), speed = 4.5 * scale;
        const impulse = item.mass * Math.max(0, speed - v.x * nx - v.z * nz);
        item.body.applyImpulse({ x: nx * impulse, y: 0, z: nz * impulse }, true);
      }
    }
    return scale;
  }
  /** Brace pins bodies without spending the awake budget; break releases them inward. */
  brace(item: PushProp, on: boolean, inward = { x: 0, z: 1 }): void {
    item.braced = on; item.body.setBodyType(on ? RAPIER.RigidBodyType.KinematicPositionBased : RAPIER.RigidBodyType.Dynamic, false);
    if (on) { item.body.sleep(); item.awake = false; }
    else { item.body.applyImpulse({ x: inward.x * item.mass * 2, y: item.mass, z: inward.z * item.mass * 2 }, true); item.awake = true; }
  }
  private mirror(item: PushProp): void {
    const t = item.body.translation(), r = item.body.rotation();
    item.pose.p[0] = t.x; item.pose.p[1] = t.y; item.pose.p[2] = t.z;
    const entity = this.world.entities.get(item.entityId);
    if (entity) { entity.transform.x = t.x; entity.transform.y = t.y; entity.transform.z = t.z; this.world.spatial.set(entity.id, t.x, t.z); }
    item.pose.q[0] = r.x; item.pose.q[1] = r.y; item.pose.q[2] = r.z; item.pose.q[3] = r.w;
  }
  place(item: PushProp, pose: PropPose): void {
    item.pose = { p: [...pose.p], q: [...pose.q] };
    item.body.setTranslation({ x: pose.p[0], y: pose.p[1], z: pose.p[2] }, false);
    item.body.setRotation({ x: pose.q[0], y: pose.q[1], z: pose.q[2], w: pose.q[3] }, false);
    item.body.setLinvel({ x: 0, y: 0, z: 0 }, false); item.body.setAngvel({ x: 0, y: 0, z: 0 }, false); item.body.sleep(); item.awake = false; this.mirror(item);
  }
  /** Displaced props only (home poses are implied by the layout), in placement order. */
  snapshot(): PropSnapshot {
    const moved = (a: PropPose, b: PropPose) => a.p.some((v, i) => Math.abs(v - b.p[i]) > 1e-4) || a.q.some((v, i) => Math.abs(v - b.q[i]) > 1e-4);
    return this.items.filter(i => moved(i.pose, i.home)).map(i => ({ id: i.id, p: [...i.pose.p], q: [...i.pose.q] }));
  }
  /** Checkpoint seam: every prop returns to its saved (or home) pose, asleep. */
  restore(saved: unknown): void {
    const poses = new Map((saved as PropSnapshot | undefined)?.map(s => [s.id, s]));
    for (const item of this.items) { item.body.setEnabled((this.world.entities.get(item.entityId)?.health.current ?? 0) > 0); if (!item.fixed) this.place(item, poses.get(item.id) ?? item.home); }
  }
}
