import { humanInfected, infectedSpecialMoves, type InfectedSpecialMove } from '../../data/infected';
import { alphaTypes } from '../../data/alphaTypes';
import type { EntitySnapshot } from '../world/types';
import type { InfectedSystem } from './InfectedSystem';

/** Alpha and zoo support moves use the shared scheduler and entity-owned checkpoint state. */
export class AlphaSupportMoves {
  private readonly regularTypes = new Set(humanInfected.filter(d => d.id !== 'infected.alpha').map(d => d.id));
  constructor(private readonly ai: InfectedSystem) {}
  private regular(e: EntitySnapshot): boolean { return !!e.infected && this.regularTypes.has(e.archetype); }
  tryStart(e: EntitySnapshot, target: EntitySnapshot): boolean {
    const b = e.infected!, tick = this.ai.world.tick;
    const rage = !!b.pursuit && this.ai.world.scenario === 'L10' && b.megaPhase === 2;
    if (e.archetype !== 'infected.alpha' || b.pursuit && !rage || b.specialAttack || tick < b.cooldown || tick < (b.specialRecoveryUntil ?? 0)) return false;
    const moves: readonly InfectedSpecialMove[] = rage ? ['alpha.grab-throw', 'alpha.barrage', 'alpha.living-missile', 'alpha.roar'] : b.alphaType ? alphaTypes[b.alphaType].moves : ['alpha.grab-throw', 'alpha.roar'];
    const p = e.transform, t = target.transform, dx = t.x - p.x, dz = t.z - p.z, distance = Math.hypot(dx, dz);
    if (distance > (rage ? 35 : 25) || !(rage || b.alphaType === 'thrower' ? this.ai.hearing.lineOfSight(e.transform, t) : this.ai.hearing.sees(e, t))) return false;
    const ready = (move: typeof moves[number]) => moves.includes(move) && tick + infectedSpecialMoves[move].windup >= (b.specialCooldowns?.[move] ?? 0);
    const start = (move: typeof moves[number], radius = 1) => this.ai.startSpecial(e.id, move, { id: target.id, x: t.x, z: t.z }, { x: p.x, z: p.z, radius, dx: dx / (distance || 1), dz: dz / (distance || 1) });
    if (rage && ready('alpha.roar') && start('alpha.roar', 25)) return true;
    if (b.alphaType === 'thrower' || rage) {
      if (distance <= 8 && ready('alpha.barrage') && this.ai.props.nearestLight(e, 2) && start('alpha.barrage')) return true;
      if (distance >= 4 && ready('alpha.living-missile') && this.ai.props.nearestLiving(e, 2) && start('alpha.living-missile')) return true;
    }
    if (ready('alpha.grab-throw') && this.ai.props.nearestObject(e, rage ? 6 : 2) && start('alpha.grab-throw')) return true;
    // Within melee range the ordinary contact attack takes priority over scavenging.
    if (b.alphaType === 'thrower' && distance > 8) {
      const object = ready('alpha.grab-throw') ? this.ai.props.nearestObject(e, 6) : undefined;
      const position = object ? this.ai.props.objectPosition(object.id) : ready('alpha.living-missile') ? this.ai.props.nearestLiving(e, 6)?.transform : undefined;
      if (position && Math.hypot(position.x - p.x, position.z - p.z) > 1.25) {
        this.ai.seek(e, position); this.ai.world.spatial.set(e.id, p.x, p.z); e.combat!.attacking = false; return true;
      }
    }
    if (distance <= (b.alphaType === 'screamer' ? 8 : 15) && ready('alpha.roar') && start('alpha.roar', b.alphaType === 'screamer' ? 8 : 18)) return true;
    return false;
  }
  update(e: EntitySnapshot): void {
    const a = e.infected!.specialAttack!;
    if (a.stage !== 'active') return;
    if (a.move === 'alpha.roar' || a.move === 'gorilla.roar') {
      if (e.infected!.pursuit) this.ai.world.l10Encounters?.callWave();
      const screamer = e.infected!.alphaType === 'screamer', radius = a.move === 'gorilla.roar' ? 20 : 18;
      if (screamer) {
        for (const human of this.ai.hearing.humans.within(a.area, 8)) {
          const target = this.ai.world.entities.get(human.id);
          if (target && !target.companion && !target.escort?.child && target.health.current > 0 && this.ai.hearing.lineOfSight(e.transform, target.transform)) {
            this.ai.world.combat!.status.apply(target, { kind: 'stunned', duration: 1, maxStacks: 1, dps: 0, slow: 0 }, e.id, 'infected.alpha.roar', a.attackId);
            // NPC locomotion uses the shared stagger clock to stop its body.
            if (target.combat) target.combat.staggerUntil = Math.max(target.combat.staggerUntil, this.ai.world.tick + 60);
          }
        }
      }
      let called = 0;
      const limit = screamer ? 6 + (e.id + a.attackId) % 5 : Infinity;
      for (const other of this.ai.active) {
        if (!this.regular(other) || other.health.current <= 0 || other.attachedTo !== undefined || other.infected!.specialAttack || (other.transform.x - a.area.x) ** 2 + (other.transform.z - a.area.z) ** 2 > radius * radius || called >= limit || !this.ai.specialHit(e.id, other.id)) continue;
        called++;
        // Screamer calls the group to the telegraphed player position; legacy/zoo roars converge on their caller.
        const goal = screamer ? a.target : a.area;
        other.infected!.roar = { sourceId: e.id, attackId: a.attackId, x: goal.x, z: goal.z, until: this.ai.world.tick + 300, speedScale: Math.max(other.infected!.roar?.speedScale ?? 1, a.move === 'alpha.roar' ? 1.25 : 1), speedUntil: a.move === 'alpha.roar' ? this.ai.world.tick + 300 : other.infected!.roar?.speedUntil ?? other.infected!.roar?.until ?? this.ai.world.tick };
        other.infected!.state = 'idle'; other.infected!.heardTargetId = 0; other.infected!.targetId = 0; other.infected!.grabUntil = 0;
        if (other.infected!.l1) { other.infected!.l1.targetId = 0; other.infected!.l1.mode = 'wander'; other.infected!.l1.hasGoal = false; other.infected!.l1.escapeUntil = 0; other.infected!.l1.directTick = -1; other.infected!.l1.biteTargetId = 0; }
        other.infected!.path.length = 0; other.infected!.goal = -1;
        this.ai.world.events.emit({ type: 'infected.roar-buff', tick: this.ai.world.tick, sourceId: e.id, targetId: other.id, attackId: a.attackId, stage: 'active', until: this.ai.world.tick + 300 });
      }
      this.ai.finishSpecial(e.id);
    } else if (a.move === 'alpha.barrage') {
      a.barrageRemaining ??= 3;
      const flights = a.barrageProjectiles ??= [];
      for (let i = flights.length - 1; i >= 0; i--) {
        a.projectile = flights[i];
        if (this.ai.props.updateSpecial(e, a)) flights.splice(i, 1);
      }
      delete a.projectile;
      if (!a.barrageRemaining) { if (!flights.length) this.ai.finishSpecial(e.id); return; }
      if (!a.pickup) {
        if (!this.ai.props.pickupSpecial(e, a)) { a.barrageRemaining = 0; return; }
        a.barrageNextTick = this.ai.world.tick + 30;
        this.ai.world.events.emit({ type: 'telegraph', tick: this.ai.world.tick, sourceId: e.id, attackId: a.attackId, special: a.move, move: a.move, duration: .5, startTick: this.ai.world.tick, activeTick: a.barrageNextTick, cooldownExpiry: a.cooldownExpiry, target: { ...a.target }, area: { ...a.area } });
      }
      this.ai.props.holdSpecial(e, a);
      if (this.ai.world.tick < (a.barrageNextTick ?? a.activeTick)) return;
      if (!this.ai.props.launchSpecial(e, a, 2)) { a.barrageRemaining = 0; return; }
      flights.push(a.projectile!); delete a.projectile;
      this.ai.world.events.emit({ type: 'infected.special', tick: this.ai.world.tick, sourceId: e.id, move: a.move, attackId: a.attackId, stage: 'active' });
      a.barrageRemaining--;
    } else if (a.move === 'alpha.grab-throw' || a.move === 'gorilla.grab-throw' || a.move === 'alpha.living-missile') {
      if (!a.projectile && !this.ai.props.launchSpecial(e, a, a.move === 'gorilla.grab-throw' ? 3 : 2)) { this.ai.cancelSpecial(e.id); return; }
      if (this.ai.props.updateSpecial(e, a)) this.ai.finishSpecial(e.id);
    }
  }
}
