import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { followerInCombat } from '../../../src/sim/outbreak/Survivors';

type Point = { x: number; z: number };
type Follower = { id: number; followAt: number; calmTicks: number; within8Ticks: number; movingCalmTicks: number; behind2To5Ticks: number;
  maxMotionSpeed: number; straightTicks: number; inBandStraightTicks: number; lastStraightTick?: number; badStraightTicks: number; badRun: number; maxBadRun: number;
  counterexample: { tick: number; behind: number; distance: number; player: Point; follower: Point; playerSpeed: number } | null };

/** Observe the existing complete policy without changing actors or input. The
 * straight subset proves counterexamples; it cannot qualify all formation states. */
export class L5FormationObserver {
  private straightAt = 0;
  private heading = { x: 0, z: 0 };
  private followers = new Map<number, Follower>();

  observe(world: SimWorld, before: Point): void {
    const mission = world.missions?.state;
    if (world.scenario !== 'L5' || mission?.phase !== 'playing' || !['search', 'metro'].includes(mission.l5!.phase)) return;
    const player = world.entities.get(1)!, vx = (player.transform.x - before.x) * 60, vz = (player.transform.z - before.z) * 60;
    const speed = Math.hypot(vx, vz);
    if (speed < 3) this.straightAt = 0;
    else if (!this.straightAt || (vx * this.heading.x + vz * this.heading.z) / speed < Math.cos(Math.PI / 36)) {
      this.straightAt = world.tick; this.heading = { x: vx / speed, z: vz / speed };
    }
    const group = [...world.entities.iterate()].filter(e => e.civilian?.survivor?.mode === 'follow' && !e.hidden && !e.infection && e.health.current > 0);
    for (const e of group) {
      const row = this.followers.get(e.id) ?? { id: e.id, followAt: world.tick, calmTicks: 0, within8Ticks: 0, movingCalmTicks: 0, behind2To5Ticks: 0,
        maxMotionSpeed: 0, straightTicks: 0, inBandStraightTicks: 0, badStraightTicks: 0, badRun: 0, maxBadRun: 0, counterexample: null };
      this.followers.set(e.id, row);
      if (e.motion && !['grabbed', 'bitten'].includes(e.civilian!.state) && e.civilian!.knockedUntil <= world.tick) row.maxMotionSpeed = Math.max(row.maxMotionSpeed, e.motion.speed);
      if (followerInCombat(world, e)) { row.badRun = 0; continue; }
      const distance = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z);
      row.calmTicks++; if (distance <= 8) row.within8Ticks++;
      if (speed <= .2) { row.badRun = 0; continue; }
      row.movingCalmTicks++;
      const behind = ((player.transform.x - e.transform.x) * vx + (player.transform.z - e.transform.z) * vz) / speed;
      if (behind >= 2 && behind <= 5) row.behind2To5Ticks++;
      // The straight-walk gate below guarantees one heading for the last second.
      if (!this.straightAt || world.tick - this.straightAt < 60 || world.tick - row.followAt < 120) { row.badRun = 0; continue; }
      // A hidden, combat or phase gap cannot join two separate excursions.
      if (row.lastStraightTick !== world.tick - 1) row.badRun = 0;
      row.lastStraightTick = world.tick;
      row.straightTicks++;
      if (behind >= 2 && behind <= 5) { row.inBandStraightTicks++; row.badRun = 0; }
      else {
        row.badStraightTicks++; row.badRun++;
        if (row.badRun > row.maxBadRun) {
          row.maxBadRun = row.badRun;
          row.counterexample = { tick: world.tick, behind, distance, player: { x: player.transform.x, z: player.transform.z }, follower: { x: e.transform.x, z: e.transform.z }, playerSpeed: speed };
        }
      }
    }
  }

  snapshot() {
    return [...this.followers.values()].map(row => ({ ...row,
      within8Share: row.calmTicks ? row.within8Ticks / row.calmTicks : null,
      inBandStraightShare: row.straightTicks ? row.inBandStraightTicks / row.straightTicks : null }));
  }
}
