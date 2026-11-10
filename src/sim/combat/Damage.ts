import { megaAlpha } from '../../data/megaAlpha';
import { insideCureHangar } from '../../data/l10Story';
import { alphaDamageMultiplier, riotShieldResponse } from '../../data/infected';
import { cureCanKill, storyProtected } from '../npc/storyProtection';
import { Status } from './Status';
import { l1v2 } from '../../data/l1v2';
import { combatHeightReachable } from './height';
// Splash falloff/impulse adapted from Bruno Simon folio-2025 Explosions.js (MIT, 41046b5).
import type { Vec2 } from '../../input/InputFrame';
import type { EntitySnapshot, GameEvent } from '../world/types';
import type { SimWorld } from '../world/SimWorld';
export interface DamageEvent {
  attackId: number; actionId: string; sourceId: number; targetId: number; origin: Vec2; direction: Vec2;
  /** Launch point retained by swept bullets; origin may be the last flight segment. */
  shotOrigin?: Vec2;
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
export function damageAmount(hit: DamageEvent, target: EntitySnapshot, shieldOpen = false, shieldFaceDot = 0.5, megaVulnerable = false): number {
  let amount = hit.base * hit.multiplier;
  // E11 environmental blasts retain 30% player damage; E07 enemy bursts keep their authored damage.
  if (hit.type === 'explosive' && target.kind === 'player' && (target.id === hit.sourceId || !hit.actionId.startsWith('infected.'))) amount *= 0.3;
  if (hit.type === 'bullet' && target.combat?.shield && !shieldOpen) {
    const dx = hit.origin.x - target.transform.x, dz = hit.origin.z - target.transform.z, distance = Math.hypot(dx, dz);
    const dot = distance ? (dx * Math.cos(target.transform.yaw) - dz * Math.sin(target.transform.yaw)) / distance : 1;
    if (dot >= shieldFaceDot - 1e-8) return 0;
  }
  if (target.infected?.pursuit) {
    if (hit.actionId === 'weapon.rocket-launcher' && hit.type === 'explosive') return target.health.max * (hit.direct ? megaAlpha.directRocketFraction : megaAlpha.splashRocketFraction);
    if (megaVulnerable) return Math.max(0, amount);
    return Math.min(Math.max(0, amount), Math.max(0, target.health.current - target.health.max * megaAlpha.conventionalFloor));
  }
  if (target.archetype === 'infected.alpha') {
    let multiplier = alphaDamageMultiplier(hit.actionId, hit.type);
    if (target.infected?.alphaType === 'armoured' && hit.type === 'bullet') {
      const dx = hit.origin.x - target.transform.x, dz = hit.origin.z - target.transform.z, distance = Math.hypot(dx, dz);
      const front = distance ? (dx * Math.cos(target.transform.yaw) - dz * Math.sin(target.transform.yaw)) / distance : 1;
      if (front >= .5) multiplier = .25;
    }
    if (target.infected?.specialAttack?.stage === 'recovery') multiplier *= 1.5;
    return Math.max(0, amount * multiplier);
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
  private amount(hit: DamageEvent, target: EntitySnapshot): number {
    // Shared riot counter: a flinch lowers the shield, and a muzzle inside its
    // forward edge can shoot past it at contact distance. Hit origins are body
    // centres: 0.8 m includes the raised gun's barrel and the shield offset.
    const origin = hit.shotOrigin ?? hit.origin;
    const glance = this.shieldGlance(hit, target);
    const open = !!target.combat?.shield &&
      (glance || Status.stunned(target, this.world.tick) || this.world.tick < (target.combat.shieldBrokenUntil ?? 0) || Math.hypot(origin.x - target.transform.x, origin.z - target.transform.z) <= target.combat.radius + .8);
    const faceDot = target.archetype === 'infected.riot' ? Math.cos(riotShieldResponse.faceHalfAngleDeg * Math.PI / 180) : 0.5;
    const directionalHit = target.combat?.shield && hit.shotOrigin ? { ...hit, origin } : hit;
    if (target.infected?.pursuit && this.world.scenario === 'L10' && !this.world.missions?.state.states['cure-installed']) return 0;
    let amount = damageAmount(directionalHit, target, open, faceDot, this.world.scenario === 'L10' && !!this.world.missions?.state.states['cure-installed']);
    if (this.world.scenario === 'L10' && target.infected?.pursuit && target.infected.megaPhase === 2 && !target.infected.megaArmourBroken && !hit.actionId.includes('flamethrower') && !hit.actionId.startsWith('environment.')) {
      const dx = origin.x - target.transform.x, dz = origin.z - target.transform.z, d = Math.hypot(dx, dz) || 1;
      const back = (dx * Math.cos(target.transform.yaw) - dz * Math.sin(target.transform.yaw)) / d < -.3;
      if (!(back && (target.infected.megaWeakTicks ?? 0) > 0)) amount *= .35;
    }
    const arena = target.infected?.arenaBoss;
    // r31-flamingo: allies (soldiers, group) only scratch the animals, so the courier owns the boss fight and the flock is not gone before its title shows.
    if (arena && hit.actionId !== 'arena.elephant.wall') amount *= (this.world.tick < arena.exposedUntil ? 1.8 : .6) * (hit.sourceId === 1 ? 1 : .2);
    return glance ? amount * riotShieldResponse.chipFraction : amount;
  }
  /** True only for an actual frontal riot shield firearm hit outside contact and break windows. */
  private shieldGlance(hit: DamageEvent, target: EntitySnapshot): boolean {
    if (target.archetype !== 'infected.riot' || !target.combat?.shield || hit.type !== 'bullet' ||
        Status.stunned(target, this.world.tick) || this.world.tick < (target.combat.shieldBrokenUntil ?? 0)) return false;
    const origin = hit.shotOrigin ?? hit.origin, dx = origin.x - target.transform.x, dz = origin.z - target.transform.z, distance = Math.hypot(dx, dz);
    if (distance <= target.combat.radius + .8) return false;
    const dot = distance ? (dx * Math.cos(target.transform.yaw) - dz * Math.sin(target.transform.yaw)) / distance : 1;
    return dot >= Math.cos(riotShieldResponse.faceHalfAngleDeg * Math.PI / 180) - 1e-8;
  }
  /** Cure bypasses armor, boss HP floors and recovery; uses death events without blast/gib feedback. */
  cure(target: EntitySnapshot, resident = true): void {
    if (target.id === 1 || !cureCanKill(target) || target.corpse || target.health.current <= 0 && target.infected!.recoverAt < 0) return;
    const amount = Math.max(0, target.health.current), b = target.infected!;
    if (resident) this.world.infected?.down(target, true);
    if (b.perched || b.special === 'cling') target.transform.y = (this.world.districts?.supportBelow(target.transform.x, target.transform.z, target.transform.y - .7) ?? 0) + .7;
    delete target.hidden; delete target.attachedTo;
    target.health.current = 0; b.recoverAt = -1; b.state = 'dead'; b.deadAt = this.world.tick;
    b.grabUntil = 0; b.until = 0; b.attackId = 0; b.targetId = 0; b.hidden = false; b.perched = false; b.path.length = 0;
    delete b.specialAttack; delete target.infectionRise; delete target.infection;
    if (target.civilian) { target.civilian.state = 'finished'; target.civilian.entered = this.world.tick; target.civilian.story = null; }
    if (target.combat) { target.combat.attacking = false; target.combat.statuses.length = 0; }
    if (!resident) target.corpse = true;
    if (target.locomotion) { target.locomotion.vx = 0; target.locomotion.vz = 0; }
    if (target.archetype === 'infected.crow') { for (let i = 0; i < 20; i++) if (b.birdAlive[i]) b.birdDeadMask = (b.birdDeadMask ?? 0) | 1 << i; b.birds = 0; b.birdAlive.fill(0); }
    if (b.pursuit && this.world.megaPursuit) { this.world.megaPursuit.state.hp = 0; this.world.megaPursuit.state.mode = 'dead'; }
    if (resident) this.world.events.emit({ type: 'combat.kill', tick: this.world.tick, attackId: 0, actionId: 'cure', sourceId: 1, targetId: target.id, position: { ...target.transform }, direction: { x: 0, z: 0 }, knockback: 0, amount, damageType: 'status' });
  }
  constructor(private readonly world: SimWorld) {}
  apply(hit: DamageEvent): number {
    const target = this.world.entities.get(hit.targetId), source = this.world.entities.get(hit.sourceId);
    if (!target || !source) return 0;
    if (target.environmentObject) return 0; // placement parts own this prop's durability
    if (target.infected?.arenaBoss) hit = { ...hit, permanent: true, knockback: 0, stagger: 0, knockdown: false, knockdownTicks: 0, part: undefined };
    if (hit.type === 'melee' && !combatHeightReachable(source, target)) return 0;
    // L7's power weapon opens a route for the column. Civilian splash already
    // deals no HP damage, but its generic reaction knocked the living followers
    // flat for 90 ticks and shoved them into the attackers they were escaping.
    if (this.world.scenario === 'L7' && source.id === 1 && hit.actionId === 'weapon.rocket-launcher' && hit.type === 'explosive' &&
        !target.infected && !target.infection && this.world.l7Encounters?.state.roster.some(r => r.id === target.id && r.status === 'following')) return 0;
    // L1's authored combat target is 6–7 strikes unarmed and two bat hits against its 60 HP
    // regular. Keep those level-specific values at the damage seam so later levels retain the
    // shared weapon roster and their own melee caps.
    if (this.world.scenario === 'L1' && source.id === 1 && hit.type === 'melee') {
      if (hit.actionId === 'weapon.fists') hit = { ...hit, base: l1v2.combat.unarmedDamage[0] };
      else if (hit.actionId === 'weapon.bat') hit = { ...hit, base: hit.base >= 30 ? l1v2.combat.batFinisherDamage : l1v2.combat.batDamage };
    }
    if (this.world.missions?.state.states['cure-released'] && (source.infected || target.id === 1 || target.companion)) return 0;
    if (this.world.scenario === 'L10' && target.id === 1 && insideCureHangar(target.transform)) return 0;
    if (this.world.scenario === 'L10' && target.id === 1 && source.infected && this.world.mountedGun?.mounted) {
      const gun = this.world.mountedGun, dx = source.transform.x - target.transform.x, dz = source.transform.z - target.transform.z;
      const distance = Math.hypot(dx, dz) || 1;
      // The raised deck blocks ground melee; the rotating shield covers the forward hemisphere.
      if (hit.type === 'melee' && source.transform.y < target.transform.y - 1.2) return 0;
      if ((dx * gun.aim.x + dz * gun.aim.z) / distance >= 0 && (hit.type !== 'melee' || distance > 2.2)) return 0;
      // An infected which climbed the stair can reach the gunner from behind. Leave and clear the stairs.
      hit = { ...hit, knockback: 0, stagger: 0, knockdown: false, knockdownTicks: 0 };
    }
    // E31 hull attacks own infected melee against the APC; seated people are inside its armor.
    const transportId = target.id === 1 ? this.world.vehicles?.active : target.passengerOf;
    if (target.hidden && transportId != null && source.kind === 'infected' && hit.type === 'melee' && this.world.entities.get(transportId)?.archetype === 'vehicle.military-apc') return 0;
    if (storyProtected(this.world, target)) {
      if (hit.knockback > 0) this.world.knockback(target, hit.direction, hit.knockback);
      return 0;
    }
    if (target.id === 1 && (hit.type === 'bullet' || hit.type === 'projectile') && !this.world.combat!.query.visible(hit.origin, target.transform)) return 0;
    // The installed cure makes the final Mega mortal with every returned weapon.
    if (this.world.scenario === 'L10' && target.infected?.pursuit && this.world.missions?.state.states['cure-installed']) hit = { ...hit, permanent: true };
    if (target.health.current <= 0) {
      // Explosives and lethal fire finish a downed infected in every level.
      if (downed(target) && this.amount(hit, target) > 0) {
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
    let shieldGlance = false, shieldBreak = false;
    if (this.shieldGlance(hit, target)) {
      shieldGlance = true;
      const stress = (target.combat!.shieldStress ?? 0) + Math.max(0, hit.base * hit.multiplier);
      if (stress >= riotShieldResponse.breakStress) {
        shieldBreak = true; target.combat!.shieldStress = 0;
        target.combat!.shieldBrokenAt = this.world.tick; target.combat!.shieldBrokenUntil = this.world.tick + riotShieldResponse.breakTicks;
        target.combat!.staggerUntil = Math.max(target.combat!.staggerUntil, target.combat!.shieldBrokenUntil);
        target.combat!.attacking = false;
        hit = { ...hit, knockback: Math.max(hit.knockback, riotShieldResponse.recoilM), stagger: Math.max(hit.stagger, .08) };
      } else {
        target.combat!.shieldStress = stress;
        hit = { ...hit, knockback: Math.max(hit.knockback, riotShieldResponse.recoilM), stagger: Math.max(hit.stagger, .08) };
      }
    }
    let megaReact = false;
    if (mega && hit.base * hit.multiplier > 0 && (hit.stagger > 0 || hit.knockback > 0 || hit.knockdown || hit.knockdownTicks || this.world.scenario === 'L10') && this.world.tick >= (target.infected!.megaStaggerReady ?? 0)) {
      megaReact = true; target.infected!.megaStaggerReady = this.world.tick + megaAlpha.staggerCooldownTicks;
      const recovery = target.infected!.specialRecoveryUntil ?? 0;
      this.world.infected?.cancelSpecial(target.id);
      // An interrupt must not turn a 0.5 s stagger into the completed move's 1.2 s immobilization.
      target.infected!.specialRecoveryUntil = Math.max(recovery, this.world.tick + megaAlpha.staggerTicks);
      target.combat!.staggerUntil = Math.max(target.combat!.staggerUntil, this.world.tick + Math.min(megaAlpha.staggerTicks, Math.max(this.world.scenario === 'L10' ? 30 : 1, Math.ceil(hit.stagger * 60))));
    }
    if (mega) hit = { ...hit, knockback: megaReact ? Math.min(.4, hit.knockback) : 0, stagger: 0, knockdown: false, knockdownTicks: 0, part: undefined };
    const wasAlive = target.health.current > 0;
    let amount = this.amount(hit, target);
    const shieldBlocked = hit.type === 'bullet' && target.combat?.shield && amount === 0;
    if (target.combat?.allyResist !== undefined && hit.sourceId !== 1) amount *= target.combat.allyResist;
    if (amount > 0 && target.archetype === 'infected.crow' && this.world.infected) amount = this.world.infected.hitFlock(target, hit.origin, hit.direction, hit.radius ?? 30, hit.type === 'explosive' ? 360 : hit.spread ?? 0);
    if (target.id === 1 && this.world.combat?.effects.shielded(target.transform)) amount = 0;
    if (target.id === 1 && (this.god || this.world.inspectionGhost)) amount = 0;
    if (target.id === 1 && this.world.player) amount = this.world.player.damage(amount, this.world.tick, hit.actionId === 'infected.zebra.stampede');
    else {
      amount = Math.min(amount, target.health.current); target.health.current -= amount;
      if (amount > 0 && (source.id === 1 || source.playerDamageSource)) {
        if (target.infected) target.infected.hitByPlayer = true;
        else if (target.faction === 'environment') target.playerDamageSource = true;
      }
    }
    // Keep ordinary player melee in reach even after knockback upgrades. Special
    // kicks/ground slam retain their authored shove; raw damage is never a finisher.
    const special = hit.knockdown || hit.actionId === 'weapon.kick' || hit.actionId === 'ability.ground-slam';
    const normal = source.id === 1 && hit.type === 'melee' && !special && !hit.sweep;
    const knockback = normal ? Math.min(.4, hit.knockback) : hit.knockback;
    const stagger = megaReact ? (target.combat!.staggerUntil - this.world.tick) / 60 : normal ? Math.min(.25, hit.stagger) : hit.stagger;
    const event = { tick: this.world.tick, attackId: hit.attackId, actionId: hit.actionId, sourceId: hit.sourceId, targetId: hit.targetId, position: { ...target.transform }, direction: { ...hit.direction }, knockback, amount, damageType: hit.type, ...((hit.type === 'vehicle' || hit.type === 'prop') ? { cause: hit.type } : {}) };
    this.world.events.emit({ ...event, type: 'combat.hit', ...(shieldBlocked ? { blocked: true } : {}), ...(shieldGlance ? { shieldGlance: true } : {}), ...(shieldBreak ? { shieldBreak: true } : {}) });
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
      if (knockback > 0 && target.faction !== 'environment') this.world.knockback(target, hit.direction, knockback, hit.actionId === 'weapon.shotgun' ? 8 : 1);
      if (target.combat && target.faction === 'infected' && (!mega || megaReact || target.health.current === 0)) {
        const heavy = target.health.current === 0 || !target.infected?.arenaBoss && !mega && ( (!!special && target.archetype !== 'infected.alpha') || (!normal && (hit.type === 'explosive' || hit.type === 'vehicle')));
        const downed = target.combat.reaction?.heavy && target.combat.reaction.until > this.world.tick;
        const previous = target.combat.reaction?.index ?? target.id % 3;
        if (downed && target.health.current === 0) target.combat.reaction!.groundDeath = true;
        else if (!downed || heavy) target.combat.reaction = { index: (previous + 1) % 6, started: this.world.tick, until: this.world.tick + (heavy ? 80 : Math.max(target.infected?.arenaBoss ? 8 : 1, Math.ceil(stagger * 60))), direction: { ...hit.direction }, from, to: { x: target.transform.x, z: target.transform.z }, heavy };
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
      if (target.infected) target.infected.knockdowns = (target.infected.knockdowns ?? 0) + 1;
      // Default hits down infected; explosions and explicit permanent counters leave a corpse.
      const up = target.infected && this.world.infected ? this.world.infected.down(target, lethal(hit)) : -1;
      this.world.events.emit({ ...event, type: 'combat.kill', ...(up >= 0 ? { downed: up } : {}) } satisfies GameEvent);
    }
    return amount;
  }
}
