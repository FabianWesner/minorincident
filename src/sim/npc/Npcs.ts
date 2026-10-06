import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { civilianRoles, npcs } from '../../data/npcs';
import { Companion } from './Companion';
import { Escorts } from './Escorts';
import { Civilians } from './Civilians';
import type { Point } from './types';
/** E08 composition and reused E07 navigation. Public authoring hooks are also headless test hooks. */
export class Npcs {
  readonly civilians: Civilians;
  readonly companion: Companion;
  readonly escorts: Escorts;
  private readonly waypoint = { x: 0, z: 0 };
  constructor(readonly world: SimWorld) { this.civilians = new Civilians(world); this.companion = new Companion(world); this.escorts = new Escorts(world); }
  move(e: EntitySnapshot, target: Point, speed: number, path: { path: number[]; goal: number; pathIndex: number }, stop = .1): void {
    const nav = this.world.infected!.nav;
    let dx = target.x - e.transform.x, dz = target.z - e.transform.z, distance = Math.hypot(dx, dz);
    if (distance <= stop) return;
    if (!nav.visible(e.transform, target, .35)) {
      const goal = nav.cell(target.x, target.z);
      if (goal !== path.goal || path.pathIndex >= path.path.length) {
        if (!nav.path(nav.cell(e.transform.x, e.transform.z), goal, path.path, 300)) return;
        path.goal = goal; path.pathIndex = 0;
      }
      const cell = path.path[path.pathIndex]; this.waypoint.x = nav.x(cell); this.waypoint.z = nav.z(cell);
      dx = this.waypoint.x - e.transform.x; dz = this.waypoint.z - e.transform.z; distance = Math.hypot(dx, dz);
      if (distance < .15) { path.pathIndex++; return; }
    } else { path.path.length = 0; path.goal = -1; }
    const step = Math.min(distance, speed / 60);
    nav.move(e.transform, dx / distance * step, dz / distance * step, .35); e.transform.yaw = -Math.atan2(dz, dx);
    this.world.spatial.set(e.id, e.transform.x, e.transform.z);
  }
  /** Place collision-safe rectangular routines from authored navigation, never inside buildings. */
  populate(count: number): void {
    const nav = this.world.infected!.nav; let placed = 0;
    for (let z = nav.center.z - nav.ground.depth / 2 + 3; z < nav.center.z + nav.ground.depth / 2 - 6 && placed < count; z += 6) {
      for (let x = nav.center.x - nav.ground.width / 2 + 3; x < nav.center.x + nav.ground.width / 2 - 6 && placed < count; x += 6) {
        const points = [{ x, z }, { x: x + 3, z }, { x: x + 3, z: z + 3 }, { x, z: z + 3 }];
        if (!points.every((p, i) => nav.visible(p, points[(i + 1) % 4], .65))) continue;
        const role = civilianRoles[placed % civilianRoles.length];
        const id = this.civilians.spawn(role.role, points[0], { waypoints: points });
        if (role.routine === 'walk-dog') this.civilians.spawn('dog', { x: x - 1, z }, { pet: 'dog', owner: id });
        placed++;
      }
    }
    if (placed !== count) throw new Error('Insufficient safe civilian routines');
  }
  /** Per-level campaign authoring entry point; density is quality-scaled and pets are separate. */
  configure(level: number, tier: 'high' | 'low' = 'high', count = Math.round(npcs.density[level - 1] * (tier === 'low' ? .6 : 1))): void {
    if (!Number.isInteger(level) || level < 1 || level > 6) throw new RangeError('Invalid NPC level');
    this.civilians.level = level; this.world.infected!.director.levelCap = npcs.caps[level - 1]; this.world.infected!.director.tier = tier; this.populate(count);
  }
  update(): void { this.civilians.update(); this.companion.update(); this.escorts.update(); }
}
