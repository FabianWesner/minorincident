import { infectedDef } from '../../data/infected';
import { npcs } from '../../data/npcs';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
const approaching = new Set(['chase', 'attack', 'alerted', 'migration']);
/** Immune hero: courage replaces HP, path seeking is shared with E07, with no player collider. */
export class Companion {
  private readonly target = { x: 0, z: 0 };
  constructor(readonly world: SimWorld) {
    world.events.on('combat.effect', event => {
      if (event.type !== 'combat.effect' || event.actionId !== 'ability.corgi-lure') return;
      for (const e of world.entities.iterate()) if (e.companion && e.companion.state !== 'hide') {
        world.combat?.effects.noise(e.transform, event.radius, event.actionId, e.id);
        for (const enemy of world.infected!.active) if (enemy.health.current > 0 && Math.hypot(enemy.transform.x - e.transform.x, enemy.transform.z - e.transform.z) <= event.radius) enemy.noiseTarget = { id: e.id, until: event.expires };
      }
    });
  }
  spawn(): number {
    for (const e of this.world.entities.iterate()) if (e.companion) return e.id;
    const p = this.world.entities.get(1)!.transform, nav = this.world.infected!.nav;
    this.target.x = p.x; this.target.z = p.z + 2;
    if (!nav.clear(this.target.x, this.target.z, .35)) { this.target.x = p.x; this.target.z = p.z; }
    const e = this.world.entities.create({ kind: 'companion', archetype: 'char.corgi', faction: 'survivor', transform: { ...this.target, y: .3, yaw: 0 }, health: { current: 100, max: 100 }, companion: { state: 'follow', courage: 100, until: 0, barkAt: 0, hurtAt: 0, pickup: null, path: [], goal: -1, pathIndex: 0 } });
    this.world.spatial.set(e.id, e.transform.x, e.transform.z); return e.id;
  }
  hit(e: EntitySnapshot, amount: number): void {
    const c = e.companion!; c.courage = Math.max(0, c.courage - amount);
    if (!c.courage && c.state !== 'hide') { c.state = 'hide'; c.until = this.world.tick + npcs.corgiRecoveryTicks; c.pickup = null; }
  }
  update(): void {
    const player = this.world.entities.get(1)!, ai = this.world.infected!;
    for (const e of this.world.entities.iterate()) {
      const c = e.companion; if (!c) continue;
      if (c.state !== 'hide' && this.world.tick >= c.hurtAt) for (const enemy of ai.active) if (enemy.health.current > 0 && Math.hypot(enemy.transform.x - e.transform.x, enemy.transform.z - e.transform.z) < 1.2) { c.hurtAt = this.world.tick + 60; this.hit(e, infectedDef(enemy.archetype).damage); this.world.events.emit({ type: 'corgi.sound', tick: this.world.tick, sourceId: e.id, position: { ...e.transform }, kind: 'hurt' }); break; }
      if (c.state === 'hide') {
        // Hiding follows at the player's heels without collision; recovery uses sim time.
        this.world.npcs!.move(e, player.transform, 9, c, 1.5);
        if (this.world.tick >= c.until) { c.courage = 100; c.state = 'follow'; }
        continue;
      }
      let pickup = c.pickup === null ? undefined : this.world.entities.get(c.pickup);
      if (pickup?.pickup && 'kind' in pickup.pickup && pickup.pickup.collected) pickup = undefined;
      if (!pickup && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) < 4) {
        for (const candidate of this.world.entities.iterate()) if (candidate.pickup && !('kind' in candidate.pickup && candidate.pickup.collected) && !('armed' in candidate.pickup && !candidate.pickup.armed) && Math.hypot(candidate.transform.x - player.transform.x, candidate.transform.z - player.transform.z) > 1 && Math.hypot(candidate.transform.x - player.transform.x, candidate.transform.z - player.transform.z) <= 6 && ai.nav.visible(e.transform, candidate.transform, .35)) { pickup = candidate; break; }
        c.pickup = pickup?.id ?? null;
      }
      c.state = pickup ? 'fetch' : 'follow';
      if (pickup) {
        this.world.npcs!.move(e, pickup.transform, 9, c, .15);
        if (Math.hypot(e.transform.x - pickup.transform.x, e.transform.z - pickup.transform.z) < .4) {
          Object.assign(pickup.transform, { x: player.transform.x, z: player.transform.z }); this.world.spatial.set(pickup.id, pickup.transform.x, pickup.transform.z);
          this.world.events.emit({ type: 'corgi.fetched', tick: this.world.tick, id: e.id, pickupId: pickup.id }); c.pickup = null; c.state = 'follow';
        }
      } else {
        // Trail/side target avoids running ahead of the player. No physics body means no obstruction.
        const vx = player.survivor?.velocity.x ?? 0, vz = player.survivor?.velocity.z ?? 0, length = Math.hypot(vx, vz);
        this.target.x = player.transform.x - (length > .1 ? vx / length * 2 : 0);
        this.target.z = player.transform.z - (length > .1 ? vz / length * 2 : -2);
        const target = ai.nav.clear(this.target.x, this.target.z, .35) ? this.target : player.transform;
        this.world.npcs!.move(e, target, 9, c, .4);
        // Crowd separation uses fixed buffers in the existing store, never touches the player.
        for (const enemy of ai.active) if (enemy.health.current > 0) {
          const dx = e.transform.x - enemy.transform.x, dz = e.transform.z - enemy.transform.z, d = Math.hypot(dx, dz);
          if (d > 0 && d < .8) ai.nav.move(e.transform, dx / d * .03, dz / d * .03, .35);
        }
      }
      if (this.world.tick >= c.barkAt) for (const enemy of ai.active) {
        const dx = enemy.transform.x - player.transform.x, dz = enemy.transform.z - player.transform.z, distance = Math.hypot(dx, dz);
        if (enemy.health.current <= 0 || distance > 18 || ai.director.visible(enemy.transform) || !approaching.has(enemy.infected!.state)) continue;
        c.barkAt = this.world.tick + 180;
        this.world.events.emit({ type: 'corgi.bark', tick: this.world.tick, id: e.id, threatId: enemy.id, direction: { x: dx / (distance || 1), z: dz / (distance || 1) } }); break;
      }
      this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
  }
}
