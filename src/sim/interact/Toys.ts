import { l1v2 } from '../../data/l1v2';
import { inside } from '../../levels/districts/validate';
import type { LosBlocker, LosBlockerRegistry, LosShape, Vec2 } from '../outbreak/types';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';

/** Serialized toy component (dumpster, car alarm, car wash). Gates are plain `interactable` devices. */
export interface ToyState {
  kind: 'dumpster' | 'car-alarm' | 'carwash';
  /** Car alarms stay dormant (no prompt) until the outbreak starts (`l1.blast`) or `armAlarms()`. */
  locked?: boolean;
  /** Alarm or wash running until this tick. */
  until: number;
  /** Next tick the toy can be triggered again. */
  rearmAt: number;
  /** Dumpster: rail start/end and push progress 0..1. */
  from: Vec2; to: Vec2; progress: number; pushing: boolean;
}
const cross = (a: Vec2, b: Vec2, c: Vec2) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
const segments = (a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean => cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0;
const insidePolygon = (p: Vec2, pts: readonly Vec2[]) => inside([p.x, p.z], pts.map(q => [q.x, q.z] as [number, number]));
/** Segment versus shape test shared by the LOS registry. */
function blocked(shape: LosShape, a: Vec2, b: Vec2): boolean {
  if (shape.kind === 'aabb') {
    const { min, max } = shape; let t0 = 0, t1 = 1;
    for (const [lo, hi, p, d] of [[min.x, max.x, a.x, b.x - a.x], [min.z, max.z, a.z, b.z - a.z]] as const) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
      let s = (lo - p) / d, e = (hi - p) / d; if (s > e) [s, e] = [e, s];
      t0 = Math.max(t0, s); t1 = Math.min(t1, e); if (t0 > t1) return false;
    }
    return true;
  }
  const pts = shape.points;
  if (insidePolygon(a, pts) || insidePolygon(b, pts)) return true;
  for (let i = 0; i < pts.length; i++) if (segments(a, b, pts[i], pts[(i + 1) % pts.length])) return true;
  return false;
}
/** Dynamic and static line-of-sight blockers (lane C reads `clear`; gates and the car-wash curtain toggle theirs). */
export class LosRegistry implements LosBlockerRegistry {
  private readonly items = new Map<string, LosBlocker>();
  register(blocker: LosBlocker): void { this.items.set(blocker.id, blocker); }
  setActive(id: string, active: boolean): void { const b = this.items.get(id); if (b) b.active = active; }
  unregister(id: string): void { this.items.delete(id); }
  get(id: string): LosBlocker | undefined { return this.items.get(id); }
  clear(a: Vec2, b: Vec2): boolean { for (const item of this.items.values()) if (item.active && blocked(item.shape, a, b)) return false; return true; }
}
const ALARM_RING_M = 3.2, ALARM_KICK_M = 3.6, GATE_HALF = .9, GATE_THICK = .12, DUMPSTER_LONG = 1.1, DUMPSTER_SHORT = .6, PUSH_TICKS = 90;
const aabb = (x: number, z: number, hx: number, hz: number): LosShape => ({ kind: 'aabb', min: { x: x - hx, z: z - hz }, max: { x: x + hx, z: z + hz } });
/**
 * L1 v2 interactive toys (spec 5.11), placed from the D-GROVE anchors. Each toy is an `Interactables` device (so the existing
 * prompt, instant `E` / stand-to-interact flow and the removable collider/nav occupancy are reused) plus derived state.
 */
