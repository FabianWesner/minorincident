import { humanInfected } from '../../data/infected';
import type { EntitySnapshot } from '../world/types';
import type { InfectedSystem } from './InfectedSystem';

/** Alpha's support moves use the shared scheduler and entity-owned checkpoint state. */
export class AlphaSupportMoves {
  constructor(private readonly ai: InfectedSystem) {}
  private regular(e: EntitySnapshot): boolean { return e.archetype !== 'infected.alpha' && humanInfected.some(d => d.id === e.archetype); }
  tryStart(e: EntitySnapshot, target: EntitySnapshot): boolean {
    const p = e.transform, t = target.transform, dx = t.x - p.x, dz = t.z - p.z, distance = Math.hypot(dx, dz);
    if (e.archetype !== 'infected.alpha' || distance > 15 || !this.ai.hearing.sees(e, t)) return false;
    const locked = { id: target.id, x: t.x, z: t.z }, area = { x: p.x, z: p.z, radius: 1, dx: dx / (distance || 1), dz: dz / (distance || 1) };
    if (this.ai.props.nearestObject(e, 2) && this.ai.startSpecial(e.id, 'alpha.grab-throw', locked, area)) return true;
    if (this.ai.active.some(other => other.health.current > 0 && this.regular(other) && Math.hypot(other.transform.x - p.x, other.transform.z - p.z) <= 18)) return this.ai.startSpecial(e.id, 'alpha.roar', locked, { ...area, radius: 18 });
    return false;
  }
  update(e: EntitySnapshot): void {
    const a = e.infected!.specialAttack!;
    if (a.stage !== 'active') return;
    if (a.move === 'alpha.roar') {
      for (const other of this.ai.active) {
        if (!this.regular(other) || other.health.current <= 0 || Math.hypot(other.transform.x - a.area.x, other.transform.z - a.area.z) > 18 || !this.ai.specialHit(e.id, other.id)) continue;
        // Refresh duration without multiplying the existing speed. Never disclose a human target.
        other.infected!.roar = { sourceId: e.id, attackId: a.attackId, x: a.area.x, z: a.area.z, until: this.ai.world.tick + 300 };
        other.infected!.state = 'idle'; other.infected!.heardTargetId = 0; other.infected!.targetId = 0; other.infected!.grabUntil = 0;
        if (other.infected!.l1) { other.infected!.l1.targetId = 0; other.infected!.l1.mode = 'wander'; other.infected!.l1.hasGoal = false; other.infected!.l1.escapeUntil = 0; other.infected!.l1.directTick = -1; other.infected!.l1.biteTargetId = 0; }
        other.infected!.path.length = 0; other.infected!.goal = -1;
        this.ai.world.events.emit({ type: 'infected.roar-buff', tick: this.ai.world.tick, sourceId: e.id, targetId: other.id, attackId: a.attackId, stage: 'active', until: this.ai.world.tick + 300 });
      }
      this.ai.finishSpecial(e.id);
    } else if (a.move === 'alpha.grab-throw') {
      if (!a.projectile && !this.ai.props.launchSpecial(e, a, 2)) { this.ai.cancelSpecial(e.id); return; }
      if (this.ai.props.updateSpecial(e, a)) this.ai.finishSpecial(e.id);
    }
  }
}
