import { doorwayOf, type Doorway } from '../../data/buildingDoors';
import type { NavGrid } from '../ai/NavGrid';
import type { SimWorld } from '../world/SimWorld';

type P = { x: number; z: number };
/** Body radius the routes keep from colliders (civilian capsule). */
export const routeRadius = .3;

/** The doorway of the nearest placed `assetId` (district placements of the loaded composition). */
export function findDoorway(world: SimWorld, assetId: string, near: P): Doorway | null {
  let best: Doorway | null = null, distance = Infinity;
  for (const d of world.districts?.districts ?? []) for (const p of d.decay.placements) {
    if (p.assetId !== assetId) continue;
    const way = doorwayOf(p, d.origin); if (!way) continue;
    const m = Math.hypot(way.door.x - near.x, way.door.z - near.z);
    if (m < distance) { distance = m; best = way; }
  }
  return best;
}

/**
 * Walking route for a story actor who comes out of a building to someone and back: from behind the door, straight
 * through the door aperture (perpendicular to the facade), out past the sidewalk dressing to the first walkable point, then along
 * the navigation grid (string-pulled, clear of colliders and props) to `meet`. Walk it in reverse to go back in.
 * Indices: 0 inside, 1 door plane, 2 outside the facade, last = meeting point.
 */
export function doorRoute(nav: NavGrid, way: Doorway, meet: P, radius = routeRadius): P[] {
  const out = way.out, route: P[] = [way.inside, way.door];
  let step = { ...way.door };
  for (let m = Math.max(.1, way.apron); m <= way.apron + 5; m += .05) {
    step = { x: way.door.x + out.x * m, z: way.door.z + out.z * m };
    if (nav.clear(step.x, step.z, radius + .05)) break;
  }
  route.push(step);
  // Meeting point on walkable ground (a courier standing against a planter gives a point inside it).
  let goal = { ...meet };
  // Never back onto the apron: a courier hugging the shopfront is met at the apron's edge.
  const short = (step.x - way.door.x) * out.x + (step.z - way.door.z) * out.z - ((goal.x - way.door.x) * out.x + (goal.z - way.door.z) * out.z);
  if (short > 0) goal = { x: goal.x + out.x * short, z: goal.z + out.z * short };
  if (!nav.clear(goal.x, goal.z, radius)) {
    const cell = nav.nearestCell(goal.x, goal.z, radius);
    if (cell >= 0) goal = { x: nav.x(cell), z: nav.z(cell) };
  }
  if (nav.visible(step, goal, radius)) { route.push(goal); return route; }
  const from = nav.nearestCell(step.x, step.z, radius), to = nav.nearestCell(goal.x, goal.z, radius), cells: number[] = [];
  if (from < 0 || to < 0 || !nav.path(from, to, cells, 40000)) { route.push(goal); return route; }
  const points = [{ x: nav.x(from), z: nav.z(from) }, ...cells.map(c => ({ x: nav.x(c), z: nav.z(c) })), goal];
  // String pulling: from each corner, jump to the farthest point still in clear sight.
  let at = step;
  for (let i = 0; i < points.length;) {
    let j = points.length - 1;
    while (j > i && !nav.visible(at, points[j], radius)) j--;
    at = points[j]; route.push(at); i = j + 1;
  }
  return route;
}

export function routeLength(route: readonly P[]): number { let m = 0; for (let i = 1; i < route.length; i++) m += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z); return m; }
/** Point `m` metres along the route (clamped), and the heading of that segment. */
export function routeAt(route: readonly P[], m: number): P & { dx: number; dz: number } {
  let left = Math.max(0, m);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], d = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= d || i === route.length - 1) { const k = d > 1e-6 ? Math.min(1, left / d) : 1; return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, dx: b.x - a.x, dz: b.z - a.z }; }
    left -= d;
  }
  const p = route[route.length - 1] ?? { x: 0, z: 0 }; return { ...p, dx: 0, dz: 0 };
}
