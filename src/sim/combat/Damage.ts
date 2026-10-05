// Splash falloff/impulse adapted from Bruno Simon folio-2025 Explosions.js (MIT, 41046b5).
import type { Vec2 } from '../../input/InputFrame';
import type { EntitySnapshot, GameEvent } from '../world/types';
import type { SimWorld } from '../world/SimWorld';
export interface DamageEvent {
  attackId: number; actionId: string; sourceId: number; targetId: number; origin: Vec2; direction: Vec2;
  base: number; multiplier: number; type: 'melee' | 'bullet' | 'explosive' | 'status' | 'vehicle'; knockback: number; stagger: number;
}
/** Directional shields only stop front bullets; splash is radial and ignores shields. */
export function damageAmount(hit: DamageEvent, target: EntitySnapshot): number {
  let amount = hit.base * hit.multiplier;
  if (hit.type === 'explosive' && target.id === hit.sourceId && target.kind === 'player') amount *= 0.3;
  if (hit.type === 'bullet' && target.combat?.shield) {
    const dx = hit.origin.x - target.transform.x, dz = hit.origin.z - target.transform.z, distance = Math.hypot(dx, dz);
    const dot = distance ? (dx * Math.cos(target.transform.yaw) - dz * Math.sin(target.transform.yaw)) / distance : 1;
    if (dot >= 0.5 - 1e-8) return 0;
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
    const wasAlive = target.health.current > 0;
    let amount = damageAmount(hit, target);
    if (target.id === 1 && this.world.combat?.effects.shielded(target.transform)) amount = 0;
    if (target.id === 1 && this.god) amount = 0;
    if (target.id === 1 && this.world.player) amount = this.world.player.damage(amount, this.world.tick);
    else { amount = Math.min(amount, target.health.current); target.health.current -= amount; }
    const event = { tick: this.world.tick, attackId: hit.attackId, actionId: hit.actionId, sourceId: hit.sourceId, targetId: hit.targetId, position: { ...target.transform }, amount, ...(hit.type === 'vehicle' ? { cause: 'vehicle' as const } : {}) };
    this.world.events.emit({ ...event, type: 'combat.hit' });
    if (amount > 0) {
      if (target.combat && hit.stagger > 0) { target.combat.staggerUntil = this.world.tick + Math.ceil(hit.stagger * 60); target.combat.attacking = false; }
      if (hit.knockback > 0) this.world.knockback(target, hit.direction, hit.knockback);
      if (hit.type === 'melee') this.world.events.emit({ type: 'combat.hit-stop', tick: this.world.tick, sourceId: hit.sourceId, durationMs: 50 });
    }
    if (wasAlive && target.health.current === 0) this.world.events.emit({ ...event, type: 'combat.kill' } satisfies GameEvent);
    return amount;
  }
}
