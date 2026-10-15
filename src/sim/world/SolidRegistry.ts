import { groundAgent } from '../locomotion/AgentMotion';
import { staticCollision } from '../../assets/staticCollision';
import { vehicleDef } from '../../data/vehicles';
import { survivor } from '../../data/survivor';
import { SpatialHash, type ContactCells } from '../spatial/SpatialHash';
import type { SimWorld } from './SimWorld';
import type { EntitySnapshot, Transform } from './types';
import { boxContact, type SolidBox, type Contact } from './SolidGeometry';

type Point = { x: number; z: number; y: number };
interface Hull { entity: EntitySnapshot; boxes: SolidBox[]; pose: Transform; dirty: boolean; quiet: number; quietTick: number; nav?: SolidBox; navYaw?: number; navGrid?: import('../ai/NavGrid').NavGrid }
export interface CollisionOffender { tick: number; actor: number; other: number | string; depth: number; inside: boolean; writer: string }
const tolerance = .02, skin = .001;
/** One physical footprint. Reach, crowd spacing and animation envelopes are owned by combat/presentation. */
export function actorRadius(e: EntitySnapshot): number {
  return e.survivor ? survivor.radius : e.combat?.radius ?? .35;
}
function actor(e: EntitySnapshot): boolean {
  return !!(e.survivor || e.infected || e.civilian || e.companion || e.escort) && e.health.current > 0 && e.civilian?.state !== 'finished' && !e.corpse && !e.hidden && !e.infected?.hidden && !e.pendingAdmission && e.passengerOf === undefined;
}
/** Passengers and clingers have an explicit owner. Cosmetics (dead bodies, debris) have no actor mask. */
function pairExempt(a: EntitySnapshot | undefined, b: EntitySnapshot): boolean {
  return !!a && (a.passengerOf !== undefined && a.passengerOf === b.passengerOf || a.attachedTo === b.id || b.attachedTo === a.id || a.attachedTo !== undefined && a.attachedTo === b.attachedTo);
}
function layers(a: Point, b: Point): boolean { return Math.abs(a.y - b.y) < 1.2; }
function exemption(e: EntitySnapshot): number | string | undefined { return e.passengerOf ?? e.attachedTo ?? e.civilian?.schedule?.[e.civilian.scheduleStep ?? 0]?.seatProp; }

/** Simulation contact/admission owner. Static queries extend NavGrid's existing compound bake;
 * dynamic hulls use the existing SpatialHash and the APC's exact circle/OBB projection. */
export class SolidRegistry {
  readonly offenders: CollisionOffender[] = [];
  failures = 0;
  admitted = 0;
  deferred = 0;
  private readonly blockerOwners = new Map<string, number>();
  private readonly hulls = new Map<number, Hull>();
  private readonly hullIndex = new SpatialHash();
  private committed = new WeakMap<EntitySnapshot, Transform>();
  private writers = new WeakMap<EntitySnapshot, string>();
  private proposed = new WeakMap<EntitySnapshot, Transform>();
  private validated = new WeakMap<EntitySnapshot, { tick: number; radius: number; exemption: number | string | undefined; blocked: number; blocker: number; crowded: boolean; crowdUntil: number }>();
  private readonly nearby: number[] = [];
  private readonly hullNeighbors: number[] = [];
  private readonly bodies: EntitySnapshot[] = [];
  private readonly moved: EntitySnapshot[] = [];
  private readonly rejected = new Set<number>();
  private readonly bodyRejections = new Map<number, number>();
  private readonly movedIds = new Set<number>();
  private rollbackX = 0;
  private rollbackZ = 0;
  private rollbackRadius = 0;
  private readonly rollbackCells: ContactCells = { epoch: 0, radius: id => {
    const e = this.live.get(id);
    return e && this.movedIds.has(id) && !this.rejected.has(id) ? actorRadius(e) : 0;
  }, intersects: (maximum, x, z) => {
    if (!maximum) return false;
    const dx = Math.max(x - this.rollbackX, 0, this.rollbackX - x - 4), dz = Math.max(z - this.rollbackZ, 0, this.rollbackZ - z - 4);
    return dx * dx + dz * dz <= (this.rollbackRadius + maximum) ** 2;
  } };

