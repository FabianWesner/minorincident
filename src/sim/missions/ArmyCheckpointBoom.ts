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
    return ![...this.world.entities.iterate()].some(e => e.health.current > 0 && Math.abs(e.transform.x - this.wall.x) < .6 && Math.abs(e.transform.z - this.wall.z) < 2.2);
  }
}
