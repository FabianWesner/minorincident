import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { l3 } from '../../../src/data/l3';
import { observeAttackStarts } from './attackStarts';
import { phases } from './phases';

/** Extra L3 seeds return only the army count and checkpoint windup rate.
 * Use the same phase clock and windup hook without collecting unused paths,
 * waves, birth identities, or follower censuses. Seed 1 retains the full audit. */
export class L3ArmyObservation {
  private army: number | null = null;
  private checkpoint = false;
  private active = false;
  private ticks = 0;
  private attacks = 0;
  constructor(world: SimWorld) {
    world.events.on('objective.started', event => {
      if (event.type === 'objective.started' && event.id === 'checkpoint') this.checkpoint = true;
    });
    observeAttackStarts(world, (_source, target) => { if (target === 1 && this.active) this.attacks++; });
    const update = world.update.bind(world);
    world.update = () => {
      const before = world.tick;
      this.active = world.missions!.state.phase === 'playing' && phases(world, 'L3').some(row => row.key === 'step/checkpoint');
      this.checkpoint ||= this.active;
      update();
      if (world.tick === before) return;
      if (this.active) this.ticks += world.tick - before;
      if (this.army === null && world.entities.get(1)!.transform.x >= l3.map.zoneX) this.army = world.missions!.state.l3!.squad.length;
      this.checkpoint ||= phases(world, 'L3').some(row => row.key === 'step/checkpoint');
    };
  }
  finish(): { army: number | null; attacksPerMinute: number | null } {
    return { army: this.army, attacksPerMinute: this.checkpoint ? this.ticks ? this.attacks * 3600 / this.ticks : 0 : null };
  }
}
