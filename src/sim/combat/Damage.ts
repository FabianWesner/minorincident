import { megaAlpha } from '../../data/megaAlpha';
import { alphaDamageMultiplier, humanInfected } from '../../data/infected';
import { storyProtected } from '../npc/storyProtection';
// Splash falloff/impulse adapted from Bruno Simon folio-2025 Explosions.js (MIT, 41046b5).
import type { Vec2 } from '../../input/InputFrame';
import type { EntitySnapshot, GameEvent } from '../world/types';
import type { SimWorld } from '../world/SimWorld';
export interface DamageEvent {
  attackId: number; actionId: string; sourceId: number; targetId: number; origin: Vec2; direction: Vec2;
  direct?: boolean;
  part?: 'leg'; radius?: number; spread?: number;
  base: number; multiplier: number; type: 'melee' | 'bullet' | 'explosive' | 'status' | 'vehicle' | 'prop' | 'projectile'; knockback: number; stagger: number;
  /** Authored melee impact freeze (render-only); absent = 50 ms. */
  hitStopMs?: number; knockdown?: boolean;
  /** Physical enemy moves use the shared hurt state without civilian infection/grab. */
  knockdownTicks?: number;
  /** Crowd sweep (roundhouse): keeps its authored shove/stagger beyond the normal-hit caps, without a knockdown. */
  sweep?: boolean;
  /** A lethal hit kills an infected for good (a burning DoT); explosive hits always do (PO "Infected recover"). */
  permanent?: boolean;
}
/** A knocked-down infected that will get up again (PO "Infected recover"): 0 HP, yet not a corpse. */
export function downed(e: EntitySnapshot): boolean { return e.health.current <= 0 && (e.infected?.recoverAt ?? -1) >= 0; }
const lethal = (hit: DamageEvent) => hit.type === 'explosive' || !!hit.permanent;
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
  if (target.infected?.pursuit) {
    if (hit.actionId === 'weapon.rocket-launcher' && hit.type === 'explosive') return target.health.max * (hit.direct ? megaAlpha.directRocketFraction : megaAlpha.splashRocketFraction);
    return Math.min(Math.max(0, amount), Math.max(0, target.health.current - target.health.max * megaAlpha.conventionalFloor));
  }
  if (target.archetype === 'infected.alpha') return Math.max(0, amount * alphaDamageMultiplier(hit.actionId, hit.type));
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
  /** Per-level toughness (L2): a melee hit does at most maxHP / hits, so the weapon needs `hits` hits to down a normal infected. */
  private meleeCap(hit: DamageEvent, target: EntitySnapshot): number | undefined {
    const hits = this.world.infectedMeleeHits;
    if (!hits || hit.type !== 'melee' || target.faction !== 'infected' || target.archetype === 'infected.crow') return undefined;
    const count = hits[hit.actionId];
    return count ? target.health.max / count : undefined;
  }
  apply(hit: DamageEvent): number {
    const target = this.world.entities.get(hit.targetId), source = this.world.entities.get(hit.sourceId);
    if (!target || !source) return 0;
    // E31 hull attacks own infected melee against the APC; seated people are inside its armor.
    const transportId = target.id === 1 ? this.world.vehicles?.active : target.passengerOf;
    if (target.hidden && transportId != null && source.kind === 'infected' && hit.type === 'melee' && this.world.entities.get(transportId)?.archetype === 'vehicle.military-apc') return 0;
    // Newer campaign PO: shotgun HP depletion kills ordinary human infected permanently.
    if (hit.actionId === 'weapon.shotgun' && /^L[5-9]$/.test(this.world.scenario ?? '') && target.archetype !== 'infected.alpha' && humanInfected.some(d => d.id === target.archetype)) hit = { ...hit, permanent: true };
    if (storyProtected(this.world, target)) {
      if (hit.knockback > 0) this.world.knockback(target, hit.direction, hit.knockback);
      return 0;
    }
    if (target.id === 1 && (hit.type === 'bullet' || hit.type === 'projectile') && !this.world.combat!.query.visible(hit.origin, target.transform)) return 0;
    if (target.health.current <= 0) {
      // Explosives and fire finish a downed infected for good; any other damaging hit restarts its down time (PO 10-08).
      if (downed(target) && damageAmount(hit, target) > 0) {
        if (!lethal(hit)) { this.world.infected!.down(target, false); return 0; }
        this.world.infected!.down(target, true);
        this.world.events.emit({ type: 'combat.kill', tick: this.world.tick, attackId: hit.attackId, actionId: hit.actionId, sourceId: hit.sourceId, targetId: hit.targetId, position: { ...target.transform }, direction: { ...hit.direction }, knockback: hit.knockback, amount: 0, damageType: hit.type });
      }
      return 0;
    }
    if (hit.type !== 'explosive' && hit.type !== 'status' && target.faction === source.faction) return 0;
    const alphaSoldierHit = source.archetype === 'infected.alpha' && target.civilian?.ally?.role === 'soldier';
    if (target.civilian && !alphaSoldierHit && !hit.knockdownTicks && !(hit.stagger > 0 && hit.actionId.startsWith('infected.'))) { this.world.npcs?.civilians.hit(target, hit.type); if (hit.type === 'explosive' && hit.knockback > 0) this.world.npcs?.moveStep(target, hit.direction.x * hit.knockback, hit.direction.z * hit.knockback); return 0; }
    if (target.companion) { this.world.npcs?.companion.hit(target, hit.base * hit.multiplier); return 0; }
    if (target.escort?.state === 'downed' || target.escort?.state === 'dead') return 0;
    if (target.escort?.child) { target.health.current = Math.max(0, target.health.current - hit.base * hit.multiplier); if (!target.health.current) this.world.npcs?.escorts.down(target); return 0; }
    const mega = target.infected?.pursuit;
    if (mega && hit.actionId === 'weapon.rocket-launcher' && hit.type === 'explosive') {
      const ids = target.infected!.megaRocketIds ??= [];
      if (ids.includes(hit.attackId)) return 0;
      ids.push(hit.attackId); if (ids.length > 64) ids.shift();
    }
    let megaReact = false;
    if (mega && hit.base * hit.multiplier > 0 && (hit.stagger > 0 || hit.knockback > 0 || hit.knockdown || hit.knockdownTicks) && this.world.tick >= (target.infected!.megaStaggerReady ?? 0)) {
      megaReact = true; target.infected!.megaStaggerReady = this.world.tick + megaAlpha.staggerCooldownTicks;
      const recovery = target.infected!.specialRecoveryUntil ?? 0;
      this.world.infected?.cancelSpecial(target.id);
      // An interrupt must not turn a 0.5 s stagger into the completed move's 1.2 s immobilization.
      target.infected!.specialRecoveryUntil = Math.max(recovery, this.world.tick + megaAlpha.staggerTicks);
      target.combat!.staggerUntil = this.world.tick + Math.min(megaAlpha.staggerTicks, Math.max(1, Math.ceil(hit.stagger * 60)));
    }
    if (mega) hit = { ...hit, knockback: megaReact ? Math.min(.4, hit.knockback) : 0, stagger: 0, knockdown: false, knockdownTicks: 0, part: undefined };
    const wasAlive = target.health.current > 0;
    let amount = damageAmount(hit, target);
    if (target.combat?.allyResist !== undefined && hit.sourceId !== 1) amount *= target.combat.allyResist;
    const cap = this.meleeCap(hit, target); if (cap !== undefined) amount = Math.min(amount, cap);
    if (amount > 0 && target.archetype === 'infected.crow' && this.world.infected) amount = this.world.infected.hitFlock(target, hit.origin, hit.direction, hit.radius ?? 30, hit.type === 'explosive' ? 360 : hit.spread ?? 0);
    if (target.id === 1 && this.world.combat?.effects.shielded(target.transform)) amount = 0;
    if (target.id === 1 && (this.god || this.world.inspectionGhost)) amount = 0;
    if (target.id === 1 && this.world.player) amount = this.world.player.damage(amount, this.world.tick, hit.actionId === 'infected.zebra.stampede');
    else { amount = Math.min(amount, target.health.current); target.health.current -= amount; }
    // Keep ordinary player melee in reach even after knockback upgrades. Special
    // kicks/ground slam retain their authored shove; raw damage is never a finisher.
    const special = hit.knockdown || hit.actionId === 'weapon.kick' || hit.actionId === 'ability.ground-slam';
    const normal = source.id === 1 && hit.type === 'melee' && !special && !hit.sweep;
    const knockback = normal ? Math.min(.4, hit.knockback) : hit.knockback;
    const stagger = megaReact ? (target.combat!.staggerUntil - this.world.tick) / 60 : normal ? Math.min(.25, hit.stagger) : hit.stagger;
    const event = { tick: this.world.tick, attackId: hit.attackId, actionId: hit.actionId, sourceId: hit.sourceId, targetId: hit.targetId, position: { ...target.transform }, direction: { ...hit.direction }, knockback, amount, damageType: hit.type, ...((hit.type === 'vehicle' || hit.type === 'prop') ? { cause: hit.type } : {}) };
    this.world.events.emit({ ...event, type: 'combat.hit' });
    if (amount > 0 || megaReact) {
      if (hit.knockdownTicks && target.survivor) target.survivor.knockdown = { started: this.world.tick, until: Math.max(target.survivor.knockdown?.until ?? 0, this.world.tick + hit.knockdownTicks) };
      if (hit.knockdownTicks && target.combat) target.combat.staggerUntil = Math.max(target.combat.staggerUntil, this.world.tick + hit.knockdownTicks);
      if (hit.knockdownTicks && target.escort) target.escort.knockedUntil = Math.max(target.escort.knockedUntil ?? 0, this.world.tick + hit.knockdownTicks);
      if ((alphaSoldierHit || hit.knockdownTicks) && target.civilian) {
        const until = this.world.tick + (hit.knockdownTicks ?? 72), c = target.civilian!;
        c.knockedUntil = Math.max(c.knockedUntil, until); c.entered = this.world.tick; c.story = null;
        if (c.ally) c.ally.strikeAt = 0;
        if (target.health.current === 0) c.state = 'finished';
        if (target.combat) target.combat.staggerUntil = Math.max(target.combat.staggerUntil, until);
      }
      if (target.civilian && target.health.current === 0) { target.civilian.state = 'finished'; target.civilian.entered = this.world.tick; target.civilian.story = null; }
      if (target.combat && stagger > 0) { target.combat.staggerUntil = Math.max(target.combat.staggerUntil, this.world.tick + Math.ceil(stagger * 60)); target.combat.attacking = false; }
      const from = { x: target.transform.x, z: target.transform.z };
      if (knockback > 0 && target.faction !== 'environment') this.world.knockback(target, hit.direction, knockback);
      if (target.combat && target.faction === 'infected' && (!mega || megaReact || target.health.current === 0)) {
        const heavy = target.health.current === 0 || !mega && ( (!!special && target.archetype !== 'infected.alpha') || (!normal && (hit.type === 'explosive' || hit.type === 'vehicle')));
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
            if (other.infected?.pursuit) {
              // Crowd impacts obey the same boss stagger cap as the original kick.
              this.apply({ ...hit, sourceId: target.id, targetId: other.id, origin: from, base: 1, multiplier: 1, type: 'status', knockback: .4, stagger: .5, knockdown: false, knockdownTicks: 0 });
              continue;
            }
            const otherFrom = { x: other.transform.x, z: other.transform.z };
            this.world.knockback(other, hit.direction, .5);
            other.combat.staggerUntil = Math.max(other.combat.staggerUntil, this.world.tick + 54); other.combat.attacking = false;
            other.combat.reaction = { index: ((other.combat.reaction?.index ?? 0) + 1) % 6, started: this.world.tick, until: this.world.tick + 54, direction: { ...hit.direction }, from: otherFrom, to: { x: other.transform.x, z: other.transform.z }, heavy: true };
          }
        }
      }
      // The impact freeze is the courier's feedback: allied fighters' (E20) strikes do not freeze the screen.
      if (hit.type === 'melee' && !source.civilian) this.world.events.emit({ type: 'combat.hit-stop', tick: this.world.tick, sourceId: hit.sourceId, durationMs: hit.hitStopMs ?? 50 });
    }
    if (hit.part === 'leg' && amount > 0) this.world.infected?.loseLeg(target.id, this.world.infected.gore);
    if (target.escort && target.health.current === 0) { this.world.npcs?.escorts.down(target); return amount; }
    if (wasAlive && target.health.current === 0) {
      // PO "Infected recover": only explosives (and a lethal burn) kill an infected; everything else knocks it down.
      const up = target.infected && this.world.infected ? this.world.infected.down(target, lethal(hit)) : -1;
      this.world.events.emit({ ...event, type: 'combat.kill', ...(up >= 0 ? { downed: up } : {}) } satisfies GameEvent);
    }
    return amount;
  }
}
