// Splash falloff/impulse adapted from Bruno Simon folio-2025 Explosions.js (MIT, 41046b5).
import type { Vec2 } from '../../input/InputFrame';
import type { EntitySnapshot, GameEvent } from '../world/types';
import type { SimWorld } from '../world/SimWorld';
export interface DamageEvent {
  attackId: number; actionId: string; sourceId: number; targetId: number; origin: Vec2; direction: Vec2;
  part?: 'leg'; radius?: number; spread?: number;
  base: number; multiplier: number; type: 'melee' | 'bullet' | 'explosive' | 'status' | 'vehicle'; knockback: number; stagger: number;
  /** Authored melee impact freeze (render-only); absent = 50 ms. */
  hitStopMs?: number; knockdown?: boolean;
  /** Authored crowd shove (fire-axe roundhouse): full knockback/stagger without a knockdown. */
  shove?: boolean;
}
/** Directional shields only stop front bullets; splash is radial and ignores shields. */
export function damageAmount(hit: DamageEvent, target: EntitySnapshot): number {
  let amount = hit.base * hit.multiplier;
  // E11 environmental blasts retain 30% player damage; E07 enemy bursts keep their authored damage.
  if (hit.type === 'explosive' && target.kind === 'player' && (target.id === hit.sourceId || !hit.actionId.startsWith('infected.'))) amount *= 0.3;
  if (hit.type === 'bullet' && target.combat?.shield) {
    const dx = hit.origin.x - target.transform.x, dz = hit.origin.z - target.transform.z, distance = Math.hypot(dx, dz);
    const dot = distance ? (dx * Math.cos(target.transform.yaw) - dz * Math.sin(target.transform.yaw)) / distance : 1;
    if (dot >= 0.5 - 1e-8) return 0;
  }
  if (target.infected?.special === 'armor' && hit.type !== 'explosive' && hit.type !== 'status') {
    const dx = hit.origin.x - target.transform.x, dz = hit.origin.z - target.transform.z, distance = Math.hypot(dx, dz);
    if (!distance || (dx * Math.cos(target.transform.yaw) - dz * Math.sin(target.transform.yaw)) / distance >= 0.5) amount *= 0.25;
  }
  if (hit.type !== 'status') amount *= 1 - (target.combat?.armor ?? 0);
  return Math.max(0, amount);
}
export class Damage {
  god = false;
  constructor(private readonly world: SimWorld) {}
  apply(hit: DamageEvent): number {
    const target = this.world.entities.get(hit.targetId), source = this.world.entities.get(hit.sourceId);
    if (!target || !source || target.health.current <= 0) return 0;
    if (hit.type !== 'explosive' && hit.type !== 'status' && target.faction === source.faction) return 0;
    if (target.civilian) { this.world.npcs?.civilians.hit(target, hit.type); if (hit.type === 'explosive' && hit.knockback > 0) this.world.npcs?.moveStep(target, hit.direction.x * hit.knockback, hit.direction.z * hit.knockback); return 0; }
    if (target.companion) { this.world.npcs?.companion.hit(target, hit.base * hit.multiplier); return 0; }
    if (target.escort?.state === 'downed' || target.escort?.state === 'dead') return 0;
    if (target.escort?.child) { target.health.current = Math.max(0, target.health.current - hit.base * hit.multiplier); if (!target.health.current) this.world.npcs?.escorts.down(target); return 0; }
    const wasAlive = target.health.current > 0;
    let amount = damageAmount(hit, target);
    if (amount > 0 && target.archetype === 'infected.crow' && this.world.infected) amount = this.world.infected.hitFlock(target, hit.origin, hit.direction, hit.radius ?? 30, hit.type === 'explosive' ? 360 : hit.spread ?? 0);
    if (target.id === 1 && this.world.combat?.effects.shielded(target.transform)) amount = 0;
    if (target.id === 1 && this.god) amount = 0;
    if (target.id === 1 && this.world.player) amount = this.world.player.damage(amount, this.world.tick);
    else { amount = Math.min(amount, target.health.current); target.health.current -= amount; }
    // Keep ordinary player melee in reach even after knockback upgrades. Special
    // kicks/ground slam retain their authored shove; raw damage is never a finisher.
    const special = hit.knockdown || hit.actionId === 'weapon.kick' || hit.actionId === 'ability.ground-slam';
    const normal = source.id === 1 && hit.type === 'melee' && !special && !hit.shove;
    const knockback = normal ? Math.min(.4, hit.knockback) : hit.knockback;
    const stagger = normal ? Math.min(.25, hit.stagger) : hit.stagger;
    const event = { tick: this.world.tick, attackId: hit.attackId, actionId: hit.actionId, sourceId: hit.sourceId, targetId: hit.targetId, position: { ...target.transform }, direction: { ...hit.direction }, knockback, amount, damageType: hit.type, ...(hit.type === 'vehicle' ? { cause: 'vehicle' as const } : {}) };
    this.world.events.emit({ ...event, type: 'combat.hit' });
    if (amount > 0) {
      if (target.combat && stagger > 0) { target.combat.staggerUntil = Math.max(target.combat.staggerUntil, this.world.tick + Math.ceil(stagger * 60)); target.combat.attacking = false; }
      const from = { x: target.transform.x, z: target.transform.z };
      if (knockback > 0 && target.faction !== 'environment') this.world.knockback(target, hit.direction, knockback);
      if (target.combat && target.faction === 'infected') {
        const heavy = target.health.current === 0 || !!special || (!normal && (hit.type === 'explosive' || hit.type === 'vehicle'));
        const downed = target.combat.reaction?.heavy && target.combat.reaction.until > this.world.tick;
        const previous = target.combat.reaction?.index ?? target.id % 3;
        if (downed && target.health.current === 0) target.combat.reaction!.groundDeath = true;
        else if (!downed || heavy) target.combat.reaction = { index: (previous + 1) % 6, started: this.world.tick, until: this.world.tick + (heavy ? 80 : Math.max(1, Math.ceil(stagger * 60))), direction: { ...hit.direction }, from, to: { x: target.transform.x, z: target.transform.z }, heavy };
        if (heavy) target.combat.staggerUntil = Math.max(target.combat.staggerUntil, this.world.tick + 80);
        // A kicked body sweeps its existing knockback corridor and staggers the next
        // infected it tumbles into. No new physics bodies or navigation rules.
        if (heavy && hit.type === 'melee' && knockback >= 1.2) {
          for (const other of this.world.entities.iterate()) {
            if (other.id === target.id || other.faction !== 'infected' || other.health.current <= 0 || !other.combat) continue;
            const dx = other.transform.x - from.x, dz = other.transform.z - from.z;
            const along = dx * hit.direction.x + dz * hit.direction.z, cross = Math.abs(dx * hit.direction.z - dz * hit.direction.x);
            if (along <= 0 || along > knockback + .6 || cross > target.combat.radius + other.combat.radius) continue;
            const otherFrom = { x: other.transform.x, z: other.transform.z };
            this.world.knockback(other, hit.direction, .5);
            other.combat.staggerUntil = Math.max(other.combat.staggerUntil, this.world.tick + 54); other.combat.attacking = false;
            other.combat.reaction = { index: ((other.combat.reaction?.index ?? 0) + 1) % 6, started: this.world.tick, until: this.world.tick + 54, direction: { ...hit.direction }, from: otherFrom, to: { x: other.transform.x, z: other.transform.z }, heavy: true };
          }
        }
      }
      if (hit.type === 'melee') this.world.events.emit({ type: 'combat.hit-stop', tick: this.world.tick, sourceId: hit.sourceId, durationMs: hit.hitStopMs ?? 50 });
    }
    if (hit.part === 'leg' && amount > 0) this.world.infected?.loseLeg(target.id, this.world.infected.gore);
    if (target.escort && target.health.current === 0) { this.world.npcs?.escorts.down(target); return amount; }
    if (wasAlive && target.health.current === 0) this.world.events.emit({ ...event, type: 'combat.kill' } satisfies GameEvent);
    return amount;
  }
}
