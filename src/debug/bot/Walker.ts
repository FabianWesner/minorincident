import type { SimWorld } from '../../sim/world/SimWorld';
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x-b.x, a.z-b.z);
export class Walker {
  private route = { path: [] as number[], goal: -1, pathIndex: 0 };
  private key = '';
  private readonly wp = { x: 0, z: 0 };
  reset(): void { this.route = { path: [], goal: -1, pathIndex: 0 }; }
  /** Pick an actual connected grid destination, rather than a point across a fence. */
  detour(world: SimWorld, goal: { x: number; z: number }, away?: { x: number; z: number }): { x: number; z: number } | null {
    const p = world.entities.get(1)!.transform, nav = world.infected!.nav;
    const from = nav.nearestCell(p.x, p.z, .45), path: number[] = [];
    let best: { x: number; z: number } | null = null, score = -Infinity;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, target = { x: p.x + Math.cos(angle) * 6, z: p.z + Math.sin(angle) * 6 };
      nav.reachPath(from, target, path);
      const cell = path[path.length - 1];
      if (cell === undefined || path.length > 40) continue;
      const at = { x: nav.x(cell), z: nav.z(cell) };
      if (dist(p, at) < 3) continue;
      const value = dist(p, goal) - dist(at, goal) + (away ? 2 * (dist(at, away) - dist(p, away)) : 0);
      if (value > score) { best = at; score = value; }
    }
    this.reset();
    return best;
  }
  /** Route toward the target; stop within `stop` metres or when no route is available. */
  step(world: SimWorld, target: { x: number; z: number }, stop: number, key: string): { x: number; z: number } | null {
    const p = world.entities.get(1)!.transform;
    if (dist(p, target) <= stop) return null;
    if (key !== this.key) { this.key = key; this.reset(); }
    // Use the player flood's separate workspace: crowd A* cannot starve a re-plan.
    const ok = world.infected!.nav.steer(p, target, this.route, .45, this.wp, Infinity, true);
    // A failed search is not permission to walk straight through its obstacle.
    if (!ok) return null;
    const dx = this.wp.x - p.x, dz = this.wp.z - p.z, d = Math.hypot(dx, dz) || 1;
    // Held movement lasts 250 ms for the newbie: brake before a short grid waypoint.
    const speed = Math.min(1, d / 1.2);
    return { x: dx / d * speed, z: dz / d * speed };
  }
}

