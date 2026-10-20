import { groundAgent } from '../locomotion/AgentMotion';
import { staticCollision } from '../../assets/staticCollision';
import { vehicleDef } from '../../data/vehicles';
import { survivor } from '../../data/survivor';
import { SpatialHash, type ContactCells } from '../spatial/SpatialHash';
import type { SimWorld } from './SimWorld';
import type { EntitySnapshot, Transform } from './types';
import { boxContact, type SolidBox, type Contact } from './SolidGeometry';

type Point = { x: number; z: number; y: number; yaw?: number };
interface BodyProof { tick: number; radius: number; exemption: number | string | undefined; blocked: number; blocker: number; crowded: boolean; crowdUntil: number }
interface Hull { entity: EntitySnapshot; boxes: SolidBox[]; pose: Transform; dirty: boolean; quiet: number; quietTick: number; nav?: SolidBox; navYaw?: number; navGrid?: import('../ai/NavGrid').NavGrid }
export interface CollisionOffender { tick: number; actor: number; other: number | string; depth: number; inside: boolean; writer: string }
const tolerance = .02, skin = .001;
/** One physical footprint. Reach, crowd spacing and animation envelopes are owned by combat/presentation. */
export function actorRadius(e: EntitySnapshot): number {
  // Corgi uses a 0.88 m wide capsule, with fore/aft probes for its longer body.
  return e.companion ? .44 : e.survivor ? survivor.radius : e.combat?.radius ?? .35;
}
function actor(e: EntitySnapshot): boolean {
  return !!(e.survivor || e.infected || e.civilian || e.companion || e.escort) && e.health.current > 0 && e.civilian?.state !== 'finished' && !e.corpse && !e.hidden && !e.infected?.hidden && !e.pendingAdmission && e.passengerOf === undefined;
}
/** Passengers and clingers have an explicit owner. Cosmetics (dead bodies, debris) have no actor mask. */
function pairExempt(a: EntitySnapshot | undefined, b: EntitySnapshot): boolean {
  if (!a) return false;
  const passenger = a.passengerOf, owner = a.attachedTo, other = b.attachedTo;
  return passenger !== undefined && passenger === b.passengerOf || owner !== undefined && (owner === b.id || owner === other) || other !== undefined && other === a.id;
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
  private readonly barriers = new Map<string, SolidBox>();
  private barrierRevision = 0;
  private committedBarrierRevision = -1;
  private readonly blockerOwners = new Map<string, number>();
  private readonly hulls = new Map<number, Hull>();
  private hullRevision = -1;
  private readonly hullCandidates: EntitySnapshot[] = [];
  private readonly hullIndex = new SpatialHash();
  /** Contact queries use 2 m cells; AI and hearing retain the shared 4 m grid. */
  private readonly bodyIndex = new SpatialHash(2);
  private readonly query = { x: 0, z: 0, r: 0 };
  private readonly correction = { x: 0, y: 0, z: 0 };
  private committed = new WeakMap<EntitySnapshot, Transform>();
  private writers = new WeakMap<EntitySnapshot, string>();
  private proposed = new WeakMap<EntitySnapshot, Transform>();
  private validated = new WeakMap<EntitySnapshot, BodyProof>();
  private readonly nearby: number[] = [];
  private readonly hullNeighbors: number[] = [];
  private readonly bodies: EntitySnapshot[] = [];
  private bodyIds: number[] = [];
  private previousBodyIds: number[] = [];
  private readonly committedPoses: (Transform | undefined)[] = [];
  private readonly proposalPoints: (Transform | undefined)[] = [];
  private readonly contactProofs: (BodyProof | undefined)[] = [];
  private readonly bodyRadii: number[] = [];
  /** Transform references and attachment eligibility are stable during commit. */
  private readonly bodyPoints: (Transform | undefined)[] = [];
  private hasPairExemptions = false;
  private readonly moved: EntitySnapshot[] = [];
  private readonly rejected: boolean[] = [];
  private readonly bodyRejections: number[] = [];
  private readonly movedIds: boolean[] = [];
  private rollbackX = 0;
  private rollbackZ = 0;
  private rollbackRadius = 0;
  private readonly rollbackCells: ContactCells = { epoch: 0, radius: id => {
    const e = this.live[id];
    return e && this.movedIds[id] && !this.rejected[id] ? e.companion ? this.bodyRadii[id] + .4 : this.bodyRadii[id] : 0;
  }, intersects: (maximum, x, z) => {
    if (!maximum) return false;
    const dx = Math.max(x - this.rollbackX, 0, this.rollbackX - x - 2), dz = Math.max(z - this.rollbackZ, 0, this.rollbackZ - z - 2);
    return dx * dx + dz * dz <= (this.rollbackRadius + maximum) ** 2;
  } };

  private readonly unresolved: EntitySnapshot[] = [];
  private readonly live: (EntitySnapshot | undefined)[] = [];
  private committing = false;
  private bodyConflict = false;
  private bodyConflictId = 0;
  private clearPoint!: Point;
  private clearEntity: EntitySnapshot | undefined;
  private clearId: number | undefined;
  private clearRadius = 0;
  private clearLimit = 0;
  private readonly visitClear = (id: number): boolean => {
    const other = this.committing ? this.live[id] : this.world.entities.get(id);
    if (id === this.clearId || !other || !this.committing && !actor(other) || pairExempt(this.clearEntity, other) || !layers(this.clearPoint, other.transform)) return true;
    const dx = this.clearPoint.x - other.transform.x, dz = this.clearPoint.z - other.transform.z, reach = this.clearRadius + (this.committing ? this.bodyRadii[id] : actorRadius(other)) - this.clearLimit;
    if (this.clearEntity?.companion || other.companion ? !this.companionContact(this.clearPoint, this.clearRadius, this.clearEntity, other, this.clearLimit) : dx * dx + dz * dz >= reach * reach) return true;
    this.bodyConflict = true; this.bodyConflictId = id; return false;
  };
  // The live roster already excludes passengers. Read cached transforms directly,
  // and consult entity attachment fields only when the transaction contains one.
  private readonly visitCommittedClear = (id: number): boolean => {
    const p = this.bodyPoints[id];
    if (id === this.clearId || !p || this.hasPairExemptions && pairExempt(this.clearEntity, this.live[id]!) || !layers(this.clearPoint, p)) return true;
    const dx = this.clearPoint.x - p.x, dz = this.clearPoint.z - p.z, reach = this.clearRadius + this.bodyRadii[id] - this.clearLimit;
    if (this.clearEntity?.companion || this.live[id]?.companion ? !this.companionContact(this.clearPoint, this.clearRadius, this.clearEntity, this.live[id]!, this.clearLimit) : dx * dx + dz * dz >= reach * reach) return true;
    this.bodyConflict = true; this.bodyConflictId = id; return false;
  };
  private companionContact(at: Point, radius: number, e: EntitySnapshot | undefined, other: EntitySnapshot, limit: number): boolean {
    const mine = !!e?.companion, dog = mine ? e! : other, p = mine ? at : other.transform, q = mine ? other.transform : at;
    const dx = q.x - p.x, dz = q.z - p.z, yaw = mine ? at.yaw ?? dog.transform.yaw : dog.transform.yaw, nx = Math.cos(yaw), nz = -Math.sin(yaw);
    const along = Math.max(-.4, Math.min(.4, dx * nx + dz * nz)), x = dx - nx * along, z = dz - nz * along;
    const reach = radius + actorRadius(other), squared = x * x + z * z;
    if (squared >= (reach - limit) ** 2) return false;
    const distance = Math.sqrt(squared), sign = mine ? -1 : 1;
    this.contact.depth = reach - distance;
    this.contact.nx = distance ? sign * x / distance : -nz;
    this.contact.nz = distance ? sign * z / distance : nx;
    return true;
  }
  private readonly occupancyCells: ContactCells = { epoch: 0, radius: id => {
    return this.live[id]?.companion ? this.bodyRadii[id] + .4 : this.live[id] ? this.bodyRadii[id] : 0;
  }, intersects: (maximum, x, z) => {
    if (!maximum) return false;
    const p = this.clearPoint, dx = Math.max(x - p.x, 0, p.x - x - 2), dz = Math.max(z - p.z, 0, p.z - z - 2);
    return dx * dx + dz * dz <= ((this.clearEntity?.companion ? this.clearRadius + .4 : this.clearRadius) + maximum - this.clearLimit) ** 2;
  } };
  private readonly contact: Contact = { depth: 0, nx: 0, nz: 0, inside: false };
  private maxHull = 0;
  private maxActor: number = survivor.radius;
  private startClearance: { x: number; z: number } | undefined;
  private hasSolids(): boolean { return this.barriers.size > 0 || this.hulls.size > 0 || this.world.infected?.infectedNav.hasSolids === true; }
  private readonly changedActors = new Set<number>();
  private readonly changedHulls = new Set<number>();
  private changedTick = -1;
  private navRevision = -1;
  private nav: import('../ai/NavGrid').NavGrid | undefined;
  private infectedNavRevision = -1;
  private infectedNav: import('../ai/NavGrid').NavGrid | undefined;
  constructor(private readonly world: SimWorld) {}
  /** Low vaultable barriers are physical for everyone while AI retains its authored approach routes. */
  setBarrier(id: string, wall: SolidBox | null): void {
    if (wall) {
      // Reserve the contact tolerance outside the drawn face, so grounded feet never enter the wire.
      this.barriers.set(id, { ...wall, halfX: wall.halfX + tolerance + skin, halfZ: wall.halfZ + tolerance + skin });
    }
    else if (!this.barriers.delete(id)) return;
    this.barrierRevision++;
  }

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
    if (this.hullRevision !== this.world.entities.revision) {
      this.hullRevision = this.world.entities.revision; this.hullCandidates.length = 0;
      for (const e of this.world.entities.iterate()) if (e.vehicle || e.traffic || e.convoy || e.kind === 'setpiece') this.hullCandidates.push(e);
    }
    // Retain hidden candidates: a hull may reappear without a membership change.
    // Swept specials can query repeatedly in one tick without rescanning every actor.
    for (const e of this.hullCandidates) this.register(e);
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
    // The corgi's centre is 0.3 m above support, unlike a standing human's 0.7 m.
    // Its feet must clear the supporting floor rather than collide with it.
    const bottom = at.y - (e?.companion ? .25 : .6), top = at.y + (e?.companion ? .3 : .65);
    for (const [id, box] of this.barriers) if (box.y + box.halfY > bottom && box.y - box.halfY < top && Math.abs(at.x - box.x) <= box.halfX + radius && Math.abs(at.z - box.z) <= box.halfZ + radius) visit(box, id);
    const owner = e?.passengerOf ?? e?.attachedTo;
    const activity = e?.civilian?.schedule?.[e.civilian.scheduleStep ?? 0];
    const seatOwner = activity?.seatProp ? this.world.props?.items.find(p => p.id === activity.seatProp)?.entityId : undefined;
    const nav = e?.infected ? this.world.infected?.infectedNav : this.world.infected?.nav;
    nav?.visitSolids(at.x, at.z, radius, (box, id) => {
      // Height rejects most nearby roofs/supports before any ownership lookup.
      if (!(box.y + box.halfY > bottom && box.y - box.halfY < top)) return;
      // Crowd lane edges (navOnly, L6) hold NPC bodies only; the courier and her companion walk the drawn walkways.
      if ((box as { navOnly?: boolean }).navOnly && (e?.id === 1 || e?.companion)) return;
      // Navigation uses an AABB for the route bake; exact contact uses its canonical OBB below.
      const hullOwner = this.blockerOwners.get(id);
      if (hullOwner !== undefined && this.hulls.has(hullOwner)) return;
      if (at === e?.transform && (owner !== undefined && this.blockerOwners.get(id) === owner || seatOwner !== undefined && id === `blocker:${seatOwner}`)) return;
      visit(box, id);
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
        if (worldBox.y + b.halfY > bottom && worldBox.y - b.halfY < (e?.companion ? top : at.y + .6)) visit(worldBox, id);
      }
    }
  }
  private clearStatics(at: Point, radius: number, e: EntitySnapshot | undefined, limit: number): boolean {
    let clear = true;
    const probe = (p: Point) => this.solids(p, radius, e, b => { const c = boxContact(b, p.x, p.z, radius, this.contact); if (c.inside || c.depth > limit) clear = false; });
    probe(at);
    if (e?.companion) {
      const yaw = at.yaw ?? e.transform.yaw, dx = Math.cos(yaw) * .4, dz = -Math.sin(yaw) * .4;
      probe({ ...at, x: at.x + dx, z: at.z + dz }); probe({ ...at, x: at.x - dx, z: at.z - dz });
    }
    return clear;
  }
  /** Project every footprint probe, including the corgi's head/rear, along the contacted face. */
  private projectStatics(at: Point, radius: number, e: EntitySnapshot | undefined): boolean {
    let moved = false;
    const project = (dx: number, dz: number) => this.solids(dx || dz ? { ...at, x: at.x + dx, z: at.z + dz } : at, radius, e, b => {
      const c = boxContact(b, at.x + dx, at.z + dz, radius, this.contact);
      if (c.depth > skin) { at.x += c.nx * c.depth; at.z += c.nz * c.depth; moved = true; }
    });
    project(0, 0);
    if (e?.companion) {
      const yaw = at.yaw ?? e.transform.yaw, dx = Math.cos(yaw) * .4, dz = -Math.sin(yaw) * .4;
      project(dx, dz); project(-dx, -dz);
    }
    return moved;
  }
  /** Radius and height aware occupancy, shared by spawn, checkpoint, relocation and exits. */
  clear(at: Point, radius: number, ignoreId?: number, bodies = true, limit = skin): boolean {
    this.bodyConflict = false;
    if (!Number.isFinite(at.x) || !Number.isFinite(at.y) || !Number.isFinite(at.z) || !Number.isFinite(radius) || radius <= 0) return false;
    const e = ignoreId === undefined ? undefined : this.world.entities.get(ignoreId);
    if (e && this.world.missions?.l4?.clearOfConvoy(at, e, radius) === false) return false;
    if (this.hasSolids() && !this.clearStatics(at, radius, e, e?.companion ? Math.min(limit, skin) : limit)) return false;
    if (!bodies) return true;
    this.query.x = at.x; this.query.z = at.z; this.query.r = (e?.companion ? radius + .4 : radius) + this.maxActor;
    this.clearPoint = at; this.clearEntity = e; this.clearId = ignoreId; this.clearRadius = radius; this.clearLimit = limit;
    // A few large zoo bodies widen the search for every ordinary actor. Use
    // exact conservative cell bounds only where that radius disparity pays off.
    (this.committing ? this.bodyIndex : this.world.spatial).query(this.query, this.nearby, false, this.committing ? this.visitCommittedClear : this.visitClear,
      this.committing && this.maxActor > radius * 2 ? this.occupancyCells : undefined);
    return !this.bodyConflict;
  }
  /** Starts and restored checkpoints reserve 80 cm around the courier, preserving NPC identities. */
  reservePlayerStart(): void {
    const player = this.world.entities.get(1);
    if (!player || player.passengerOf !== undefined || player.hidden) return;
    this.startClearance = { x: player.transform.x, z: player.transform.z };
    for (const e of this.world.entities.iterate()) {
      if (e.id === 1 || !actor(e) || !layers(e.transform, player.transform)) continue;
      if (Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) < .8) this.admit(e, 'checkpoint.spawn-clearance');
    }
  }
  /** Shared static sweep for special movement and connected admission searches. */
  private sweepSolids(p: Point, radius: number, e: EntitySnapshot | undefined, direction: { x: number; z: number }, distance: number): number {
    const q = this.world.combat!.query;
    this.solids(p, radius + distance, e, box => {
      const contact = boxContact(box, p.x, p.z, radius, this.contact);
      // A clear/touching circle may leave or slide along this convex wall.
      // The expanded-box ray otherwise reports an immediate zero-length hit.
      if (!contact.inside && contact.depth <= skin && contact.nx * direction.x + contact.nz * direction.z >= 0) return;
      const c = Math.cos(box.yaw ?? 0), s = Math.sin(box.yaw ?? 0);
      const dx = p.x - box.x, dz = p.z - box.z;
      distance = Math.min(distance, q.wallDistance({ x: 0, z: 0, y: box.y, halfX: box.halfX, halfZ: box.halfZ, halfY: box.halfY },
        { x: dx * c - dz * s, z: dx * s + dz * c, y: p.y },
        { x: direction.x * c - direction.z * s, z: direction.x * s + direction.z * c }, distance, radius));
    });
    return distance;
  }
  /** A charge may push a contacted body; an obstructed push stops the mover. */
  sweep(e: EntitySnapshot, direction: { x: number; z: number }, distance: number, radius = actorRadius(e), push: boolean | 'side' = false, bodies = true, contact?: (other: EntitySnapshot) => void): number {
    this.syncHulls();
    const p = e.transform;
    distance = this.sweepSolids(p, radius, e, direction, distance);
    if (e.companion) {
      const dx = Math.cos(p.yaw) * .4, dz = -Math.sin(p.yaw) * .4;
      distance = this.sweepSolids({ ...p, x: p.x + dx, z: p.z + dz }, radius, e, direction, distance);
      distance = this.sweepSolids({ ...p, x: p.x - dx, z: p.z - dz }, radius, e, direction, distance);
    }
    if (!bodies) return distance;
    const neighbors: number[] = [];
    this.world.spatial.query({ x: p.x, z: p.z, r: distance + (e.companion ? radius + .4 : radius) + this.maxActor + (contact ? tolerance : 0) }, neighbors, false);
    for (const id of neighbors) {
      const other = this.world.entities.get(id);
      if (!other || other === e || !actor(other) || pairExempt(e, other) || !layers(p, other.transform)) continue;
      const t = other.transform, dx = t.x - p.x, dz = t.z - p.z;
      const along = dx * direction.x + dz * direction.z, lateral = dx * direction.z - dz * direction.x;
      const reach = actorRadius(e) + actorRadius(other), side2 = lateral * lateral;
      // Contact damage includes the registry's 2 cm tolerance, before a push can
      // move the contacted body. Each special owns its per-body hit set.
      const closest = Math.max(0, Math.min(distance, along));
      if (contact && (along - closest) ** 2 + side2 <= (reach + tolerance) ** 2) contact(other);
      if (side2 >= reach * reach || along < 0) continue;
      const entry = Math.max(0, along - Math.sqrt(reach * reach - side2));
      if (entry >= distance) continue;
      if (push) {
        const x = p.x + direction.x * distance, z = p.z + direction.z * distance;
        const ox = t.x - x, oz = t.z - z, length = Math.hypot(ox, oz);
        const to = { x: x + (length ? ox / length : direction.x) * (reach + skin), z: z + (length ? oz / length : direction.z) * (reach + skin), y: t.y };
        if (push === 'side') {
          // A locked herd line sheds the body to its contacted side, rather
          // than carrying it ahead of the first zebra for the whole charge.
          const side = lateral < 0 ? -1 : 1, shift = side * (reach + skin) - lateral;
          to.x = t.x + direction.z * shift; to.z = t.z - direction.x * shift;
        }
        if (this.relocate(other, to, 'special.swept-contact', 0, false)) continue;
      }
      distance = Math.max(0, entry - skin);
    }
    return distance;
  }
  /** Bounded nearest-first search. null means retain the request; never accept the blocked anchor. */
  find(at: Point, radius: number, ignoreId?: number, range = 4, navigation = true, playerClearance = 0): Point | null {
    const nav = this.world.infected?.nav, e = ignoreId === undefined ? undefined : this.world.entities.get(ignoreId);
    let connected = false;
    const direction = { x: 0, z: 0 };
    const player = playerClearance ? this.world.entities.get(1) : undefined;
    const fits = (p: Point) => {
      if (playerClearance && player && ignoreId !== 1 && layers(p, player.transform) && Math.hypot(p.x - player.transform.x, p.z - player.transform.z) < playerClearance) return false;
      if (navigation && nav && !nav.contains(p.x, p.z, radius) || !this.clear(p, radius, ignoreId)) return false;
      if (!connected || p === at) return true;
      const dx = p.x - at.x, dz = p.z - at.z, distance = Math.hypot(dx, dz);
      if (!distance) return true;
      direction.x = dx / distance; direction.z = dz / distance;
      return this.sweepSolids(at, radius, e, direction, distance) >= distance - 1e-6;
    };
    if (fits(at)) return { ...at };
    if (range <= 0) return null;
    // Congestion may displace a spawn within its walkable region, but cannot
    // teleport it through a wall. An anchor actually inside a solid still needs
    // nearest-outside admission (for example, an Alpha requested in a tank).
    connected = this.clear(at, radius, ignoreId, false, 0);
    // Use the exact APC projection before quantized search rings, retaining near-contact ram/door distances.
    if (range > 0) {
      const projected = { ...at };
      for (let pass = 0; pass < 8; pass++) {
        const changed = this.projectStatics(projected, radius, e);
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
  private spawnClearance(e: EntitySnapshot, writer: string): number {
    if (e.id === 1 || !writer.includes('spawn')) return 0;
    if (writer === 'checkpoint.spawn-clearance') return .8;
    const p = this.world.entities.get(1), start = this.startClearance;
    return start && p && !p.hidden && Math.hypot(p.transform.x - start.x, p.transform.z - start.z) < .5 ? .8 : 0;
  }
  /** Preserve identity/counts when no safe spot is available; AI cannot move a pending actor. */
  admit(e: EntitySnapshot, writer: string, range = 4, navigation = true): boolean {
    const hidden = e.pendingAdmission && e.hidden === true ? e.pendingAdmission.hidden : e.hidden;
    this.maxActor = Math.max(this.maxActor, actorRadius(e) + (e.companion ? .4 : 0));
    this.committed.delete(e); this.validated.delete(e);
    this.syncHulls(); this.writers.set(e, writer);
    const to = this.find(e.transform, actorRadius(e), e.id, range, navigation, this.spawnClearance(e, writer));
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
  /** Off-region movement has no physical history; re-entry validates its current endpoint. */
  forget(e: EntitySnapshot): void { this.committed.delete(e); this.validated.delete(e); }
  restore(): void {
    this.committed = new WeakMap(); this.validated = new WeakMap();
    for (const e of this.world.entities.iterate()) if (actor(e)) this.writers.set(e, 'checkpoint.restore');
    this.commit();
  }
  private publish(e: EntitySnapshot, ground = false): void {
    if (ground) groundAgent(this.world, e);
    this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    if (this.committing && this.live[e.id]) this.bodyIndex.set(e.id, e.transform.x, e.transform.z);
    if (e.id === 1) {
      const physics = this.world.physics;
      const at = physics.playerBody?.translation();
      if (!at || at.x !== e.transform.x || at.y !== e.transform.y || at.z !== e.transform.z) physics.playerBody?.setTranslation(e.transform, true);
      physics.playerBody?.setNextKinematicTranslation(e.transform);
      const collider = physics.playerCollider?.translation();
      if (collider && (collider.x !== e.transform.x || collider.y !== e.transform.y || collider.z !== e.transform.z)) physics.world?.propagateModifiedBodyPositionsToColliders();
    }
  }
  /** Last phase, after cleanup + .25. Projection is bounded; unresolved motion rolls back to a safe prior pose. */
  commit(): void {
    this.syncHulls(); const nav = this.world.infected?.nav, infectedNav = this.world.infected?.infectedNav;
    const staticChanged = this.barrierRevision !== this.committedBarrierRevision || nav !== this.nav || nav?.revision !== this.navRevision || infectedNav !== this.infectedNav || infectedNav?.revision !== this.infectedNavRevision;
    const full = this.world.tick % 60 === 0 || staticChanged;
    this.committedBarrierRevision = this.barrierRevision;
    this.nav = nav; this.navRevision = nav?.revision ?? -1;
    this.infectedNav = infectedNav; this.infectedNavRevision = infectedNav?.revision ?? -1;
    const previous = this.bodyIds; this.bodyIds = this.previousBodyIds; this.previousBodyIds = previous;
    for (const id of previous) {
      this.live[id] = undefined; this.rejected[id] = this.movedIds[id] = false; this.bodyRejections[id] = 0;
    }
    this.bodyIds.length = 0;
    this.bodies.length = this.moved.length = 0; this.hasPairExemptions = false;
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
        const to = this.find(pending, actorRadius(e), e.id, pending.range ?? 4, pending.navigation ?? true, this.spawnClearance(e, pending.writer));
        if (to) { Object.assign(e.transform, to); this.releasePending(e); this.admitted++; this.publish(e); }
        else { e.hidden = true; this.world.spatial.delete(e.id); continue; }
      }
      if (!actor(e)) continue;
      const radius = actorRadius(e);
      // Shapes and eligibility are stable during this final transaction. Reuse
      // their snapshot in the correction loops; full audits still read actors.
      this.bodyRadii[e.id] = radius; this.bodyPoints[e.id] = e.transform; this.hasPairExemptions ||= e.attachedTo !== undefined; this.committedPoses[e.id] = this.committed.get(e); this.contactProofs[e.id] = this.validated.get(e);
      this.maxActor = Math.max(this.maxActor, e.companion ? radius + .4 : radius); this.bodies.push(e); this.live[e.id] = e;
      this.bodyIds.push(e.id);
      this.bodyIndex.set(e.id, e.transform.x, e.transform.z);
      this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
    for (const id of previous) if (!this.live[id]) {
      this.bodyIndex.delete(id);
      this.committedPoses[id] = this.proposalPoints[id] = undefined; this.contactProofs[id] = undefined; this.bodyRadii[id] = 0; this.bodyPoints[id] = undefined;
    }
    // Scripted writers and revived actors may not have updated the shared index. Changed
    // hulls inspect the complete current actor index before selecting the tick's guard set.
    for (const id of this.changedHulls) {
      const h = this.hulls.get(id); if (!h) continue;
      this.world.spatial.query({ x: h.pose.x, z: h.pose.z, r: this.maxHull + this.maxActor }, this.nearby, false);
      for (const actorId of this.nearby) this.changedActors.add(actorId);
    }
    for (const e of this.bodies) {
      const radius = this.bodyRadii[e.id], old = this.committedPoses[e.id], p = e.transform;
      if (full || this.changedActors.has(e.id) || !old || old.x !== p.x || old.z !== p.z || old.y !== p.y || e.companion && old.yaw !== p.yaw) this.moved.push(e);
      else {
        const proof = this.contactProofs[e.id];
        if (!proof || proof.tick !== this.world.tick - 1 || proof.radius !== radius || proof.exemption !== exemption(e)) this.moved.push(e);
      }
    }
    this.committing = true; this.occupancyCells.epoch++;
    // Accept a mutually clear set of simultaneous proposals atomically. A coherent formation
    // must be able to enter positions its neighbours vacate during this same tick.
    this.unresolved.length = 0;
    let unreservedMoving = 0;
    const reject = (e: EntitySnapshot) => {
      if (this.rejected[e.id]) return;
      this.rejected[e.id] = true; this.unresolved.push(e);
      if (this.movedIds[e.id]) unreservedMoving--;
      let proposed = this.proposed.get(e);
      if (proposed) { const p = e.transform; proposed.x = p.x; proposed.y = p.y; proposed.z = p.z; proposed.yaw = p.yaw; }
      else { proposed = { ...e.transform }; this.proposed.set(e, proposed); }
      this.proposalPoints[e.id] = proposed;
    };
    for (const e of this.moved) {
      const proof = this.contactProofs[e.id], blocker = this.live[proof?.blocker ?? 0], p = e.transform, radius = this.bodyRadii[e.id];
      // A previous contact is only a witness: retest its actual proposed pose,
      // current footprint, layer and attachment mask before rejecting movement.
      // If it has cleared, the normal registry query still checks every solid.
      if (blocker && !pairExempt(e, blocker) && layers(p, blocker.transform) &&
          (p.x - blocker.transform.x) ** 2 + (p.z - blocker.transform.z) ** 2 < (radius + this.bodyRadii[blocker.id] - tolerance) ** 2) {
        this.bodyRejections[e.id] = blocker.id; reject(e);
      } else if (!this.clear(p, radius, e.id, true, tolerance)) {
        if (this.bodyConflict) {
          this.bodyRejections[e.id] = this.bodyConflictId;
          if (proof) proof.blocker = this.bodyConflictId;
        }
        reject(e);
      }
    }
    if (!this.unresolved.length) {
      for (const e of this.moved) if (e.id === 1) this.publish(e);
      this.finish(full); return;
    }
    unreservedMoving = this.moved.length - this.unresolved.length;
    for (const e of this.moved) this.movedIds[e.id] = true;
    this.rollbackCells.epoch++;
    // Reserve rollback positions only for the conflicting component. Propagate a
    // reservation to proposals it intersects; unrelated clear formations keep moving.
    for (let i = 0; i < this.unresolved.length; i++) {
      const e = this.unresolved[i];
      const old = this.committedPoses[e.id];
      if (!old) { this.world.spatial.delete(e.id); this.bodyIndex.delete(e.id); continue; }
      const p = e.transform; p.x = old.x; p.y = old.y; p.z = old.z; p.yaw = old.yaw; this.publish(e);
      const radius = this.bodyRadii[e.id], proof = this.contactProofs[e.id];
      // An unchanged body cannot intersect this same valid pose from last tick.
      // Reuse the hash's cell bounds to visit only unreserved moving proposals.
      const stable = proof?.tick === this.world.tick - 1 && proof.radius === radius && proof.exemption === exemption(e);
      // Every moving proposal is already reserved. This valid previous pose
      // cannot reject an unchanged neighbour or an already rejected proposal.
      if (stable && !unreservedMoving) continue;
      this.rollbackX = old.x; this.rollbackZ = old.z; this.rollbackRadius = e.companion ? radius + .4 : radius;
      this.bodyIndex.query({ x: old.x, z: old.z, r: (e.companion ? radius + .4 : radius) + this.maxActor }, this.nearby, false, undefined, stable ? this.rollbackCells : undefined);
      for (const id of this.nearby) {
        const other = this.live[id];
        if (!other || id === e.id || this.rejected[id] || stable && !this.movedIds[id] || pairExempt(e, other) || !layers(old, other.transform)) continue;
        const dx = old.x - other.transform.x, dz = old.z - other.transform.z;
        if (e.companion || other.companion ? this.companionContact(old, radius, e, other, tolerance) : dx * dx + dz * dz < (radius + this.bodyRadii[other.id] - tolerance) ** 2) reject(other);
      }
    }
    for (const e of this.moved) if (!this.rejected[e.id] && e.id === 1) this.publish(e);
    for (const admission of [false, true]) for (const e of this.unresolved) {
      const old = this.committedPoses[e.id]; if (!old !== admission) continue;
      const radius = this.bodyRadii[e.id], p = e.transform, proposed = this.proposalPoints[e.id]!;
      const proof = this.contactProofs[e.id];
      const mayHold = !!(e.infected && !e.infected.specialAttack && proof && (this.world.tick + e.id) % 10 !== 0 && old && !this.failures && !staticChanged && !this.changedActors.has(e.id) && proof.tick === this.world.tick - 1 && proof.radius === radius && proof.exemption === exemption(e));
      if (mayHold && proof!.crowded && proof!.crowdUntil > this.world.tick) {
        const blocker = this.live[this.bodyRejections[e.id] ?? 0];
        // Reuse the actual failed contact only while it still blocks this proposal
        // after rollback. A neighbour that vacated it must still permit movement.
        if (blocker && layers(proposed, blocker.transform) &&
            (proposed.x - blocker.transform.x) ** 2 + (proposed.z - blocker.transform.z) ** 2 < (radius + this.bodyRadii[blocker.id] - tolerance) ** 2) {
          proof!.blocked++; continue; // The previous valid pose is already reserved and published.
        }
      }
      p.x = proposed.x; p.y = proposed.y; p.z = proposed.z; p.yaw = proposed.yaw;
      const blocker = this.live[this.bodyRejections[e.id] ?? 0];
      const blocked = blocker && !pairExempt(e, blocker) && layers(p, blocker.transform) &&
        (p.x - blocker.transform.x) ** 2 + (p.z - blocker.transform.z) ** 2 < (radius + this.bodyRadii[blocker.id] - tolerance) ** 2;
      let valid = false;
      // A still-overlapping witness proves this proposal fails its body query.
      // Check solids first, preserving the original static/body classification;
      // projection and the retry cadence below remain exactly the same.
      if (blocked && this.clear(p, radius, e.id, false, tolerance)) { this.bodyConflict = true; this.bodyConflictId = blocker.id; }
      else valid = this.clear(p, radius, e.id, true, tolerance);
      if (valid && proof) proof.blocked = 0;
      if (!valid) {
        let crowded = false;
        if (this.bodyConflict && e.infected && proof) {
          if (proof.crowdUntil <= this.world.tick) {
            // The contact query has a one-body reach: twelve nonpenetrating
            // centres cannot fit there. Count the local crowd in a 2 m ring.
            this.bodyIndex.query({ x: p.x, z: p.z, r: Math.max(2, radius + this.maxActor) }, this.nearby, false);
            // Small classic bodies can already form a blocked cluster at four
            // neighbours. L1 pursuit and larger footprints retain their cadence.
            const cluster = !e.infected?.l1 && radius <= .35 ? 4 : 8;
            proof.crowded = this.nearby.length >= cluster; proof.crowdUntil = this.world.tick + 30;
          }
          crowded = proof.crowded;
        }
        if (crowded && mayHold) {
          // Every earlier transaction respected this reserved pose. With the same solid geometry,
          // footprint and attachment mask, rejecting motion needs no second contact search.
          // Stagger the one-in-ten projection retries by actor ID, avoiding a
          // synchronized repair frame that dominates the E18 p95 window.
          proof!.blocked++; p.x = old!.x; p.y = old!.y; p.z = old!.z; p.yaw = old!.yaw; this.publish(e); continue;
        }
        if (proof) proof.blocked = 0;
        for (let pass = 0; pass < 4; pass++) {
          let moved = false;
          if (this.hasSolids()) moved = this.projectStatics(p, radius, e);
          this.bodyIndex.query({ x: p.x, z: p.z, r: (e.companion ? radius + .4 : radius) + this.maxActor }, this.nearby, false);
          for (const id of this.nearby) {
            const other = this.live[id];
            if (id === e.id || !other || pairExempt(e, other) || !layers(p, other.transform)) continue;
            const dx = p.x - other.transform.x, dz = p.z - other.transform.z, squared = dx * dx + dz * dz, reach = radius + this.bodyRadii[other.id];
            let depth: number, nx: number, nz: number;
            // Preserve the infected crowd's bounded correction; full clearance below still checks the capsule.
            // The dog and friendly walkers use the capsule normal to keep queues moving.
            if (e.companion || other.companion && !e.infected) {
              if (!this.companionContact(p, radius, e, other, tolerance)) continue;
              ({ depth, nx, nz } = this.contact);
            } else {
              if (squared >= (reach - tolerance) ** 2) continue;
              const d = Math.sqrt(squared); depth = reach - d;
              nx = d ? dx / d : Math.cos(e.id * 2.399963); nz = d ? dz / d : Math.sin(e.id * 2.399963);
            }
            const to = this.correction; to.x = p.x + nx * (depth + skin); to.z = p.z + nz * (depth + skin); to.y = p.y;
            if (!this.clear(to, radius, e.id, false)) continue;
            p.x = to.x; p.z = to.z; moved = true;
          }
          if (!moved) break;
          // A clear projection needs no further repair pass or duplicate body
          // search. Grounding and the courier's 3D sweep can invalidate it below.
          valid = this.clear(p, radius, e.id, true, tolerance);
          if (valid) break;
        }
        // The courier's correction crosses the same 3D sweep as ordinary input.
        // A clear endpoint alone can otherwise cut through a stair riser or deck.
        if (e.id === 1) {
          valid = false;
          const physics = this.world.physics, body = physics.playerBody, collider = physics.playerCollider, controller = physics.characterController;
          if (body && collider && controller) {
            physics.world!.propagateModifiedBodyPositionsToColliders();
            const from = body.translation(), displacement = { x: p.x - from.x, y: p.y - from.y, z: p.z - from.z };
            controller.computeColliderMovement(collider, displacement, undefined, collider.collisionGroups());
            controller.computedMovement(displacement);
            p.x = from.x + displacement.x; p.y = from.y + displacement.y; p.z = from.z + displacement.z;
          }
        }
        const y = p.y; groundAgent(this.world, e);
        if (!valid || p.y !== y) valid = this.clear(p, radius, e.id, true, tolerance);
        if (!valid) {
          const to = old && this.clear(old, radius, e.id, true, tolerance) ? old : this.find(proposed, radius, e.id, 4, false);
          if (to) { Object.assign(p, to); valid = true; }
          else if (!old) {
            e.pendingAdmission = { ...proposed, writer: this.writers.get(e) ?? 'tick.admission', hidden: e.hidden, range: 4, navigation: false };
            if (e.id === 1) { e.pendingAdmission.colliderEnabled = this.world.physics.playerCollider?.isEnabled(); this.world.physics.playerCollider?.setEnabled(false); }
            e.hidden = true; this.world.spatial.delete(e.id); this.bodyIndex.delete(e.id); this.live[e.id] = undefined; this.bodyPoints[e.id] = undefined; this.deferred++; continue;
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
    // The live roster already owns eligibility. Only a deferred admission can
    // leave it during this transaction; no damage or cleanup runs inside commit.
    if (full) for (const e of this.bodies) if (this.live[e.id] === e) this.auditActor(e);
    for (const e of this.bodies) if (this.live[e.id] === e) {
      const old = this.committedPoses[e.id];
      if (old) { const p = e.transform; old.x = p.x; old.y = p.y; old.z = p.z; old.yaw = p.yaw; } else this.committed.set(e, { ...e.transform });
      const proof = this.contactProofs[e.id];
      if (proof) { proof.tick = this.world.tick; proof.radius = this.bodyRadii[e.id]; proof.exemption = exemption(e); }
      else this.validated.set(e, { tick: this.world.tick, radius: this.bodyRadii[e.id], exemption: exemption(e), blocked: 0, blocker: 0, crowded: false, crowdUntil: 0 });
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
    const probe = (at: Point) => this.solids(at, radius, e, (b, id) => {
      const c = boxContact(b, at.x, at.z, radius, this.contact);
      if (c.inside || c.depth > tolerance + 1e-6) this.record(e, id, c.depth, c.inside);
    });
    probe(p);
    if (e.companion) {
      const dx = Math.cos(p.yaw) * .4, dz = -Math.sin(p.yaw) * .4;
      probe({ ...p, x: p.x + dx, z: p.z + dz }); probe({ ...p, x: p.x - dx, z: p.z - dz });
    }
    this.world.spatial.query({ x: p.x, z: p.z, r: (e.companion ? radius + .4 : radius) + this.maxActor }, this.nearby, false);
    for (const id of this.nearby) {
      const other = this.world.entities.get(id);
      if (id === e.id || !other || !actor(other) || pairExempt(e, other) || !layers(p, other.transform)) continue;
      if (e.companion || other.companion) {
        if (this.companionContact(p, radius, e, other, tolerance + 1e-6)) this.record(e, id, this.contact.depth, false);
      } else {
        const depth = radius + actorRadius(other) - Math.hypot(p.x - other.transform.x, p.z - other.transform.z);
        if (depth > tolerance + 1e-6) this.record(e, id, depth, false);
      }
    }
  }
  snapshot() {
    const pending = this.world.entities.values().filter(e => e.pendingAdmission);
    return { failures: this.failures, pending: pending.length, admitted: this.admitted, deferred: this.deferred,
      requests: pending.slice(0, 64).map(e => ({ id: e.id, archetype: e.archetype, ...e.pendingAdmission })), offenders: this.offenders.map(o => ({ ...o })) };
  }
  reset(): void { this.startClearance = undefined; this.barriers.clear(); this.barrierRevision = 0; this.committedBarrierRevision = -1; this.previousBodyIds.length = this.bodyIds.length = this.bodies.length = this.moved.length = this.nearby.length = this.hullNeighbors.length = 0; this.changedActors.clear(); this.changedHulls.clear(); this.changedTick = -1; this.rejected.length = this.bodyRejections.length = this.movedIds.length = 0; this.unresolved.length = 0; this.live.length = this.committedPoses.length = this.proposalPoints.length = this.contactProofs.length = this.bodyRadii.length = this.bodyPoints.length = 0; this.hasPairExemptions = false; this.committing = false; this.blockerOwners.clear(); this.hulls.clear(); this.hullRevision = -1; this.hullCandidates.length = 0; this.hullIndex.reset(); this.bodyIndex.reset(); this.committed = new WeakMap(); this.proposed = new WeakMap(); this.validated = new WeakMap(); this.writers = new WeakMap(); this.offenders.length = 0; this.failures = this.admitted = this.deferred = 0; this.maxHull = 0; this.maxActor = survivor.radius; this.navRevision = this.infectedNavRevision = -1; this.nav = this.infectedNav = undefined; }
}
