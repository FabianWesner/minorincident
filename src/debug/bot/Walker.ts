import type { SimWorld } from '../../sim/world/SimWorld';
import { actorRadius, solidLargeCorpse } from '../../sim/world/SolidRegistry';
import type { NavGrid } from '../../sim/ai/NavGrid';
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x-b.x, a.z-b.z);
export class Walker {
  private route = { path: [] as number[], goal: -1, pathIndex: 0 };
  private key = '';
  private readonly wp = { x: 0, z: 0 };
  private bodyGrid: { source: NavGrid; revision: number; signature: string; grid: NavGrid } | null = null;
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
  step(world: SimWorld, target: { x: number; z: number }, stop: number, key: string, avoidCorpses = false): { x: number; z: number } | null {
    const p = world.entities.get(1)!.transform;
    if (dist(p, target) <= stop) return null;
    if (key !== this.key) { this.key = key; this.reset(); }
    // Player navigation is streamed around the courier. Story waypoints can be
    // several hundred metres away and therefore have no cell yet. Walk toward
    // a short, straight intermediate point until the next chunk streams in.
    let nav = world.infected!.nav;
    if (avoidCorpses) {
      const source = nav.forPlayer(.45), bodies = [...world.entities.iterate()].filter(e => solidLargeCorpse(e) && !e.hidden && Math.abs(e.transform.y - p.y) < 1.2 && dist(p, e.transform) < 35);
      const signature = bodies.map(e => `${e.id}:${e.transform.x.toFixed(2)}:${e.transform.z.toFixed(2)}`).join('|');
      if (!this.bodyGrid || this.bodyGrid.source !== source || this.bodyGrid.revision !== source.revision || this.bodyGrid.signature !== signature) {
        // Private planning data only. Production nav, bodies and collision are untouched.
        const grid = source.withClearance(.45);
        for (const body of bodies) grid.setBlocker(-body.id, { x: body.transform.x, y: .7, z: body.transform.z, halfX: actorRadius(body), halfY: 1, halfZ: actorRadius(body) }, true);
        this.bodyGrid = { source, revision: source.revision, signature, grid }; this.reset();
      }
      nav = this.bodyGrid.grid;
    }
    if (nav.nearestCell(target.x, target.z, .45) < 0) {
      const d = dist(p, target), leg = Math.min(55, d - stop);
      if (leg > 0) target = { x: p.x + (target.x - p.x) / d * leg, z: p.z + (target.z - p.z) / d * leg };
    }
    // Use the player flood's separate workspace: crowd A* cannot starve a re-plan.
    const ok = nav.steer(p, target, this.route, .45, this.wp, Infinity, true);
    // A failed search is not permission to walk straight through its obstacle.
    if (!ok) return null;
    const dx = this.wp.x - p.x, dz = this.wp.z - p.z, d = Math.hypot(dx, dz) || 1;
    // Held movement lasts 250 ms for the newbie: brake before a short grid waypoint.
    const speed = Math.min(1, d / 1.2);
    return { x: dx / d * speed, z: dz / d * speed };
  }
}

