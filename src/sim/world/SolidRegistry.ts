import { staticCollision } from '../../assets/staticCollision';
import { vehicleDef } from '../../data/vehicles';
import { survivor } from '../../data/survivor';
import { SpatialHash } from '../spatial/SpatialHash';
import type { SimWorld } from './SimWorld';
import type { EntitySnapshot, Transform } from './types';
import { boxContact, type SolidBox, type Contact } from './SolidGeometry';

type Point = { x: number; z: number; y: number };
interface Hull { entity: EntitySnapshot; boxes: SolidBox[]; pose: Transform }
export interface CollisionOffender { tick: number; actor: number; other: number | string; depth: number; inside: boolean; writer: string }
const tolerance = .02, skin = .001;
/** One physical footprint. Reach, crowd spacing and animation envelopes are owned by combat/presentation. */
export function actorRadius(e: EntitySnapshot): number {
  return e.survivor ? survivor.radius : e.combat?.radius ?? (e.companion ? .3 : .35);
}
function actor(e: EntitySnapshot): boolean {
  return !!(e.survivor || e.infected || e.civilian || e.companion || e.escort) && e.health.current > 0 && !e.corpse && !e.hidden && !e.infected?.hidden && !e.pendingAdmission;
}
/** Passengers and clingers have an explicit owner. Cosmetics (dead bodies, debris) have no actor mask. */
function attached(a: EntitySnapshot, id: number): boolean { return a.passengerOf === id || a.attachedTo === id || (a.id === 1 && a.hidden); }
function pairExempt(a: EntitySnapshot | undefined, b: EntitySnapshot): boolean {
  return !!a && a.passengerOf !== undefined && a.passengerOf === b.passengerOf;
}
function layers(a: Point, b: Point): boolean { return Math.abs(a.y - b.y) < 1.2; }

/** Simulation contact/admission owner. Static queries extend NavGrid's existing compound bake;
 * dynamic hulls use the existing SpatialHash and the APC's exact circle/OBB projection. */
export class SolidRegistry {
  readonly offenders: CollisionOffender[] = [];
  failures = 0;
  admitted = 0;
  deferred = 0;
  private readonly hulls = new Map<number, Hull>();
  private readonly hullIndex = new SpatialHash();
  private committed = new WeakMap<EntitySnapshot, Transform>();
  private writers = new WeakMap<EntitySnapshot, string>();
  private readonly nearby: number[] = [];
  private readonly hullNeighbors: number[] = [];
  private readonly bodies: EntitySnapshot[] = [];
  private readonly moved: EntitySnapshot[] = [];
  private readonly contact: Contact = { depth: 0, nx: 0, nz: 0, inside: false };
  private maxHull = 0;
  private maxActor = 2;
  private navRevision = -1;
  private nav: import('../ai/NavGrid').NavGrid | undefined;
  constructor(private readonly world: SimWorld) {}

