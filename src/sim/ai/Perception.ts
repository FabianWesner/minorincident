import { l1v2 } from '../../data/l1v2';
import type { HumanTarget, HumanTargetQuery, LosBlocker, LosBlockerRegistry, Vec2 } from '../outbreak/types';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';

/** Segment a-b against an axis-aligned box (slab test on t in [0, 1]). */
function segmentHitsAabb(a: Vec2, b: Vec2, min: Vec2, max: Vec2): boolean {
  let near = 0, far = 1;
  for (const axis of ['x', 'z'] as const) {
    const d = b[axis] - a[axis];
    if (Math.abs(d) < 1e-12) { if (a[axis] < min[axis] || a[axis] > max[axis]) return false; continue; }
    const t0 = (min[axis] - a[axis]) / d, t1 = (max[axis] - a[axis]) / d;
    near = Math.max(near, Math.min(t0, t1)); far = Math.min(far, Math.max(t0, t1));
    if (near > far) return false;
  }
  return true;
}
function cross(ax: number, az: number, bx: number, bz: number): number { return ax * bz - az * bx; }
function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const rx = b.x - a.x, rz = b.z - a.z, sx = d.x - c.x, sz = d.z - c.z, denominator = cross(rx, rz, sx, sz);
  if (Math.abs(denominator) < 1e-12) return false;
  const t = cross(c.x - a.x, c.z - a.z, sx, sz) / denominator, u = cross(c.x - a.x, c.z - a.z, rx, rz) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
function insidePolygon(p: Vec2, points: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
function segmentHitsPolygon(a: Vec2, b: Vec2, points: readonly Vec2[]): boolean {
  if (points.length === 2) return segmentsCross(a, b, points[0], points[1]);
  if (insidePolygon(a, points) || insidePolygon(b, points)) return true;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) if (segmentsCross(a, b, points[j], points[i])) return true;
  return false;
}

/** Infected line-of-sight blockers registered by their owners (gates, car-wash curtain, extra hedges). */
export class LosRegistry implements LosBlockerRegistry {
  private readonly blockers = new Map<string, LosBlocker>();
  register(blocker: LosBlocker): void { this.blockers.set(blocker.id, blocker); }
  setActive(id: string, active: boolean): void { const blocker = this.blockers.get(id); if (blocker) blocker.active = active; }
  unregister(id: string): void { this.blockers.delete(id); }
  get(id: string): LosBlocker | undefined { return this.blockers.get(id); }
  clear(a: Vec2, b: Vec2): boolean {
    for (const blocker of this.blockers.values()) {
      if (!blocker.active) continue;
      const shape = blocker.shape;
      if (shape.kind === 'aabb' ? segmentHitsAabb(a, b, shape.min, shape.max) : segmentHitsPolygon(a, b, shape.points)) return false;
    }
    return true;
  }
}

const huntable = new Set(['calm', 'alarmed', 'flee', 'hide']);
/**
 * Default human query over the sim world: the living survivor (id 1) and adult, mobile civilians. Lane D may replace it
 * through `Perception.humans` with its own outbreak-aware query. The corgi, pets, children and turning civilians are
 * never humans. Returned arrays and objects are reused.
 */
