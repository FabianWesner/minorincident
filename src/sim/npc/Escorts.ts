// Proximity + leave-to-rearm interaction adapted from Bruno InteractivePoints.js (MIT).
import { npcs } from '../../data/npcs';
import { infectedDef } from '../../data/infected';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { Point } from './types';
/** Hero followers share E07 pathing. Only these entities use the 20s downed/revive lifecycle. */
export class Escorts {
  private readonly target = { x: 0, z: 0 };
  constructor(readonly world: SimWorld) {}
  spawn(position: Point, child = false): number {
    const e = this.world.entities.create({ kind: 'escort', archetype: child ? 'npc.brother' : 'npc.escort', faction: 'escort', health: { current: 100, max: 100 }, transform: { ...position, y: .7, yaw: 0 } });
    this.attach(e, child); this.world.spatial.set(e.id, position.x, position.z); return e.id;
  }
  /** Campaign scripts can attach to their existing actor IDs without respawning them. */
  attach(e: EntitySnapshot, child = e.archetype === 'npc.brother' || e.archetype === 'escort.brother'): void {
    e.escort = { state: 'follow', order: 'follow', child, gore: false, failed: false, downedAt: 0, progress: 0, latched: false, path: [], pathIndex: 0, goal: -1, cover: null, attackAt: 0 };
  }
  down(e: EntitySnapshot): void {
    const c = e.escort!; if (c.state === 'downed' || c.state === 'dead') return;
    c.state = 'downed'; c.downedAt = this.world.tick; c.progress = 0; c.cover = null;
    this.world.events.emit({ type: 'escort.downed', tick: this.world.tick, id: e.id });
  }
  update(): void {
    const player = this.world.entities.get(1)!, tick = this.world.tick, ai = this.world.infected!;
    const stopped = Math.hypot(player.survivor?.velocity.x ?? 0, player.survivor?.velocity.z ?? 0) < .1;
    for (const e of this.world.entities.iterate()) {
      const c = e.escort; if (!c || c.state === 'dead') continue;
      if (e.health.current <= 0) this.down(e);
      const distance = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z);
      const near = distance <= 1.5 && stopped && player.health.current > 0 && ai.nav.visible(e.transform, player.transform, .1);
      if (c.state === 'downed') {
        if (c.failed) continue;
        c.progress = near ? c.progress + 1 : 0;
        if (c.progress >= npcs.reviveTicks) { e.health.current = e.health.max / 2; c.state = c.order; c.progress = 0; c.latched = true; this.world.events.emit({ type: 'escort.revived', tick, id: e.id }); }
        else if (tick - c.downedAt >= npcs.downedTicks) {
          c.failed = true; if (!c.child) c.state = 'dead'; this.world.events.emit({ type: 'mission.failed', tick, reason: 'escort-died' });
        }
        continue;
      }
      if (!near) { c.progress = 0; c.latched = false; }
      else if (!c.latched) {
        if (++c.progress >= npcs.reviveTicks) { c.order = c.order === 'follow' ? 'wait' : 'follow'; c.state = c.order; c.latched = true; c.progress = 0; this.world.events.emit({ type: 'escort.order', tick, id: e.id, order: c.order }); }
      }
      let threat: EntitySnapshot | undefined;
      for (const enemy of ai.active) if (enemy.health.current > 0 && Math.hypot(enemy.transform.x - e.transform.x, enemy.transform.z - e.transform.z) < 8) { threat = enemy; break; }
      if (threat) {
        // Cover is the nearest collision-safe point on a wall's far side, reachable by the shared grid.
        if (!c.cover) {
          let best = Infinity;
          for (const wall of ai.nav.walls) {
            const dx = wall.x - threat.transform.x, dz = wall.z - threat.transform.z, d = Math.hypot(dx, dz) || 1;
            this.target.x = wall.x + dx / d * (wall.halfX + .9); this.target.z = wall.z + dz / d * (wall.halfZ + .9);
            const distance = Math.hypot(this.target.x - e.transform.x, this.target.z - e.transform.z);
            if (distance < best && ai.nav.clear(this.target.x, this.target.z, .65) && !ai.nav.visible(threat.transform, this.target, .1)) { best = distance; c.cover = { ...this.target }; }
          }
        }
        c.state = 'cover';
        if (c.cover) this.world.npcs!.move(e, c.cover, 5, c, .2);
        else { const dx = e.transform.x - threat.transform.x, dz = e.transform.z - threat.transform.z, d = Math.hypot(dx, dz) || 1; this.world.npcs!.moveStep(e, dx / d * .06, dz / d * .06); }
        // Children are knocked down, never infected/bitten or recorded as infected attack targets.
        if (Math.hypot(threat.transform.x - e.transform.x, threat.transform.z - e.transform.z) < 1.3 && tick >= c.attackAt && ai.nav.visible(threat.transform, e.transform, .1)) {
          c.attackAt = tick + 60; e.health.current = Math.max(0, e.health.current - infectedDef(threat.archetype).damage);
          if (!c.child) this.world.events.emit({ type: 'infected.attack', tick, sourceId: threat.id, targetId: e.id, attackId: 0, special: 'escort-hit', amount: infectedDef(threat.archetype).damage });
          if (e.health.current <= 0) this.down(e);
        }
      } else {
        c.cover = null; c.state = c.order;
        if (c.order === 'follow' && (!stopped || distance > 5)) this.world.npcs!.move(e, player.transform, 5.5, c, 2.5);
      }
      this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
  }
}
