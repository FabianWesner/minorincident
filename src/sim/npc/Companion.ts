import { infectedDef } from '../../data/infected';
import { l1v2 } from '../../data/l1v2';
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
  /** L1 v2 (D-GROVE): the corgi cannot be hurt, has no courage bar, and warns instead of fighting (spec 5.8). */
  /** Tests and scenarios without a D-GROVE district can force the L1 v2 behaviour. */
  forceSafe: boolean | null = null;
  get safe(): boolean { return this.forceSafe ?? this.world.districts?.districts.some(d => d.id === 'D-GROVE') === true; }
  hit(e: EntitySnapshot, amount: number): void {
    if (this.safe) return;
    const c = e.companion!; c.courage = Math.max(0, c.courage - amount);
    if (!c.courage && c.state !== 'hide') { c.state = 'hide'; c.until = this.world.tick + npcs.corgiRecoveryTicks; c.pickup = null; }
  }
  update(): void {
    const player = this.world.entities.get(1)!, ai = this.world.infected!;
    for (const e of this.world.entities.iterate()) {
      const c = e.companion; if (!c) continue;
      if (!this.safe && c.state !== 'hide' && this.world.tick >= c.hurtAt) for (const enemy of ai.active) if (enemy.health.current > 0 && Math.hypot(enemy.transform.x - e.transform.x, enemy.transform.z - e.transform.z) < 1.2) { c.hurtAt = this.world.tick + 60; this.hit(e, infectedDef(enemy.archetype).damage); this.world.events.emit({ type: 'corgi.sound', tick: this.world.tick, sourceId: e.id, position: { ...e.transform }, kind: 'hurt' }); break; }
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
        // Follow the survivor's position with a distance band. Never flip a
        // trailing offset to a world-axis offset when velocity falls to zero.
        const distance = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z);
        if (distance > 3.2 || !ai.nav.visible(e.transform, player.transform, .35)) c.following = true;
        if (distance < 2.05 && ai.nav.visible(e.transform, player.transform, .35)) c.following = false;
        const riding = this.world.vehicles?.bicycle.riding === true, frozen = this.safe && this.warn(e, c, player.transform) && distance < 6;
        if (frozen) { if (c.velocity) c.velocity.x = c.velocity.z = 0; }
        // While the player rides, the corgi's speed cap rises to the bicycle speed and it runs alongside (spec 5.10).
        else if (c.following) this.world.npcs!.move(e, player.transform, riding ? Math.min(l1v2.corgi.riderSpeedCapMs, Math.hypot(player.motion?.velocity.x ?? 0, player.motion?.velocity.z ?? 0, 4.5) + Math.max(0, distance - 3) * 2) : Math.min(8, 4.5 + Math.max(0, distance - 4) * 2), c, riding ? 1.5 : 2);
        else if (c.velocity) c.velocity.x = c.velocity.z = 0;
      }
      if (!this.safe && this.world.tick >= c.barkAt) for (const enemy of ai.active) {
        const dx = enemy.transform.x - player.transform.x, dz = enemy.transform.z - player.transform.z, distance = Math.hypot(dx, dz);
        if (enemy.health.current <= 0 || distance > 18 || ai.director.visible(enemy.transform) || !approaching.has(enemy.infected!.state)) continue;
        c.barkAt = this.world.tick + 180;
        this.world.events.emit({ type: 'corgi.bark', tick: this.world.tick, id: e.id, threatId: enemy.id, direction: { x: dx / (distance || 1), z: dz / (distance || 1) } }); break;
      }
      this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    }
  }
  /**
   * Warning ladder against the nearest live infected that is off screen (or behind cover): stop + stiffen + look within 20 m,
   * growl within 14 m, bark within 9 m (1 per 2 s), then 6 s of nervous idle. Returns true while the corgi must hold still.
   */
  private warn(e: EntitySnapshot, c: NonNullable<EntitySnapshot['companion']>, player: { x: number; z: number }): boolean {
    const tuning = l1v2.corgi, ai = this.world.infected!, w = c.warn ??= { stage: 'none', threat: -1, nervousUntil: 0 };
    let threat: EntitySnapshot | null = null, best: number = tuning.stiffenM;
    for (const enemy of ai.active) {
      if (enemy.health.current <= 0 || enemy.infected?.hidden || ai.director.visible(enemy.transform)) continue;
      const d = Math.hypot(enemy.transform.x - player.x, enemy.transform.z - player.z);
      if (d <= best) { best = d; threat = enemy; }
    }
    if (!threat) {
      if (w.stage !== 'none' && w.stage !== 'nervous') { w.stage = 'nervous'; w.nervousUntil = this.world.tick + tuning.nervousS * 60; this.emitWarn(e, w.threat, 'nervous', best, { x: 0, z: 0 }); }
      else if (w.stage === 'nervous' && this.world.tick >= w.nervousUntil) w.stage = 'none';
      return false;
    }
    const dx = threat.transform.x - e.transform.x, dz = threat.transform.z - e.transform.z, length = Math.hypot(dx, dz) || 1;
    e.transform.yaw = -Math.atan2(dz, dx); // look toward it
    const stage = best <= tuning.barkM ? 'bark' : best <= tuning.growlM ? 'growl' : 'stiffen', order = ['none', 'nervous', 'stiffen', 'growl', 'bark'];
    w.threat = threat.id;
    if (order.indexOf(stage) > order.indexOf(w.stage) || w.stage === 'nervous') { w.stage = stage; if (stage !== 'bark') this.emitWarn(e, threat.id, stage, best, { x: dx / length, z: dz / length }); }
    if (stage === 'bark' && this.world.tick >= c.barkAt) {
      c.barkAt = this.world.tick + tuning.barkIntervalS * 60;
      this.emitWarn(e, threat.id, 'bark', best, { x: dx / length, z: dz / length });
      this.world.events.emit({ type: 'corgi.sound', tick: this.world.tick, sourceId: e.id, position: { ...e.transform }, kind: 'warning' });
    }
    return true;
  }
  private emitWarn(e: EntitySnapshot, threatId: number, stage: 'stiffen' | 'growl' | 'bark' | 'nervous', distance: number, direction: { x: number; z: number }): void {
    this.world.events.emit({ type: 'corgi.warn', tick: this.world.tick, id: e.id, stage, threatId, direction: { x: direction.x, z: direction.z }, distance });
  }
}
