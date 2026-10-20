import { l1v2 } from '../../data/l1v2';
import type { HumanTarget, HumanTargetQuery, LosBlocker, LosBlockerRegistry, Vec2 } from '../outbreak/types';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { isCorgi } from '../npc/storyProtection';

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
 * Default target query: the living survivor (id 1), adult mobile civilians and healthy zoo animals. Lane D may replace it
 * through `Perception.humans` with its own outbreak-aware query. The corgi, domestic pets, children and turning victims stay excluded. Returned arrays and objects are reused.
 */
export class WorldHumans implements HumanTargetQuery {
  /** Civilians already bitten (lane D turns them); they leave the target set immediately. */
  readonly bitten = new Set<number>();
  private readonly cache = new Map<number, HumanTarget>();
  private readonly list: HumanTarget[] = [];
  private readonly candidates: number[] = [];
  private candidateRevision = -1;
  constructor(private readonly world: SimWorld) {}
  private refreshCandidates(): void {
    if (this.candidateRevision === this.world.entities.revision) return;
    this.candidateRevision = this.world.entities.revision;
    this.candidates.length = 0;
    // Include NPC/escort records before their civilian component is attached.
    // Liveness, adult state and positions are always read live by human().
    for (const e of this.world.entities.iterate()) if (e.id === 1 || e.civilian || e.kind === 'npc' || e.kind === 'escort') this.candidates.push(e.id);
  }
  private human(e: EntitySnapshot | undefined): HumanTarget | undefined {
    if (!e || isCorgi(e) || e.health.current <= 0 || e.hidden || this.world.missions?.state.l3?.waitingIds?.includes(e.id) || e.id === 1 && this.world.inspectionGhost) return undefined;
    if (e.id !== 1 && !(e.civilian?.adult && (!e.civilian.pet || !!e.civilian.zooAnimal) && !e.infection && huntable.has(e.civilian.state) && !this.bitten.has(e.id))) return undefined;
    let target = this.cache.get(e.id);
    if (!target) { target = { id: e.id, kind: e.id === 1 ? 'player' : e.civilian?.zooAnimal ? 'animal' : 'civilian', position: { x: 0, z: 0, y: 0 } as Vec2, facing: 0 }; this.cache.set(e.id, target); }
    // The height travels with the position: sight to a courier on the elevated L3 on-ramp is the same height-aware line as
    // shots and cover (2D sight let infected under the bridge deck see her; omniscience audit T-E21-06b).
    target.position.x = e.transform.x; target.position.z = e.transform.z; (target.position as Vec2 & { y: number }).y = e.transform.y; target.facing = e.transform.yaw;
    return target;
  }
  all(): readonly HumanTarget[] {
    this.refreshCandidates(); this.list.length = 0;
    for (const id of this.candidates) { const h = this.human(this.world.entities.get(id)); if (h) this.list.push(h); }
    return this.list;
  }
  get(id: number): HumanTarget | undefined { return this.human(this.world.entities.get(id)); }
  within(center: Vec2, radius: number): readonly HumanTarget[] {
    if (!Number.isFinite(center.x) || !Number.isFinite(center.z) || !Number.isFinite(radius) || radius < 0) throw new RangeError('Query position and radius must be finite, radius nonnegative');
    this.refreshCandidates(); this.list.length = 0;
    // Query the handful of humans instead of sorting the entire nearby horde.
    // Recheck live state/position on every query: bites, deaths and movement
    // during this same tick must take effect immediately.
    const squared = radius * radius;
    for (const id of this.candidates) {
      const h = this.human(this.world.entities.get(id));
      if (h && (h.position.x - center.x) ** 2 + (h.position.z - center.z) ** 2 <= squared) this.list.push(h);
    }
    this.list.sort((a, b) => a.id - b.id);
    return this.list;
  }
}

/**
 * L1 infected vision (specs/epic-19 section 5.2): a forward 90 degree cone, 16 m, blocked by the scene's full-height
 * cover walls and by registered dynamic blockers. L5 humans and Alphas in every level are heard from any side through cover
 * (PO #25 / 10-16); movement and gunfire scale the awareness radius. A chased
 * target stays tracked within `chaseKeepM` in any direction, else in a wide 150 degree cone, while line of sight is clear.
 */