  private readonly unresolved: EntitySnapshot[] = [];
  private readonly live = new Map<number, EntitySnapshot>();
  private committing = false;
  private bodyConflict = false;
  private bodyConflictId = 0;
  private readonly contact: Contact = { depth: 0, nx: 0, nz: 0, inside: false };
  private maxHull = 0;
  private maxActor: number = survivor.radius;
  private readonly changedActors = new Set<number>();
  private readonly changedHulls = new Set<number>();
  private changedTick = -1;
  private navRevision = -1;
  private nav: import('../ai/NavGrid').NavGrid | undefined;
  constructor(private readonly world: SimWorld) {}

  /** Vehicles, ambient traffic, convoy and setpieces all register by stable entity ID, including on restore. */
  register(e: EntitySnapshot): void {
    const previous = this.hulls.get(e.id);
    if (e.hidden || previous?.entity === e) return;
    if (previous) this.parkedHull(previous, false);
    let boxes: SolidBox[];
    if (e.vehicle) {
      const def = vehicleDef(e.archetype);
      boxes = [{ x: 0, z: 0, y: 0, halfX: def.length / 2, halfZ: def.width / 2, halfY: .3 }];
    } else {
      const shape = staticCollision[e.archetype];
      if (!shape || !(e.traffic || e.convoy || e.kind === 'setpiece' && e.archetype.startsWith('veh.'))) return;
      boxes = shape.boxes.map(b => ({ x: (b.min[0] + b.max[0]) / 2, y: (b.min[1] + b.max[1]) / 2 - (e.traffic || e.convoy ? .5 : .7), z: (b.min[2] + b.max[2]) / 2, halfX: (b.max[0] - b.min[0]) / 2, halfY: (b.max[1] - b.min[1]) / 2, halfZ: (b.max[2] - b.min[2]) / 2 }));
    }
    for (const b of boxes) this.maxHull = Math.max(this.maxHull, Math.hypot(Math.abs(b.x) + b.halfX, Math.abs(b.z) + b.halfZ));
    this.hulls.set(e.id, { entity: e, boxes, pose: { ...e.transform }, dirty: true, quiet: 0, quietTick: this.world.tick });
    this.hullIndex.set(e.id, e.transform.x, e.transform.z);
  }
  private syncHulls(): boolean {
    let changed = false;
    if (this.changedTick !== this.world.tick) { this.changedActors.clear(); this.changedHulls.clear(); this.changedTick = this.world.tick; }
    for (const e of this.world.entities.iterate()) if (e.vehicle || e.traffic || e.convoy || e.kind === 'setpiece') this.register(e);
    for (const [id, h] of this.hulls) {
      const e = this.world.entities.get(id), p = h.entity.transform;
      if (e !== h.entity || e.hidden) { this.parkedHull(h, false); this.hulls.delete(id); this.hullIndex.delete(id); changed = true; continue; }
      const stable = Math.hypot(h.pose.x - p.x, h.pose.z - p.z) < .01;
      if (!stable) h.quiet = 0;
      else if (h.quietTick !== this.world.tick) h.quiet++;
      h.quietTick = this.world.tick;
      // Parked hulls participate in ordinary grid routes. Moving convoy/traffic still use their existing yielding/sweeps.
      if (e.vehicle || e.traffic || e.archetype === 'veh.tank') this.parkedHull(h, h.quiet >= 15 && (e.vehicle?.speed ?? e.traffic?.speed ?? 0) < .2);
      if (h.dirty || h.pose.x !== p.x || h.pose.z !== p.z || h.pose.y !== p.y || h.pose.yaw !== p.yaw) { this.hullIndex.set(id, p.x, p.z); Object.assign(h.pose, p); h.dirty = false; changed = true; this.changedHulls.add(id);
        this.world.spatial.query({ x: p.x, z: p.z, r: this.maxHull + this.maxActor }, this.nearby, false);
        for (const actorId of this.nearby) this.changedActors.add(actorId); }
    }
    return changed;
  }
  private parkedHull(h: Hull, blocked: boolean): void {
    const e = h.entity, id = -e.id, p = e.transform, nav = this.world.infected?.nav;
    if (!nav || !blocked && !h.nav) return;
    if (blocked && h.nav && h.navGrid === nav && Math.hypot(h.nav.x - p.x, h.nav.z - p.z) < .25 && Math.abs((h.navYaw ?? 0) - p.yaw) < .1) return;
    let wall = h.nav;
    if (blocked) {
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const b of h.boxes) {
        const x = p.x + c * b.x + s * b.z, z = p.z - s * b.x + c * b.z;
        const hx = Math.abs(c) * b.halfX + Math.abs(s) * b.halfZ, hz = Math.abs(s) * b.halfX + Math.abs(c) * b.halfZ;
        x0 = Math.min(x0, x - hx); x1 = Math.max(x1, x + hx); z0 = Math.min(z0, z - hz); z1 = Math.max(z1, z + hz);
        y0 = Math.min(y0, p.y + b.y - b.halfY); y1 = Math.max(y1, p.y + b.y + b.halfY);
      }
      wall = { x: (x0+x1)/2, z: (z0+z1)/2, y: (y0+y1)/2, halfX: (x1-x0)/2, halfZ: (z1-z0)/2, halfY: (y1-y0)/2 };
      h.nav = wall; h.navYaw = p.yaw; h.navGrid = nav; this.aliasBlocker(id, e.id);
    } else { delete h.nav; delete h.navYaw; delete h.navGrid; }
    this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id, blocked, wall: wall! });
  }
  /** A parked nav blocker and its registered hull are one solid for explicit passenger relationships. */
  aliasBlocker(blockerId: number, hullId: number): void { this.blockerOwners.set(`blocker:${blockerId}`, hullId); }
  private solids(at: Point, radius: number, e: EntitySnapshot | undefined, visit: (box: SolidBox, id: number | string) => void): void {
    const owner = e?.passengerOf ?? e?.attachedTo;
    const activity = e?.civilian?.schedule?.[e.civilian.scheduleStep ?? 0];
    const seatOwner = activity?.seatProp ? this.world.props?.items.find(p => p.id === activity.seatProp)?.entityId : undefined;
    this.world.infected?.nav.visitSolids(at.x, at.z, radius, (box, id) => {
      // Navigation uses an AABB for the route bake; exact contact uses its canonical OBB below.
      const hullOwner = this.blockerOwners.get(id);
      if (hullOwner !== undefined && this.hulls.has(hullOwner)) return;
      if (at === e?.transform && (owner !== undefined && this.blockerOwners.get(id) === owner || seatOwner !== undefined && id === `blocker:${seatOwner}`)) return;
      // Support below the feet is walkable; contact only joins overlapping height layers.
      if (box.y + box.halfY > at.y - .65 + .05 && box.y - box.halfY < at.y + .65) visit(box, id);
    });
    if (!this.hulls.size) return;
    const passenger = owner ?? (e?.hidden ? this.world.missions?.l4?.passengerHull(e) : undefined);
    this.hullIndex.query({ x: at.x, z: at.z, r: this.maxHull + radius }, this.hullNeighbors, false);
    const worldBox: SolidBox = { x: 0, y: 0, z: 0, halfX: 0, halfZ: 0, halfY: 0 };
    for (const id of this.hullNeighbors) {
      const h = this.hulls.get(id); if (!h || h.entity.hidden || e && at === e.transform && passenger === id) continue;
      const p = h.entity.transform, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
      for (const b of h.boxes) {
        Object.assign(worldBox, b, { x: p.x + c * b.x + s * b.z, z: p.z - s * b.x + c * b.z, y: p.y + b.y, yaw: p.yaw });
        if (worldBox.y + b.halfY > at.y - .6 && worldBox.y - b.halfY < at.y + .6) visit(worldBox, id);
      }
    }
  }
  /** Radius and height aware occupancy, shared by spawn, checkpoint, relocation and exits. */
  clear(at: Point, radius: number, ignoreId?: number, bodies = true, limit = skin): boolean {
    this.bodyConflict = false;
    if (![at.x, at.y, at.z, radius].every(Number.isFinite) || radius <= 0) return false;
    let clear = true; const e = ignoreId === undefined ? undefined : this.world.entities.get(ignoreId);
    if (e && this.world.missions?.l4?.clearOfConvoy(at, e, radius) === false) return false;
    this.solids(at, radius, e, b => { const c = boxContact(b, at.x, at.z, radius, this.contact); if (c.inside || c.depth > limit) clear = false; });
    if (!clear || !bodies) return clear;
    this.world.spatial.query({ x: at.x, z: at.z, r: radius + this.maxActor }, this.nearby, false);
    for (const id of this.nearby) {
      const other = this.committing ? this.live.get(id) : this.world.entities.get(id);
      if (id === ignoreId || !other || !this.committing && !actor(other) || pairExempt(e, other) || !layers(at, other.transform)) continue;
      const dx = at.x - other.transform.x, dz = at.z - other.transform.z, reach = radius + actorRadius(other) - limit;
      if (dx * dx + dz * dz < reach * reach) { this.bodyConflict = true; this.bodyConflictId = id; return false; }
    }
    return true;
  }
  /** Bounded nearest-first search. null means retain the request; never accept the blocked anchor. */
  find(at: Point, radius: number, ignoreId?: number, range = 4, navigation = true): Point | null {
    const nav = this.world.infected?.nav;
    const fits = (p: Point) => (!navigation || !nav || nav.contains(p.x, p.z, radius)) && this.clear(p, radius, ignoreId);
    if (fits(at)) return { ...at };
    // Use the exact APC projection before quantized search rings, retaining near-contact ram/door distances.
    if (range > 0) {
      const projected = { ...at }, e = ignoreId === undefined ? undefined : this.world.entities.get(ignoreId);
      for (let pass = 0; pass < 8; pass++) {
        let changed = false;
        this.solids(projected, radius, e, box => {
          const c = boxContact(box, projected.x, projected.z, radius, this.contact);
          if (c.depth > skin) { projected.x += c.nx * c.depth; projected.z += c.nz * c.depth; changed = true; }
        });
        if (!changed) break;
      }
      if (Math.hypot(projected.x-at.x, projected.z-at.z) <= range && fits(projected)) return projected;
    }
    for (let r = .25; r <= range; r += .25) {
      const steps = Math.ceil(2 * Math.PI * r / .4);
      for (let k = 0; k < steps; k++) {
        const p = { x: at.x + Math.cos(k * Math.PI * 2 / steps) * r, z: at.z + Math.sin(k * Math.PI * 2 / steps) * r, y: at.y };
        if (fits(p)) return p;
      }
    }
    return null;
  }
  /** Preserve identity/counts when no safe spot is available; AI cannot move a pending actor. */
  admit(e: EntitySnapshot, writer: string, range = 4, navigation = true): boolean {
    const hidden = e.pendingAdmission && e.hidden === true ? e.pendingAdmission.hidden : e.hidden;
    this.maxActor = Math.max(this.maxActor, actorRadius(e));
    this.committed.delete(e); this.validated.delete(e);
    this.syncHulls(); this.writers.set(e, writer);
    const to = this.find(e.transform, actorRadius(e), e.id, range, navigation);
    if (!to) {
      if (!e.pendingAdmission) { e.pendingAdmission = { ...e.transform, writer, hidden: e.hidden, range, navigation, ...(e.id === 1 ? { colliderEnabled: this.world.physics.playerCollider?.isEnabled() } : {}) }; this.deferred++; }
      else Object.assign(e.pendingAdmission, e.transform, { writer, range, navigation, hidden });
      if (e.id === 1) this.world.physics.playerCollider?.setEnabled(false);
      e.hidden = true; this.world.spatial.delete(e.id); return false;
    }
    Object.assign(e.transform, to);
    if (e.pendingAdmission) { e.pendingAdmission.hidden = hidden; this.releasePending(e); }
    this.publish(e, true); this.admitted++; return true;
  }
  private releasePending(e: EntitySnapshot): void {
    const pending = e.pendingAdmission; if (!pending) return;
    e.hidden = pending.hidden;
    if (e.id === 1 && pending.colliderEnabled !== undefined) this.world.physics.playerCollider?.setEnabled(pending.colliderEnabled);
    if (e.survivor && e.health.current > 0 && pending.graceTicks) e.survivor.invulnerableUntil = this.world.tick + pending.graceTicks;
    delete e.pendingAdmission;
  }
  relocate(e: EntitySnapshot, at: Point, writer: string, range = 1.5, navigation = true): boolean {
    this.syncHulls(); const to = this.find(at, actorRadius(e), e.id, range, navigation);
    if (!to) return false;
    Object.assign(e.transform, to); this.releasePending(e); this.writers.set(e, writer); this.publish(e, true); this.committed.set(e, { ...e.transform }); this.validated.delete(e); return true;
  }
  /** A successful explicit relocation starts a new motion transaction. */
  wrote(e: EntitySnapshot, writer: string): void { this.writers.set(e, writer); }
  remember(e: EntitySnapshot, writer: string): void { this.committed.set(e, { ...e.transform }); this.validated.delete(e); this.writers.set(e, writer); }
  restore(): void {
    this.committed = new WeakMap(); this.validated = new WeakMap();
    for (const e of this.world.entities.iterate()) if (actor(e)) this.writers.set(e, 'checkpoint.restore');
    this.commit();
  }
  private publish(e: EntitySnapshot, ground = false): void {
    if (ground) groundAgent(this.world, e);
    this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    if (e.id === 1) {
      const physics = this.world.physics;
      physics.playerBody?.setTranslation(e.transform, true); physics.playerBody?.setNextKinematicTranslation(e.transform);
      const collider = physics.playerCollider?.translation();
      if (collider && (collider.x !== e.transform.x || collider.y !== e.transform.y || collider.z !== e.transform.z)) physics.world?.propagateModifiedBodyPositionsToColliders();
    }
  }
  /** Last phase, after cleanup + .25. Projection is bounded; unresolved motion rolls back to a safe prior pose. */
  commit(): void {
    this.syncHulls(); const nav = this.world.infected?.nav;
    const staticChanged = nav !== this.nav || nav?.revision !== this.navRevision;
    const full = this.world.tick % 60 === 0 || staticChanged;
    this.nav = nav; this.navRevision = nav?.revision ?? -1;
    this.bodies.length = this.moved.length = 0; this.live.clear();
    for (const e of this.world.entities.iterate()) {
      if (e.pendingAdmission && e.health.current <= 0) this.releasePending(e);
      if (e.pendingAdmission) {
        // Vehicle/checkpoint rebuilds can reset the Rapier mask before this final
        // phase. The admission owner keeps an uncommitted player body inactive.
        if (e.id === 1) this.world.physics.playerCollider?.setEnabled(false);
        const pending = e.pendingAdmission, p = e.transform;
        const scripted = pending.x !== p.x || pending.z !== p.z || pending.y !== p.y;
        if (scripted) Object.assign(pending, p);
        if (!scripted && this.world.tick % 30 !== e.id % 30) { e.hidden = true; this.world.spatial.delete(e.id); continue; }
        const to = this.find(pending, actorRadius(e), e.id, pending.range ?? 4, pending.navigation ?? true);
        if (to) { Object.assign(e.transform, to); this.releasePending(e); this.admitted++; this.publish(e); }
        else { e.hidden = true; this.world.spatial.delete(e.id); continue; }
      }
      if (!actor(e)) continue;
      const radius = actorRadius(e);
      this.maxActor = Math.max(this.maxActor, radius); this.bodies.push(e); this.live.set(e.id, e);
      this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
    // Scripted writers and revived actors may not have updated the shared index. Changed
    // hulls inspect the complete current actor index before selecting the tick's guard set.
    for (const id of this.changedHulls) {
      const h = this.hulls.get(id); if (!h) continue;
      this.world.spatial.query({ x: h.pose.x, z: h.pose.z, r: this.maxHull + this.maxActor }, this.nearby, false);
      for (const actorId of this.nearby) this.changedActors.add(actorId);
    }
    for (const e of this.bodies) {
      const radius = actorRadius(e), old = this.committed.get(e), p = e.transform;
      if (full || this.changedActors.has(e.id) || !old || old.x !== p.x || old.z !== p.z || old.y !== p.y) this.moved.push(e);
      else {
        const proof = this.validated.get(e);
        if (!proof || proof.tick !== this.world.tick - 1 || proof.radius !== radius || proof.exemption !== exemption(e)) this.moved.push(e);
      }
    }
    this.committing = true;
    // Accept a mutually clear set of simultaneous proposals atomically. A coherent formation
    // must be able to enter positions its neighbours vacate during this same tick.
    this.rejected.clear(); this.bodyRejections.clear(); this.unresolved.length = 0;
    const reject = (e: EntitySnapshot) => {
      if (this.rejected.has(e.id)) return;
      this.rejected.add(e.id); this.unresolved.push(e);
      let proposed = this.proposed.get(e);
      if (proposed) Object.assign(proposed, e.transform);
      else { proposed = { ...e.transform }; this.proposed.set(e, proposed); }
    };
    for (const e of this.moved) {
      const proof = this.validated.get(e), blocker = this.live.get(proof?.blocker ?? 0), p = e.transform, radius = actorRadius(e);
      // A previous contact is only a witness: retest its actual proposed pose,
      // current footprint, layer and attachment mask before rejecting movement.
      // If it has cleared, the normal registry query still checks every solid.
      if (blocker && !pairExempt(e, blocker) && layers(p, blocker.transform) &&
          (p.x - blocker.transform.x) ** 2 + (p.z - blocker.transform.z) ** 2 < (radius + actorRadius(blocker) - tolerance) ** 2) {
        this.bodyRejections.set(e.id, blocker.id); reject(e);
      } else if (!this.clear(p, radius, e.id, true, tolerance)) {
        if (this.bodyConflict) {
          this.bodyRejections.set(e.id, this.bodyConflictId);
          if (proof) proof.blocker = this.bodyConflictId;
        }
        reject(e);
      }
    }
    if (!this.unresolved.length) {
      for (const e of this.moved) if (e.id === 1) this.publish(e);
      this.finish(full); return;
    }
    this.movedIds.clear(); for (const e of this.moved) this.movedIds.add(e.id);
    this.rollbackCells.epoch++;
    // Reserve rollback positions only for the conflicting component. Propagate a
    // reservation to proposals it intersects; unrelated clear formations keep moving.
    for (let i = 0; i < this.unresolved.length; i++) {
      const e = this.unresolved[i];
      const old = this.committed.get(e);
      if (!old) { this.world.spatial.delete(e.id); continue; }
      Object.assign(e.transform, old); this.publish(e);
      const radius = actorRadius(e), proof = this.validated.get(e);
      // An unchanged body cannot intersect this same valid pose from last tick.
      // Reuse the hash's cell bounds to visit only unreserved moving proposals.
      const stable = proof?.tick === this.world.tick - 1 && proof.radius === radius && proof.exemption === exemption(e);
      this.rollbackX = old.x; this.rollbackZ = old.z; this.rollbackRadius = radius;
      this.world.spatial.query({ x: old.x, z: old.z, r: radius + this.maxActor }, this.nearby, false, undefined, stable ? this.rollbackCells : undefined);
      for (const id of this.nearby) {
        const other = this.live.get(id);
        if (!other || id === e.id || this.rejected.has(id) || stable && !this.movedIds.has(id) || pairExempt(e, other) || !layers(old, other.transform)) continue;
        const dx = old.x - other.transform.x, dz = old.z - other.transform.z;
        if (dx * dx + dz * dz < (radius + actorRadius(other) - tolerance) ** 2) reject(other);
      }
    }
    for (const e of this.moved) if (!this.rejected.has(e.id) && e.id === 1) this.publish(e);
    for (const admission of [false, true]) for (const e of this.unresolved) {
      const old = this.committed.get(e); if (!old !== admission) continue;
      const radius = actorRadius(e), p = e.transform, proposed = this.proposed.get(e)!;
      const proof = this.validated.get(e);
      const mayHold = !!(e.infected && !e.infected.specialAttack && proof && (this.world.tick + e.id) % 10 !== 0 && old && !this.failures && !staticChanged && !this.changedActors.has(e.id) && proof.tick === this.world.tick - 1 && proof.radius === radius && proof.exemption === exemption(e));
      if (mayHold && proof!.crowded && proof!.crowdUntil > this.world.tick) {
        const blocker = this.live.get(this.bodyRejections.get(e.id) ?? 0);
        // Reuse the actual failed contact only while it still blocks this proposal
        // after rollback. A neighbour that vacated it must still permit movement.
        if (blocker && layers(proposed, blocker.transform) &&
            (proposed.x - blocker.transform.x) ** 2 + (proposed.z - blocker.transform.z) ** 2 < (radius + actorRadius(blocker) - tolerance) ** 2) {
          proof!.blocked++; continue; // The previous valid pose is already reserved and published.
        }
      }
      Object.assign(p, proposed);
      let valid = this.clear(p, radius, e.id, true, tolerance);
      if (valid && proof) proof.blocked = 0;
      if (!valid) {
        let crowded = false;
        if (this.bodyConflict && e.infected && proof) {
          if (proof.crowdUntil <= this.world.tick) {
            // The contact query has a one-body reach: twelve nonpenetrating
            // centres cannot fit there. Count the local crowd in a 2 m ring.
            this.world.spatial.query({ x: p.x, z: p.z, r: Math.max(2, radius + this.maxActor) }, this.nearby, false);
            proof.crowded = this.nearby.length >= 8; proof.crowdUntil = this.world.tick + 30;
          }
          crowded = proof.crowded;
        }
        if (crowded && mayHold) {
          // Every earlier transaction respected this reserved pose. With the same solid geometry,
          // footprint and attachment mask, rejecting motion needs no second contact search.
          // Stagger the one-in-ten projection retries by actor ID, avoiding a
          // synchronized repair frame that dominates the E18 p95 window.
          proof!.blocked++; Object.assign(p, old); this.publish(e); continue;
        }
        if (proof) proof.blocked = 0;
        for (let pass = 0; pass < 4; pass++) {
          let moved = false;
          this.solids(p, radius, e, b => {
            const c = boxContact(b, p.x, p.z, radius, this.contact);
            if (c.depth > skin) { p.x += c.nx * c.depth; p.z += c.nz * c.depth; moved = true; }
          });
          this.world.spatial.query({ x: p.x, z: p.z, r: radius + this.maxActor }, this.nearby, false);
          for (const id of this.nearby) {
            const other = this.live.get(id);
            if (id === e.id || !other || pairExempt(e, other) || !layers(p, other.transform)) continue;
            const dx = p.x - other.transform.x, dz = p.z - other.transform.z, squared = dx * dx + dz * dz, reach = radius + actorRadius(other);
            if (squared >= (reach - tolerance) ** 2) continue;
            const d = Math.sqrt(squared), depth = reach - d;
            const nx = d ? dx / d : Math.cos(e.id * 2.399963), nz = d ? dz / d : Math.sin(e.id * 2.399963);
            const to = { x: p.x + nx * (depth + skin), z: p.z + nz * (depth + skin), y: p.y };
            if (!this.clear(to, radius, e.id, false)) continue;
            p.x = to.x; p.z = to.z; moved = true;
          }
          if (!moved) break;
        }
        // The courier's correction crosses the same 3D sweep as ordinary input.
        // A clear endpoint alone can otherwise cut through a stair riser or deck.
        if (e.id === 1) {
          const physics = this.world.physics, body = physics.playerBody, collider = physics.playerCollider, controller = physics.characterController;
          if (body && collider && controller) {
            physics.world!.propagateModifiedBodyPositionsToColliders();
            const from = body.translation(), displacement = { x: p.x - from.x, y: p.y - from.y, z: p.z - from.z };
            controller.computeColliderMovement(collider, displacement, undefined, collider.collisionGroups());
            controller.computedMovement(displacement);
            p.x = from.x + displacement.x; p.y = from.y + displacement.y; p.z = from.z + displacement.z;
          }
        }
        groundAgent(this.world, e);
        valid = this.clear(p, radius, e.id, true, tolerance);
        if (!valid) {
          const to = old && this.clear(old, radius, e.id, true, tolerance) ? old : this.find(proposed, radius, e.id, 4, false);
          if (to) { Object.assign(p, to); valid = true; }
          else if (!old) {
            e.pendingAdmission = { ...proposed, writer: this.writers.get(e) ?? 'tick.admission', hidden: e.hidden, range: 4, navigation: false };
            if (e.id === 1) { e.pendingAdmission.colliderEnabled = this.world.physics.playerCollider?.isEnabled(); this.world.physics.playerCollider?.setEnabled(false); }
            e.hidden = true; this.world.spatial.delete(e.id); this.live.delete(e.id); this.deferred++; continue;
          }
        }
      }
      this.publish(e);
      // This is the moved/new guard: each accepted position was checked against all reserved
      // bodies and solids. Full audits independently check the complete index once per second.
      if (!valid) this.auditActor(e);
    }
    this.finish(full);
  }
  private finish(full: boolean): void {
    if (full) for (const e of this.bodies) if (actor(e)) this.auditActor(e);
    for (const e of this.bodies) if (actor(e)) {
      const old = this.committed.get(e);
      if (old) Object.assign(old, e.transform); else this.committed.set(e, { ...e.transform });
      const proof = this.validated.get(e);
      if (proof) { proof.tick = this.world.tick; proof.radius = actorRadius(e); proof.exemption = exemption(e); }
      else this.validated.set(e, { tick: this.world.tick, radius: actorRadius(e), exemption: exemption(e), blocked: 0, blocker: 0, crowded: false, crowdUntil: 0 });
    }
    this.committing = false;
  }
  private record(e: EntitySnapshot, other: number | string, depth: number, inside: boolean): void {
    this.failures++;
    if (this.offenders.length === 64) this.offenders.shift();
    this.offenders.push({ tick: this.world.tick, actor: e.id, other, depth, inside, writer: this.writers.get(e) ?? 'tick/contact-commit' });
  }
  private auditActor(e: EntitySnapshot): void {
    const p = e.transform, radius = actorRadius(e);
    this.solids(p, radius, e, (b, id) => {
      const c = boxContact(b, p.x, p.z, radius, this.contact);
      if (c.inside || c.depth > tolerance + 1e-6) this.record(e, id, c.depth, c.inside);
    });
    this.world.spatial.query({ x: p.x, z: p.z, r: radius + this.maxActor }, this.nearby, false);
    for (const id of this.nearby) {
      const other = this.world.entities.get(id);
      if (id === e.id || !other || !actor(other) || pairExempt(e, other) || !layers(p, other.transform)) continue;
      const depth = radius + actorRadius(other) - Math.hypot(p.x - other.transform.x, p.z - other.transform.z);
      if (depth > tolerance + 1e-6) this.record(e, id, depth, false);
    }
  }
  snapshot() {
    const pending = this.world.entities.values().filter(e => e.pendingAdmission);
    return { failures: this.failures, pending: pending.length, admitted: this.admitted, deferred: this.deferred,
      requests: pending.slice(0, 64).map(e => ({ id: e.id, archetype: e.archetype, ...e.pendingAdmission })), offenders: this.offenders.map(o => ({ ...o })) };
  }
  reset(): void { this.bodies.length = this.moved.length = this.nearby.length = this.hullNeighbors.length = 0; this.changedActors.clear(); this.changedHulls.clear(); this.changedTick = -1; this.rejected.clear(); this.bodyRejections.clear(); this.unresolved.length = 0; this.live.clear(); this.committing = false; this.blockerOwners.clear(); this.hulls.clear(); this.hullIndex.reset(); this.committed = new WeakMap(); this.proposed = new WeakMap(); this.validated = new WeakMap(); this.writers = new WeakMap(); this.offenders.length = 0; this.failures = this.admitted = this.deferred = 0; this.maxHull = 0; this.maxActor = survivor.radius; this.navRevision = -1; this.nav = undefined; }
}