export class WorldHumans implements HumanTargetQuery {
  /** Civilians already bitten (lane D turns them); they leave the target set immediately. */
  readonly bitten = new Set<number>();
  private readonly cache = new Map<number, HumanTarget>();
  private readonly list: HumanTarget[] = [];
  private readonly ids: number[] = [];
  private readonly area = { x: 0, z: 0, r: 0 };
  constructor(private readonly world: SimWorld) {}
  private human(e: EntitySnapshot | undefined): HumanTarget | undefined {
    if (!e || e.health.current <= 0 || e.hidden) return undefined;
    if (e.id !== 1 && !(e.civilian?.adult && !e.civilian.pet && huntable.has(e.civilian.state) && !this.bitten.has(e.id))) return undefined;
    let target = this.cache.get(e.id);
    if (!target) { target = { id: e.id, kind: e.id === 1 ? 'player' : 'civilian', position: { x: 0, z: 0 }, facing: 0 }; this.cache.set(e.id, target); }
    target.position.x = e.transform.x; target.position.z = e.transform.z; target.facing = e.transform.yaw;
    return target;
  }
  all(): readonly HumanTarget[] {
    this.list.length = 0;
    for (const e of this.world.entities.iterate()) { const h = this.human(e); if (h) this.list.push(h); }
    return this.list;
  }
  get(id: number): HumanTarget | undefined { return this.human(this.world.entities.get(id)); }
  within(center: Vec2, radius: number): readonly HumanTarget[] {
    this.list.length = 0; this.area.x = center.x; this.area.z = center.z; this.area.r = radius;
    for (const id of this.world.spatial.query(this.area, this.ids)) { const h = this.human(this.world.entities.get(id)); if (h) this.list.push(h); }
    return this.list;
  }
}

/**
 * L1 infected vision (specs/epic-19 section 5.2): a forward 90 degree cone, 16 m, blocked by the scene's full-height
 * cover walls and by registered dynamic blockers. There is no hearing of the player. A chased target that slips just
 * outside the cone stays tracked inside `peripheralM` while line of sight is clear (it never starts a detection).
 */
export class Perception {
  humans: HumanTargetQuery;
  readonly los = new LosRegistry();
  readonly rangeM = l1v2.infected.visionRangeM;
  readonly peripheralM = 3;
  private readonly cosHalf = Math.cos(l1v2.infected.visionConeDeg / 2 * Math.PI / 180);
  constructor(private readonly world: SimWorld) { this.humans = new WorldHumans(world); }
  /** Clear line of sight between two ground points (static cover walls + active dynamic blockers). */
  lineOfSight(from: Vec2, to: Vec2): boolean {
    return (this.world.combat?.query.visible(from, to) ?? true) && this.los.clear(from, to);
  }
  inCone(e: EntitySnapshot, target: Vec2): boolean {
    const dx = target.x - e.transform.x, dz = target.z - e.transform.z, distance = Math.hypot(dx, dz);
    if (distance > this.rangeM) return false;
    return distance === 0 || (dx * Math.cos(e.transform.yaw) - dz * Math.sin(e.transform.yaw)) / distance >= this.cosHalf - 1e-9;
  }
  /** Detection: inside the cone and range with clear line of sight. */
  sees(e: EntitySnapshot, target: Vec2): boolean { return this.inCone(e, target) && this.lineOfSight(e.transform, target); }
  /** Keeps an already chased target: the cone, or very close with line of sight. */
  tracks(e: EntitySnapshot, target: Vec2): boolean {
    const near = Math.hypot(target.x - e.transform.x, target.z - e.transform.z) <= this.peripheralM;
    return (near || this.inCone(e, target)) && this.lineOfSight(e.transform, target);
  }
  /**
   * Closest visible human; the current target is kept unless another visible human is at least the switch hysteresis
   * (1.5 m) closer. Returns undefined when nobody is visible.
   */
  closest(e: EntitySnapshot, currentId: number): HumanTarget | undefined {
    let best: HumanTarget | undefined, bestDistance = Infinity, current: HumanTarget | undefined, currentDistance = Infinity;
    for (const h of this.humans.within(e.transform, this.rangeM)) {
      const isCurrent = h.id === currentId;
      if (!(isCurrent ? this.tracks(e, h.position) : this.sees(e, h.position))) continue;
      const distance = Math.hypot(h.position.x - e.transform.x, h.position.z - e.transform.z);
      if (isCurrent) { current = h; currentDistance = distance; }
      if (distance < bestDistance) { best = h; bestDistance = distance; }
    }
    if (current && best !== current && currentDistance - bestDistance < l1v2.infected.switchHysteresisM) return current;
    return best;
  }
}