export class Toys {
  readonly los = new LosRegistry();
  readonly gateIds: number[] = [];
  readonly dumpsterIds: number[] = [];
  readonly alarmIds: number[] = [];
  carwashId = -1;
  /** Car-wash bay polygon (world metres); empty when the level has none. */
  bay: Vec2[] = [];
  private readonly walls = new Map<number, { x: number; z: number; hx: number; hz: number }>();
  constructor(private readonly world: SimWorld) {
    world.events.on('interact.completed', e => { if (e.type === 'interact.completed') this.completed(e.id); });
    world.events.on('l1.blast', () => this.armAlarms());
    // Kicking or attacking a parked alarm car (player attack, car within reach and in front) sets it off like interacting.
    world.events.on('combat.attack', e => {
      if (e.type !== 'combat.attack' || e.sourceId !== 1) return;
      for (const id of this.alarmIds) {
        const car = world.entities.get(id); if (!car?.interactable?.enabled) continue;
        const dx = car.transform.x - e.position.x, dz = car.transform.z - e.position.z, d = Math.hypot(dx, dz);
        if (d <= ALARM_KICK_M && (d < .5 || (dx * e.direction.x + dz * e.direction.z) / d > 0)) this.completed(id);
      }
    });
  }
  /** Reads the anchors of every loaded district; a district without them (all campaign levels) gets no toys. */
  install(): void {
    const w = this.world, districts = w.districts; if (!districts) return;
    for (const d of districts.districts) {
      const at = (name: string) => { const a = d.layout.anchors[name]; return a ? { x: a.position[0] + d.origin[0], z: a.position[2] + d.origin[1], yaw: a.yaw } : null; };
      const bike = at('bike-start'), start = at('player-start');
      if (bike) {
        // Present at the start (PO QA #5): the bike stands on the rack side of the courier's spawn, within 3.3 m, never hidden at the screen edge.
        const dx = bike.x - (start?.x ?? bike.x), dz = bike.z - (start?.z ?? bike.z), d = Math.hypot(dx, dz);
        const at0 = start && d > 3.3 ? { x: start.x + dx / d * 3.3, z: start.z + dz / d * 3.3 } : bike;
        // Stand on the walkable apron in front of the rack, not inside its bars (no route from an unwalkable start cell).
        const apron = w.vehicles?.bicycle.clearSpot(at0.x, at0.z, -bike.yaw, [0, .6, 1.2, 1.8, 2.4, 3]) ?? at0;
        w.vehicles?.bicycle.spawn(apron, -bike.yaw);
      }
      for (const [id, poly] of Object.entries(d.layout.zones ?? {})) {
        const pts = poly.map(p => ({ x: p[0] + d.origin[0], z: p[1] + d.origin[1] }));
        if (id.endsWith('nobike-zone')) w.vehicles?.bicycle.addNoBikeZone({ id, polygon: pts });
        if (id === 'carwash-bay') this.bay = pts;
      }
      const depot = at('parcel-door'); if (depot && w.vehicles) {
        const spot = w.vehicles.bicycle.clearSpot(depot.x, depot.z + 1, Math.PI / 2);
        w.vehicles.bicycle.parkPoints.push({ x: depot.x, z: depot.z, radius: 5, ...(spot ? { spot } : {}) });
      }
      for (let i = 1; i <= l1v2.toys.yardGates; i++) { const a = at(`gate-${i}`); if (a) this.gate(`gate-${i}`, a); }
      for (let i = 1; i <= l1v2.toys.dumpsters; i++) { const a = at(`dumpster-${i}`), end = at(`dumpster-${i}-end`); if (a && end) this.dumpster(a, end); }
      for (let i = 1; i <= l1v2.toys.carAlarm.cars; i++) { const a = at(`alarm-car-${i}`); if (a) this.alarm(a); }
      const wash = at('carwash-start'); if (wash && this.bay.length) this.carwash(wash);
    }
  }
  private device(kind: 'gate' | 'lever' | 'button', pos: Vec2, label: string, opts: { halfX?: number; halfZ?: number; radius: number }): EntitySnapshot {
    const id = this.world.interactables!.spawn(kind, pos, { label, radius: opts.radius, holdTime: .4, instant: true, interruptOnDamage: false, halfX: opts.halfX, halfZ: opts.halfZ });
    return this.world.entities.get(id)!;
  }
  /** Yard gate: starts open; closing blocks movement (collider + nav) and sight (LOS blocker). */
  private gate(id: string, a: Vec2 & { yaw: number }): void {
    const along = Math.abs(Math.sin(a.yaw)) > .7, hx = along ? GATE_THICK : GATE_HALF, hz = along ? GATE_HALF : GATE_THICK;
    const e = this.device('gate', a, 'Gate', { halfX: hx, halfZ: hz, radius: 1.8 });
    (this.world.interactables as unknown as { complete(id: number): void })['complete'](e.id); // opens it, unblocking the collider
    Object.assign(e.interactable!, { completed: false, progress: 0, cycle: 0 });
    e.transform.yaw = along ? Math.PI / 2 : 0; this.gateIds.push(e.id); this.walls.set(e.id, { x: a.x, z: a.z, hx, hz });
    this.los.register({ id, shape: aabb(a.x, a.z, hx, hz), active: false, source: 'gate' });
  }
  /** Dumpster: one interaction slides it along its rail into the passage. */
  private dumpster(from: Vec2, to: Vec2): void {
    const e = this.device('lever', from, 'Push dumpster', { radius: 2.2 });
    const rail = Math.abs(to.z - from.z) > Math.abs(to.x - from.x), hx = rail ? DUMPSTER_LONG : DUMPSTER_SHORT, hz = rail ? DUMPSTER_SHORT : DUMPSTER_LONG;
    this.world.interactables!.unblock(e.id); // devices of kind lever are not doors; make sure no stray collider exists
    e.toy = { kind: 'dumpster', until: 0, rearmAt: 0, from: { x: from.x, z: from.z }, to: { x: to.x, z: to.z }, progress: 0, pushing: false };
    this.walls.set(e.id, { x: from.x, z: from.z, hx, hz }); this.dumpsterIds.push(e.id); this.placeDumpster(e);
  }
  private alarm(a: Vec2): void {
    const e = this.device('button', a, 'Car alarm', { radius: ALARM_RING_M });
    e.interactable!.enabled = false;
    e.toy = { kind: 'car-alarm', locked: true, until: 0, rearmAt: 0, from: a, to: a, progress: 0, pushing: false }; this.alarmIds.push(e.id);
  }
  private carwash(a: Vec2): void {
    const e = this.device('button', a, 'Start car wash', { radius: 2.4 });
    e.toy = { kind: 'carwash', until: 0, rearmAt: 0, from: a, to: a, progress: 0, pushing: false }; this.carwashId = e.id;
    this.los.register({ id: 'carwash-curtain', shape: { kind: 'polygon', points: this.bay }, active: false, source: 'carwash-curtain' });
  }
  /** Moves the dumpster collider to its current rail position (solid only when at rest). */
  private placeDumpster(e: EntitySnapshot): void {
    const t = e.toy!, w = this.walls.get(e.id)!, inter = this.world.interactables!;
    const k = t.progress, x = t.from.x + (t.to.x - t.from.x) * k, z = t.from.z + (t.to.z - t.from.z) * k;
    Object.assign(e.transform, { x, z }); this.world.spatial.set(e.id, x, z);
    inter.unblock(e.id);
    if (!t.pushing) inter.block(e.id, { x, z, y: .7, halfX: w.hx, halfY: .7, halfZ: w.hz, entityId: e.id });
  }
  private completed(id: number): void {
    const e = this.world.entities.get(id), t = e?.toy; if (!e || !t) return;
    const tick = this.world.tick, c = e.interactable!;
    if (t.kind === 'dumpster') { t.pushing = true; this.placeDumpster(e); }
    else if (t.kind === 'car-alarm') {
      t.until = tick + l1v2.toys.carAlarm.durationS * 60; t.rearmAt = tick + l1v2.toys.carAlarm.rearmS * 60;
      this.world.events.emit({ type: 'outbreak.distraction', tick, id, kind: 'car-alarm', position: { x: e.transform.x, z: e.transform.z }, radius: l1v2.infected.attracted.radiusM, until: t.until });
    } else { t.until = tick + l1v2.toys.carWash.durationS * 60; t.rearmAt = t.until + 300; }
    c.completed = false; c.progress = 0; c.enabled = false;
  }
  /** The outbreak has started: parked cars can now be set off. */
  armAlarms(): void { for (const id of this.alarmIds) { const e = this.world.entities.get(id); if (e?.toy?.locked) { e.toy.locked = false; e.interactable!.enabled = true; } } }
  /** Speed multiplier for anything standing at (x, z); 0.5 inside the running car wash. Consumed by the infected movement. */
  speedFactorAt(x: number, z: number): number {
    const wash = this.world.entities.get(this.carwashId)?.toy;
    return wash && this.world.tick < wash.until && insidePolygon({ x, z }, this.bay) ? l1v2.toys.carWash.infectedSpeedFactor : 1;
  }
  /** Active alarm test for views and tests. */
  alarmActive(id: number): boolean { const t = this.world.entities.get(id)?.toy; return !!t && this.world.tick < t.until; }
  update(): void {
    const w = this.world, tick = w.tick;
    this.gateIds.forEach((id, i) => { const e = w.entities.get(id); if (e) this.los.setActive(`gate-${i + 1}`, !e.interactable!.open); });
    const player = w.entities.get(1)!;
    for (const id of this.dumpsterIds) {
      const e = w.entities.get(id); const t = e?.toy; if (!e || !t) continue;
      if (t.pushing) {
        const end = t.to, near = Math.hypot(player.transform.x - end.x, player.transform.z - end.z) < 1.5;
        t.progress = Math.min(1, t.progress + 1 / PUSH_TICKS);
        // Never drop the collider onto the player's capsule: wait at the very end until the spot is clear.
        if (t.progress >= 1 && near) t.progress = 1 - 1e-6;
        if (t.progress >= 1) { t.pushing = false; e.interactable!.label = 'Dumpster pushed'; this.placeDumpster(e); }
        else { const k = t.progress; Object.assign(e.transform, { x: t.from.x + (t.to.x - t.from.x) * k, z: t.from.z + (t.to.z - t.from.z) * k }); }
      }
    }
    for (const id of [...this.alarmIds, this.carwashId]) {
      const e = w.entities.get(id), t = e?.toy; if (!e || !t) continue;
      if (!t.locked && !e.interactable!.enabled && tick >= t.rearmAt) { e.interactable!.enabled = true; e.interactable!.completed = false; e.interactable!.progress = 0; }
    }
    const wash = w.entities.get(this.carwashId)?.toy;
    this.los.setActive('carwash-curtain', !!wash && tick < wash.until);
  }
}
