import { runLevel, type RunnerLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { ThreatObserver } from './observer';
import type { ArmySeed } from './l3ArmyLine';

/** Native `complete` runs of L3 (same runner and observer as the seed-1 receipt) for the extra seeds. */
export async function l3ArmySeeds(tier: 'low' | 'high', seeds: readonly number[] = [2, 3]): Promise<ArmySeed[]> {
  const rows: ArmySeed[] = [];
  for (const seed of seeds) {
    const campaign = preset('L3-default'); campaign.seed = seed; campaign.settings.quality = tier;
    let observer: ThreatObserver | undefined, result: ReturnType<ThreatObserver['finish']> | undefined;
    try {
      const run = await runLevel('L3' as RunnerLevel, 'complete', seed, undefined, 'auto', campaign, undefined, 0, {
        quality: tier, beforeBegin: world => { observer = new ThreatObserver(world, 'L3'); }, beforeDispose: () => { result = observer?.finish(); },
      });
      const squad = result?.l3Squad, route = result?.phases.find(phase => phase.key === 'step/checkpoint');
      rows.push({ seed, valid: !!run.completed && squad?.army !== null && squad?.army !== undefined, army: squad?.army ?? null, attacksPerMinute: route?.attacksPerMinute ?? null });
    } catch { rows.push({ seed, valid: false, army: null, attacksPerMinute: null }); }
  }
  return rows;
}