/** A director-focused human (InfectedSystem.press) wins against bystanders up to this much nearer. */
const focusBiasM = 10;
export class Perception {
  humans: HumanTargetQuery;
  readonly los = new LosRegistry();
  readonly rangeM = l1v2.infected.visionRangeM;
  /** PO 10-16: "Alpha awareness: needs to be level independent". Ordinary infected retain their level rules. */
  private closeAwareness(e: EntitySnapshot): boolean { return this.world.scenario === 'L5' || e.archetype === 'infected.alpha'; }
  get hearingM(): number { return this.world.scenario === 'L5' ? 6 : 2; }
  private readonly shotUntil = new Map<number, number>();
  /** Level pressure routing (L3 corridor): the courier counts this many metres farther than she is when choosing a new
   * target, so a nearby police line draws the crowd first. 0 everywhere else. */
  playerBiasM = 0;
  private readonly cosHalf = Math.cos(l1v2.infected.visionConeDeg / 2 * Math.PI / 180);
  constructor(private readonly world: SimWorld) { this.humans = new WorldHumans(world); }
  /** Real courier/ally gunshots expand Alpha hearing for one second; L5 still uses courier shots only. */
  shot(sourceId = 1): void {
    for (const [id, until] of this.shotUntil) if (until <= this.world.tick) this.shotUntil.delete(id);
    this.shotUntil.set(sourceId, this.world.tick + 60);
  }
  /** Clear line of sight between two ground points (static cover walls + active dynamic blockers). */
  lineOfSight(from: Vec2, to: Vec2): boolean {
    return (this.world.combat?.query.visible(from, to) ?? true) && this.los.clear(from, to);
  }
  inCone(e: EntitySnapshot, target: Vec2): boolean {
    const dx = target.x - e.transform.x, dz = target.z - e.transform.z, distance = Math.hypot(dx, dz);
    // Facing rejects most peripheral herd cues before the night lamp scan.
    if (!(distance === 0 || (dx * Math.cos(e.transform.yaw) - dz * Math.sin(e.transform.yaw)) / distance >= this.cosHalf - 1e-9)) return false;
    return distance <= this.rangeM * (this.world.weather?.modifiers.infectedSight ?? 1) * (this.world.lightPower?.sightMultiplier(target) ?? 1);
  }
  /** Detection: inside the cone and range with clear line of sight. */
  sees(e: EntitySnapshot, target: Vec2): boolean { return this.inCone(e, target) && this.lineOfSight(e.transform, target); }
  /** A chased target stays tracked inside this range in any direction while line of sight is clear (PO 10-09: "walking
   * around, although in my direct near"). A pursuer that just lunged past or was knocked round does not forget her. */
  readonly chaseKeepM = 6;
  /** Half-angle cosine of the tracking cone for an already chased target (150 degrees: the body turns slower than the head). */
  private readonly trackCos = Math.cos(75 * Math.PI / 180);
  /** Keeps an already chased target: the wide tracking cone, or within `chaseKeepM` with line of sight. */
  tracks(e: EntitySnapshot, target: Vec2, targetId?: number): boolean {
    if (this.closeAwareness(e) && this.hears(e, target, targetId)) return true;
    const dx = target.x - e.transform.x, dz = target.z - e.transform.z, distance = Math.hypot(dx, dz);
    if (distance > this.rangeM * (this.world.weather?.modifiers.infectedSight ?? 1) * (this.world.lightPower?.sightMultiplier(target) ?? 1)) return false;
    const near = distance <= this.chaseKeepM || (dx * Math.cos(e.transform.yaw) - dz * Math.sin(e.transform.yaw)) / distance >= this.trackCos;
    return near && this.lineOfSight(e.transform, target);
  }
  /** PO #25: nearby humans are smelled/heard through cover, independent of facing and sight. */
  hears(e: EntitySnapshot, target: Vec2, targetId?: number): boolean {
    const dx = target.x - e.transform.x, dz = target.z - e.transform.z, squared = dx * dx + dz * dz;
    // Allies share this query for defence; PO #25 changes infected awareness only.
    if (!e.infected) return squared <= 4 && this.lineOfSight(e.transform, target);
    if (!this.closeAwareness(e)) return squared <= 4 && this.lineOfSight(e.transform, target);
    if (this.world.scenario !== 'L5') {
      if (squared > 144) return false;
      let entity = targetId !== undefined ? this.world.entities.get(targetId) : undefined;
      if (targetId === undefined) for (const candidate of this.world.entities.iterate()) {
        if ((candidate.id === 1 || candidate.civilian) && (candidate.transform.x - target.x) ** 2 + (candidate.transform.z - target.z) ** 2 < .01) { entity = candidate; break; }
      }
      if (!entity) return squared <= 36;
      const velocity = entity.survivor?.velocity ?? entity.motion?.velocity;
      const speedSquared = velocity ? velocity.x ** 2 + velocity.z ** 2 : (entity.locomotion?.vx ?? 0) ** 2 + (entity.locomotion?.vz ?? 0) ** 2;
      const quiet = entity.civilian?.story?.clip === 'npc-cower' || entity.civilian?.state === 'hide' || speedSquared < .25;
      const radius = this.world.tick < (this.shotUntil.get(entity.id) ?? 0) ? 12 : quiet ? 4 : speedSquared > 9 ? 9 : 6;
      return squared <= radius * radius;
    }
    // PO #29 freezes L5's original six-metre floor, including still/crouched humans.
    if (squared <= this.hearingM * this.hearingM) return true;
    if (squared > 144) return false;
    // Only the courier's running/shooting expands the radius. Keep the common
    // six-metre query free of entity lookups and square roots in large hordes.
    const player = this.world.entities.get(1);
    if (!player || (target.x - player.transform.x) ** 2 + (target.z - player.transform.z) ** 2 > .01) return false;
    if (this.world.tick < (this.shotUntil.get(1) ?? 0)) return true;
    const v = player.survivor?.velocity;
    return squared <= 81 && !!v && v.x * v.x + v.z * v.z > 9;
  }
  /** Detection of a new target by unchanged vision or close hearing. */
  notices(e: EntitySnapshot, target: Vec2, targetId?: number): boolean {
    return this.sees(e, target) || this.hears(e, target, targetId);
  }
  /** Closest nearby human, using the same huntable target query as vision. */
  closestHeard(e: EntitySnapshot): HumanTarget | undefined {
    let best: HumanTarget | undefined, distance = Infinity;
    for (const h of this.humans.within(e.transform, this.closeAwareness(e) ? 12 : this.hearingM)) {
      const d = Math.hypot(h.position.x - e.transform.x, h.position.z - e.transform.z);
      if (d < distance && this.hears(e, h.position, h.id)) { best = h; distance = d; }
    }
    return best;
  }
  /**
   * Closest visible human; the current target is kept unless another visible human is at least the switch hysteresis
   * (1.5 m) closer. Returns undefined when nobody is visible.
   */
  closest(e: EntitySnapshot, currentId: number, ignoreId = 0): HumanTarget | undefined {
    let best: HumanTarget | undefined, bestDistance = Infinity, current: HumanTarget | undefined, currentDistance = Infinity;
    const brain = e.infected?.l1, focus = brain?.focusId && this.world.tick < (brain.focusUntil ?? 0) ? brain.focusId : 0;
    for (const h of this.humans.within(e.transform, this.rangeM)) {
      if (h.id === ignoreId) continue;
      const isCurrent = h.id === currentId;
      if (!(isCurrent ? this.tracks(e, h.position, h.id) : this.notices(e, h.position, h.id))) continue;
      const distance = Math.hypot(h.position.x - e.transform.x, h.position.z - e.transform.z) + (h.id === 1 ? this.playerBiasM : 0) - (h.id === focus ? focusBiasM : 0);
      if (isCurrent) { current = h; currentDistance = distance; }
      if (distance < bestDistance) { best = h; bestDistance = distance; }
    }
    if (current && best !== current && currentDistance - bestDistance < l1v2.infected.switchHysteresisM) return current;
    return best;
  }
}
