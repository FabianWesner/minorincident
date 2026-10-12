import { humanInfected, infectedSpecialMoves } from '../../data/infected';
import type { EntitySnapshot } from '../world/types';
import type { InfectedSystem } from './InfectedSystem';

/** Alpha and zoo support moves use the shared scheduler and entity-owned checkpoint state. */
export class AlphaSupportMoves {
  private readonly regularTypes = new Set(humanInfected.filter(d => d.id !== 'infected.alpha').map(d => d.id));
  private readonly neighbors: number[] = [];
  private readonly query = { x: 0, z: 0, r: 18 };
  private readonly locked = { id: 0, x: 0, z: 0 };
  private readonly area = { x: 0, z: 0, radius: 1, dx: 0, dz: 0 };
  constructor(private readonly ai: InfectedSystem) {}
  private regular(e: EntitySnapshot): boolean { return !!e.infected && this.regularTypes.has(e.archetype); }
  tryStart(e: EntitySnapshot, target: EntitySnapshot): boolean {
    if (e.archetype !== 'infected.alpha') return false;
    const b = e.infected!, tick = this.ai.world.tick;
    if (tick < b.cooldown || tick < (b.specialRecoveryUntil ?? 0)) return false;
    const grabReady = tick + infectedSpecialMoves['alpha.grab-throw'].windup >= (b.specialCooldowns?.['alpha.grab-throw'] ?? 0);
    const roarReady = tick + infectedSpecialMoves['alpha.roar'].windup >= (b.specialCooldowns?.['alpha.roar'] ?? 0);
    if (!grabReady && !roarReady) return false;
    const p = e.transform, t = target.transform, dx = t.x - p.x, dz = t.z - p.z, distance = Math.hypot(dx, dz);
    if (distance > 15 || !this.ai.hearing.sees(e, t)) return false;
    const locked = this.locked, area = this.area;
    locked.id = target.id; locked.x = t.x; locked.z = t.z;
    area.x = p.x; area.z = p.z; area.radius = 1; area.dx = dx / (distance || 1); area.dz = dz / (distance || 1);
    if (grabReady && this.ai.props.nearestObject(e, 2) && this.ai.startSpecial(e.id, 'alpha.grab-throw', locked, area)) return true;
    if (roarReady) {
      this.query.x = p.x; this.query.z = p.z; this.ai.world.spatial.query(this.query, this.neighbors);
      for (const id of this.neighbors) {
        const other = this.ai.world.entities.get(id);
        if (other && other.health.current > 0 && this.regular(other)) { area.radius = 18; return this.ai.startSpecial(e.id, 'alpha.roar', locked, area); }
      }
    }
    return false;
  }
  update(e: EntitySnapshot): void {
    const a = e.infected!.specialAttack!;
    if (a.stage !== 'active') return;
    if (a.move === 'alpha.roar' || a.move === 'gorilla.roar') {
      const radius = a.move === 'gorilla.roar' ? 20 : 18;
      for (const other of this.ai.active) {
        if (!this.regular(other) || other.health.current <= 0 || (other.transform.x - a.area.x) ** 2 + (other.transform.z - a.area.z) ** 2 > radius * radius || !this.ai.specialHit(e.id, other.id)) continue;
        // Refresh duration without multiplying the existing speed. Never disclose a human target.
        other.infected!.roar = { sourceId: e.id, attackId: a.attackId, x: a.area.x, z: a.area.z, until: this.ai.world.tick + 300, speedScale: Math.max(other.infected!.roar?.speedScale ?? 1, a.move === 'alpha.roar' ? 1.25 : 1), speedUntil: a.move === 'alpha.roar' ? this.ai.world.tick + 300 : other.infected!.roar?.speedUntil ?? other.infected!.roar?.until ?? this.ai.world.tick };
        other.infected!.state = 'idle'; other.infected!.heardTargetId = 0; other.infected!.targetId = 0; other.infected!.grabUntil = 0;
        if (other.infected!.l1) { other.infected!.l1.targetId = 0; other.infected!.l1.mode = 'wander'; other.infected!.l1.hasGoal = false; other.infected!.l1.escapeUntil = 0; other.infected!.l1.directTick = -1; other.infected!.l1.biteTargetId = 0; }
        other.infected!.path.length = 0; other.infected!.goal = -1;
        this.ai.world.events.emit({ type: 'infected.roar-buff', tick: this.ai.world.tick, sourceId: e.id, targetId: other.id, attackId: a.attackId, stage: 'active', until: this.ai.world.tick + 300 });
      }
      this.ai.finishSpecial(e.id);
    } else if (a.move === 'alpha.grab-throw' || a.move === 'gorilla.grab-throw') {
      if (!a.projectile && !this.ai.props.launchSpecial(e, a, a.move === 'gorilla.grab-throw' ? 3 : 2)) { this.ai.cancelSpecial(e.id); return; }
      if (this.ai.props.updateSpecial(e, a)) this.ai.finishSpecial(e.id);
    }
  }
}
