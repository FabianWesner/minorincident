import type { EntityStore } from '../world/EntityStore';
import type { EntitySnapshot } from '../world/types';
import type { SpatialHash } from '../spatial/SpatialHash';
import type { Vec2 } from '../../input/InputFrame';
import type { ScenarioDefinition } from '../../levels/loader';
export type CoverWall = NonNullable<ScenarioDefinition['walls']>[number];
/** Reused neighbor/result buffers; stable IDs break ties. Walls are the scenario's full-cover colliders. */
export class HitQuery {
  private readonly neighbors: number[] = [];
  readonly hits: EntitySnapshot[] = [];
  private readonly area = { x: 0, z: 0, r: 0 };
  constructor(private readonly entities: EntityStore, private readonly spatial: SpatialHash, readonly walls: readonly CoverWall[]) {}
  nearby(origin: Vec2, range: number): readonly number[] {
    this.area.x = origin.x; this.area.z = origin.z; this.area.r = range;
    return this.spatial.query(this.area, this.neighbors);
  }
  /** Segment vs XZ slabs; returns first solid cover distance, or the whole segment. */
  clearDistance(origin: Vec2, direction: Vec2, range: number): number {
    let closest = range;
    for (const wall of this.walls) {
      if (wall.y - wall.halfY > 0.7 || wall.y + wall.halfY < 0.7) continue;
      let near = 0, far = range;
      for (const axis of ['x', 'z'] as const) {
        const half = axis === 'x' ? wall.halfX : wall.halfZ, d = direction[axis];
        if (Math.abs(d) < 1e-12) { if (origin[axis] < wall[axis] - half || origin[axis] > wall[axis] + half) { far = -1; break; } }
        else { const a = (wall[axis] - half - origin[axis]) / d, b = (wall[axis] + half - origin[axis]) / d; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b)); }
      }
      if (far >= near && near < closest) closest = near;
    }
    return closest;
  }
  visible(origin: Vec2, target: Vec2): boolean {
    const dx = target.x - origin.x, dz = target.z - origin.z, distance = Math.hypot(dx, dz);
    return !distance || this.clearDistance(origin, { x: dx / distance, z: dz / distance }, distance) >= distance - 1e-8;
  }
  melee(sourceId: number, origin: Vec2, aim: Vec2, range: number, arc: number, maxTargets: number): readonly EntitySnapshot[] {
    this.hits.length = 0;
    const limit = Math.cos(arc * Math.PI / 360);
    for (const id of this.nearby(origin, range + 1e-6)) {
      const target = this.entities.get(id)!;
      if (id === sourceId || target.health.current <= 0 || target.faction !== 'infected') continue;
      const dx = target.transform.x - origin.x, dz = target.transform.z - origin.z, distance = Math.hypot(dx, dz);
      if ((!distance || (dx * aim.x + dz * aim.z) / distance >= limit - 1e-6) && this.visible(origin, target.transform)) this.hits.push(target);
      if (this.hits.length === maxTargets) break;
    }
    return this.hits;
  }
  ray(sourceId: number, origin: Vec2, direction: Vec2, range: number, excluded?: ReadonlySet<number>): EntitySnapshot | null {
    const wallDistance = this.clearDistance(origin, direction, range);
    let nearest = wallDistance, hit: EntitySnapshot | null = null;
    for (const id of this.nearby(origin, range + 0.5)) {
      const target = this.entities.get(id)!;
      if (id === sourceId || excluded?.has(id) || target.health.current <= 0 || target.faction !== 'infected') continue;
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
      if (entity.health.current > 0 && this.visible(origin, entity.transform) && (entity.transform.x - origin.x) ** 2 + (entity.transform.z - origin.z) ** 2 + (entity.transform.y - 0.7) ** 2 <= radius * radius + 1e-8) this.hits.push(entity);
    }
    return this.hits;
  }
}