  /** Vehicles, ambient traffic, convoy and setpieces all register by stable entity ID, including on restore. */
  register(e: EntitySnapshot): void {
    if (e.hidden || this.hulls.get(e.id)?.entity === e) return;
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
    this.hulls.set(e.id, { entity: e, boxes, pose: { ...e.transform } });
    this.hullIndex.set(e.id, e.transform.x, e.transform.z);
  }
  private syncHulls(): boolean {
    let changed = false;
    for (const e of this.world.entities.iterate()) if (e.vehicle || e.traffic || e.convoy || e.kind === 'setpiece') this.register(e);
    for (const [id, h] of this.hulls) {
      const e = this.world.entities.get(id), p = h.entity.transform;
      if (e !== h.entity || e.hidden) { this.hulls.delete(id); this.hullIndex.delete(id); changed = true; continue; }
      if (h.pose.x !== p.x || h.pose.z !== p.z || h.pose.y !== p.y || h.pose.yaw !== p.yaw) { this.hullIndex.set(id, p.x, p.z); Object.assign(h.pose, p); changed = true; }
    }
    return changed;
  }
  private solids(at: Point, radius: number, e: EntitySnapshot | undefined, visit: (box: SolidBox, id: number | string) => void): void {
    this.world.infected?.nav.visitSolids(at.x, at.z, radius, (box, id) => {
      // Support below the feet is walkable; navigation-only walls explicitly reserve the ground layer.
      if ((box.navBlocker && at.y < 1.8) || box.y + box.halfY > at.y - .65 + .05 && box.y - box.halfY < at.y + .65) visit(box, id);
    });
    this.hullIndex.query({ x: at.x, z: at.z, r: this.maxHull + radius }, this.hullNeighbors);
    const worldBox: SolidBox = { x: 0, y: 0, z: 0, halfX: 0, halfZ: 0, halfY: 0 };
    for (const id of this.hullNeighbors) {
      const h = this.hulls.get(id); if (!h || h.entity.hidden || e && at === e.transform && attached(e, id)) continue;
      const p = h.entity.transform, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
      for (const b of h.boxes) {
        Object.assign(worldBox, b, { x: p.x + c * b.x + s * b.z, z: p.z - s * b.x + c * b.z, y: p.y + b.y, yaw: p.yaw });
        if (worldBox.y + b.halfY > at.y - .6 && worldBox.y - b.halfY < at.y + .6) visit(worldBox, id);
      }
    }
  }
  /** Radius and height aware occupancy, shared by spawn, checkpoint, relocation and exits. */
  clear(at: Point, radius: number, ignoreId?: number, bodies = true): boolean {
    if (![at.x, at.y, at.z, radius].every(Number.isFinite) || radius <= 0) return false;
    let clear = true; const e = ignoreId === undefined ? undefined : this.world.entities.get(ignoreId);
    this.solids(at, radius, e, b => { if (boxContact(b, at.x, at.z, radius, this.contact).depth > skin) clear = false; });
    if (!clear || !bodies) return clear;
    this.world.spatial.query({ x: at.x, z: at.z, r: radius + this.maxActor }, this.nearby);
    for (const id of this.nearby) {
      const other = this.world.entities.get(id);
      if (id === ignoreId || !other || !actor(other) || pairExempt(e, other) || !layers(at, other.transform)) continue;
      if (Math.hypot(at.x - other.transform.x, at.z - other.transform.z) < radius + actorRadius(other) - skin) return false;
    }
    return true;
  }
  /** Bounded nearest-first search. null means retain the request; never accept the blocked anchor. */
  find(at: Point, radius: number, ignoreId?: number, range = 4, navigation = true): Point | null {
    const nav = this.world.infected?.nav;
    const fits = (p: Point) => (!navigation || !nav || nav.clear(p.x, p.z, radius, true)) && this.clear(p, radius, ignoreId);
    if (fits(at)) return { ...at };
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
    this.syncHulls(); this.writers.set(e, writer);
    const to = this.find(e.transform, actorRadius(e), e.id, range, navigation);
    if (!to) {
      if (!e.pendingAdmission) { e.pendingAdmission = { ...e.transform, writer, hidden: e.hidden }; this.deferred++; }
      e.hidden = true; this.world.spatial.delete(e.id); return false;
    }
    Object.assign(e.transform, to); delete e.pendingAdmission;
    this.publish(e); this.admitted++; return true;
  }
  relocate(e: EntitySnapshot, at: Point, writer: string, range = 1.5): boolean {
    this.syncHulls(); const to = this.find(at, actorRadius(e), e.id, range);
    if (!to) return false;
    Object.assign(e.transform, to); this.writers.set(e, writer); this.publish(e); this.committed.set(e, { ...e.transform }); return true;
  }
  /** A successful explicit relocation starts a new motion transaction. */
  remember(e: EntitySnapshot, writer: string): void { this.committed.set(e, { ...e.transform }); this.writers.set(e, writer); }
  restore(): void {
    this.committed = new WeakMap();
    for (const e of this.world.entities.iterate()) if (actor(e)) this.writers.set(e, 'checkpoint.restore');
    this.commit();
  }
  private publish(e: EntitySnapshot): void {
    this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    if (e.id === 1) { this.world.physics.playerBody?.setTranslation(e.transform, true); this.world.physics.playerBody?.setNextKinematicTranslation(e.transform); }
  }
  /** Last phase, after cleanup + .25. Projection is bounded; unresolved motion rolls back to a safe prior pose. */
  commit(): void {
    const hullChanged = this.syncHulls(), nav = this.world.infected?.nav;
    const full = this.world.tick % 60 === 0 || hullChanged || nav !== this.nav || nav?.revision !== this.navRevision;
    this.nav = nav; this.navRevision = nav?.revision ?? -1;
    this.bodies.length = this.moved.length = 0;
    for (const e of this.world.entities.iterate()) {
      if (e.pendingAdmission) {
        const pending = e.pendingAdmission;
        const to = this.find(pending, actorRadius(e), e.id);
        if (to) { Object.assign(e.transform, to); e.hidden = pending.hidden; delete e.pendingAdmission; this.admitted++; this.publish(e); }
        else { e.hidden = true; this.world.spatial.delete(e.id); continue; }
      }
      if (!actor(e)) continue;
      this.maxActor = Math.max(this.maxActor, actorRadius(e)); this.bodies.push(e);
      const old = this.committed.get(e), p = e.transform;
      if (full || !old || old.x !== p.x || old.z !== p.z || old.y !== p.y) this.moved.push(e);
    }
    for (const e of this.moved) {
      const radius = actorRadius(e), p = e.transform, old = this.committed.get(e);
      // Actor motion is swept using full physical radius. Scripted relocations explicitly use admission.
      if (nav && old && layers(p, old) && this.clear(old, radius, e.id, false) && !nav?.visible(old, p, radius)) {
        const dx = p.x - old.x, dz = p.z - old.z;
        Object.assign(p, old); nav?.move(p, dx, dz, radius, true);
      }
      for (let pass = 0; pass < 8; pass++) {
        let moved = false;
        this.solids(p, radius, e, b => {
          const c = boxContact(b, p.x, p.z, radius, this.contact);
          if (c.depth > skin) { p.x += c.nx * (c.depth + skin); p.z += c.nz * (c.depth + skin); moved = true; }
        });
        if (!moved) break;
      }
      this.publish(e);
      if (!this.clear(p, radius, e.id)) {
        // Only bodies still in contact pay for bounded placement; ordinary motion keeps its exact result.
        const to = this.find(p, radius, e.id, 2, false) ?? (old && this.clear(old, radius, e.id) ? old : null);
        if (to) { Object.assign(p, to); this.publish(e); }
      }
    }
    // Audit every moved/new actor, and every actor once a second. Keep a bounded diagnostic ring.
    for (const e of full ? this.bodies : this.moved) this.auditActor(e);
    for (const e of this.bodies) {
      const old = this.committed.get(e);
      if (old) Object.assign(old, e.transform); else this.committed.set(e, { ...e.transform });
    }
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
    this.world.spatial.query({ x: p.x, z: p.z, r: radius + this.maxActor }, this.nearby);
    for (const id of this.nearby) {
      const other = this.world.entities.get(id);
      if (id === e.id || !other || !actor(other) || pairExempt(e, other) || !layers(p, other.transform)) continue;
      const depth = radius + actorRadius(other) - Math.hypot(p.x - other.transform.x, p.z - other.transform.z);
      if (depth > tolerance + 1e-6) this.record(e, id, depth, false);
    }
  }
  snapshot() { return { failures: this.failures, pending: this.bodies.length ? this.world.entities.values().filter(e => e.pendingAdmission).length : 0, admitted: this.admitted, deferred: this.deferred, offenders: this.offenders.map(o => ({ ...o })) }; }
  reset(): void { this.hulls.clear(); this.hullIndex.reset(); this.committed = new WeakMap(); this.writers = new WeakMap(); this.offenders.length = 0; this.failures = this.admitted = this.deferred = 0; this.maxHull = 0; this.navRevision = -1; this.nav = undefined; }
}
