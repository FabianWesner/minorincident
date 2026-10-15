import type { SimWorld } from '../world/SimWorld';
import type { CoverWall } from '../combat/HitQuery';

/** The checkpoint kit's authored arm (hinge local -6, 1.18, 1.8). Used by L3 and Scene Lab. */
export class ArmyCheckpointBoom {
  private handle?: number;
  readonly wall: CoverWall;
  constructor(private readonly world: SimWorld, x: number, z = 0) {
    this.wall = { x, y: 1.18, z, halfX: .08, halfY: .09, halfZ: 1.85 };
  }
  set(closed: boolean): void {
    if (closed && this.handle === undefined) this.handle = this.world.physics.addBlocker(this.wall);
    if (!closed && this.handle !== undefined) { this.world.physics.removeBlocker(this.handle); this.handle = undefined; }
    this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: 900_450, blocked: closed, wall: this.wall });
  }
  /** Wait for every surviving human; do not drop the arm onto any body. */
  ready(ids: readonly number[]): boolean {
    if (!ids.every(id => { const e = this.world.entities.get(id); return !e || e.health.current <= 0 || !!e.infection || e.transform.x > this.wall.x + 1.1; })) return false;
    return ![...this.world.entities.iterate()].some(e => !e.infected && e.health.current > 0 && Math.abs(e.transform.x - this.wall.x) < .6 && Math.abs(e.transform.z - this.wall.z) < 2.2);
  }
  /**
   * A stray civilian standing in the arm's path must not hold the rescue open for ever (completion now waits for the closure):
   * step bystanders that are not part of the rescued group through to the compound side.
   */
  clearBystanders(ids: readonly number[]): void {
    for (const e of this.world.entities.iterate()) {
      if (!e.civilian || e.infection || e.health.current <= 0 || ids.includes(e.id) || Math.abs(e.transform.x - this.wall.x) >= .6 || Math.abs(e.transform.z - this.wall.z) >= 2.2) continue;
      e.transform.x = this.wall.x + 1.6; this.world.spatial.set(e.id, e.transform.x, e.transform.z);
      // Move the standing order as well as the body, so a guard or scheduled resident cannot walk back under the arm.
      const c = e.civilian, clear = (p: { x: number; z: number }) => {
        if (Math.abs(p.x - this.wall.x) < .6 && Math.abs(p.z - this.wall.z) < 2.2) p.x = e.transform.x;
      };
      c.waypoints.forEach(clear); c.schedule?.forEach(s => clear(s.target));
      if (c.ally?.post) clear(c.ally.post);
      if (c.ally?.run) clear(c.ally.run);
      c.goal = -1; c.path.length = 0;
    }
  }
}
