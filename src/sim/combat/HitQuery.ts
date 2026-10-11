import { downed } from './Damage';
import type { EntityStore } from '../world/EntityStore';
import type { EntitySnapshot } from '../world/types';
import type { SpatialHash } from '../spatial/SpatialHash';
import type { Vec2 } from '../../input/InputFrame';
import type { ScenarioDefinition } from '../../levels/loader';
type RayPoint = Vec2 & { y?: number };
export type CoverWall = NonNullable<ScenarioDefinition['walls']>[number] & { entityId?: number };
/** Reused neighbor/result buffers; stable IDs break ties. Walls are the scenario's full-cover colliders. */
export class HitQuery {
  private readonly neighbors: number[] = [];
  readonly hits: EntitySnapshot[] = [];
  private readonly area = { x: 0, z: 0, r: 0 };
  private readonly wallGroups: readonly (readonly CoverWall[])[];
  constructor(private readonly entities: EntityStore, private readonly spatial: SpatialHash, readonly walls: readonly CoverWall[], readonly dynamicWalls: readonly CoverWall[] = []) { this.wallGroups = [walls, dynamicWalls]; }
  nearby(origin: Vec2, range: number): readonly number[] {
    this.area.x = origin.x; this.area.z = origin.z; this.area.r = range;
    return this.spatial.query(this.area, this.neighbors);
  }
  /** Static walls bucketed on an 8 m grid (rebuilt when the array changes; `invalidate` after in-place edits). */
  private grid: { cells: Map<number, number[]>; length: number; first: CoverWall | undefined; last: CoverWall | undefined } | null = null;
  private stamps = new Uint32Array(0);
  private stamp = 0;
  private readonly candidates: number[] = [];
  invalidate(): void { this.grid = null; }
  private static key(x: number, z: number): number { return (x + 4096) * 8192 + z + 4096; }
  private index() {
    const w = this.walls;
    if (this.grid && this.grid.length === w.length && this.grid.first === w[0] && this.grid.last === w[w.length - 1]) return this.grid;
    const cells = new Map<number, number[]>();
    w.forEach((wall, i) => {
      for (let x = Math.floor((wall.x - wall.halfX) / 8); x <= Math.floor((wall.x + wall.halfX) / 8); x++) for (let z = Math.floor((wall.z - wall.halfZ) / 8); z <= Math.floor((wall.z + wall.halfZ) / 8); z++) {
        const key = HitQuery.key(x, z), list = cells.get(key); if (list) list.push(i); else cells.set(key, [i]);
      }
    });
    if (this.stamps.length < w.length) this.stamps = new Uint32Array(w.length);
    return this.grid = { cells, length: w.length, first: w[0], last: w[w.length - 1] };
  }
  /** Segment vs XYZ slabs (range measured along XZ); returns first solid cover distance, or the whole segment. */
  clearDistance(origin: RayPoint, direction: RayPoint, range: number, ignoreId?: number, padding = 0): number {
    let closest = range;
    // Static walls: only those in the 8 m cells overlapping the segment's bounds (a wall crossing the segment shares a cell with it).
    if (this.walls.length > 64) {
      const grid = this.index(), ex = origin.x + direction.x * range, ez = origin.z + direction.z * range;
      if (++this.stamp === 0xffffffff) { this.stamps.fill(0); this.stamp = 1; }
      const list = this.candidates; list.length = 0;
      for (let x = Math.floor((Math.min(origin.x, ex) - padding) / 8); x <= Math.floor((Math.max(origin.x, ex) + padding) / 8); x++) for (let z = Math.floor((Math.min(origin.z, ez) - padding) / 8); z <= Math.floor((Math.max(origin.z, ez) + padding) / 8); z++) {
        for (const i of grid.cells.get(HitQuery.key(x, z)) ?? []) if (this.stamps[i] !== this.stamp) { this.stamps[i] = this.stamp; list.push(i); }
      }
      for (const i of list) closest = this.cover(this.walls[i], origin, direction, range, closest, ignoreId, padding);
      for (const wall of this.dynamicWalls) closest = this.cover(wall, origin, direction, range, closest, ignoreId, padding);
      return closest;
    }
    for (const walls of this.wallGroups) for (const wall of walls) closest = this.cover(wall, origin, direction, range, closest, ignoreId, padding);
    return closest;
  }
  wallDistance(wall: CoverWall, origin: RayPoint, direction: RayPoint, range: number, padding = 0): number { return this.cover(wall, origin, direction, range, range, undefined, padding); }
  private cover(wall: CoverWall, origin: RayPoint, direction: RayPoint, range: number, closest: number, ignoreId?: number, padding = 0): number {
    {
      if (wall.entityId !== undefined && wall.entityId === ignoreId) return closest;
      let near = 0, far = range;
      for (const axis of ['x', 'y', 'z'] as const) {
        const half = axis === 'x' ? wall.halfX : axis === 'y' ? wall.halfY : wall.halfZ, d = direction[axis] ?? 0;
        const extent = half + (axis === 'y' ? 0 : padding);
        const start = origin[axis] ?? .7;
        if (Math.abs(d) < 1e-12) { if (start < wall[axis] - extent || start > wall[axis] + extent) { far = -1; break; } }
        else { const a = (wall[axis] - extent - start) / d, b = (wall[axis] + extent - start) / d; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b)); }
      }
      return far >= near && near < closest ? near : closest;
    }
  }
  visible(origin: RayPoint, target: RayPoint, ignoreId?: number): boolean {
    const dx = target.x - origin.x, dz = target.z - origin.z, distance = Math.hypot(dx, dz);
    return !distance || this.clearDistance(origin, { x: dx / distance, y: ((target.y ?? .7) - (origin.y ?? .7)) / distance, z: dz / distance }, distance, ignoreId) >= distance - 1e-8;
  }
  /** Transforms store the body centre, .7 m above the feet; rifles fire at 1.15 m. */
  shotVisible(origin: RayPoint, target: RayPoint, ignoreId?: number): boolean {
    return this.visible({ ...origin, y: (origin.y ?? .7) + .45 }, { ...target, y: (target.y ?? .7) + .45 }, ignoreId);
  }
  private readonly eye = { x: 0, z: 0 };
  /** `ground`: a downed infected the swing was aimed at (a click on it); other downed bodies are never struck. */
  melee(sourceId: number, origin: Vec2, aim: Vec2, range: number, arc: number, maxTargets: number, civilianGag = false, ground?: number): readonly EntitySnapshot[] {
    this.hits.length = 0;
    const limit = Math.cos(arc * Math.PI / 360);
    for (const id of this.nearby(origin, range + 1e-6)) {
      const target = this.entities.get(id)!;
      if (id === sourceId || (target.health.current <= 0 && !(id === ground && downed(target))) || (target.faction !== 'infected' && !target.civilian?.eyesGlow && !(civilianGag && target.civilian?.adult && !target.civilian.pet) && !(target.faction === 'environment' && target.combat))) continue;
      const dx = target.transform.x - origin.x, dz = target.transform.z - origin.z, distance = Math.hypot(dx, dz);
      // Line of sight starts a little ahead of the attacker: standing against (or inside) a prop must not
      // swallow strikes at a target on its far side (QA2-01); walls between the two still block.
      const lead = distance > 1e-6 ? Math.min(.45, distance * .5) / distance : 0;
      this.eye.x = origin.x + dx * lead; this.eye.z = origin.z + dz * lead;
      if ((!distance || (dx * aim.x + dz * aim.z) / distance >= limit - 1e-6) && this.visible(this.eye, target.transform, target.id)) this.hits.push(target);
      if (this.hits.length === maxTargets) break;
    }
    return this.hits;
  }
  ray(sourceId: number, origin: RayPoint, direction: RayPoint, range: number, excluded?: ReadonlySet<number>): EntitySnapshot | null {
    const wallDistance = this.clearDistance(origin, direction, range);
    let nearest = wallDistance, hit: EntitySnapshot | null = null;
    for (const id of this.nearby(origin, range + 0.5)) {
      const target = this.entities.get(id)!;
      if (id === sourceId || excluded?.has(id) || target.health.current <= 0 || (target.faction !== 'infected' && !target.civilian?.eyesGlow && !(target.faction === 'environment' && target.combat))) continue;
      const dx = target.transform.x - origin.x, dz = target.transform.z - origin.z;
      const along = dx * direction.x + dz * direction.z, perpendicular = dx * dx + dz * dz - along * along;
      const radius = target.combat?.radius ?? 0.4;
      if (perpendicular > radius * radius || along + radius < 0) continue;
      const entry = Math.max(0, along - Math.sqrt(Math.max(0, radius * radius - perpendicular)));
      if (entry < nearest || (entry === nearest && (!hit || id < hit.id))) { nearest = entry; hit = target; }
    }
    return hit;
  }
  splash(origin: Vec2, radius: number): readonly EntitySnapshot[] {
    this.hits.length = 0;
    for (const id of this.nearby(origin, radius)) {
      const entity = this.entities.get(id)!;
      if ((entity.health.current > 0 || downed(entity)) && this.visible(origin, entity.transform, entity.id) && (entity.transform.x - origin.x) ** 2 + (entity.transform.z - origin.z) ** 2 + (entity.transform.y - 0.7) ** 2 <= radius * radius + 1e-8) this.hits.push(entity);
    }
    return this.hits;
  }
}
