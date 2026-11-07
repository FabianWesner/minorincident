import { loadLevel, type LevelReport } from '../../sim-runner/levels';
import { runL3 } from '../../sim-runner/l3Bots';
import { preset } from '../../../src/sim/progression/Campaign';
import { ThreatObserver } from './observer';
import { stateHash } from '../../../src/sim/world/stateHash';
import type { ArmySeed } from './l3ArmyLine';
import type { L3SurvivalSeed } from './l3SurvivalSeeds';

export interface L3SharedSeed {
  seed: number;
  run: LevelReport;
  observation: ReturnType<ThreatObserver['finish']>;
  definitions: ThreatObserver['definitions'];
  quality: string;
  nativeStateHash: string;
  army: ArmySeed;
  survival: L3SurvivalSeed;
}

/** One complete native L3 route supplies the threat, army-line and survival receipts for each seed. */
export async function l3SharedSeeds(tier: 'low' | 'high', seedOneCampaign: ReturnType<typeof preset>): Promise<L3SharedSeed[]> {
  const rows: L3SharedSeed[] = [];
  for (const seed of [1, 2, 3]) {
    const campaign = seed === 1 ? seedOneCampaign : preset('L3-default');
    campaign.seed = seed; campaign.settings.quality = tier;
    let observer: ThreatObserver | undefined;
    const world = await loadLevel('L3', seed, campaign, 0, {
      quality: tier,
      beforeBegin: value => { observer = new ThreatObserver(value, 'L3'); },
    });
    try {
      const report = runL3(world, world.missions!, 'complete', { seed, maxSeconds: 1200, street: 'auto' });
      const observation = observer!.finish(), hash = stateHash(world.getState());
      const collision = world.solids.snapshot();
      const objectiveTimeline = report.timeline.filter(row => row.type.startsWith('objective:')).map(row => ({ id: row.type.slice('objective:'.length), t: row.t }));
      const levelReport: LevelReport = {
        collision, level: 'L3', policy: 'complete', seed, completed: report.outcome === 'complete',
        time: report.simSeconds, deaths: report.deaths, kills: report.kills, damageTaken: report.damage,
        failures: {}, objectiveTimeline, furthestObjective: objectiveTimeline.at(-1)?.id ?? null,
        activeObjectives: [], outcome: report.outcome === 'complete' ? 'complete' : 'tick-budget', blocker: null,
      };
      if (collision.failures) {
        levelReport.failures['collision-invariant'] = collision.failures;
        levelReport.completed = false; levelReport.outcome = 'mission-failed';
        levelReport.blocker = { objective: levelReport.furthestObjective, detail: JSON.stringify(collision) };
      }
      const army = observation.l3Squad?.army ?? null;
      const checkpoint = observation.phases.find(phase => phase.key === 'step/checkpoint');
      const armySeed: ArmySeed = { seed, valid: levelReport.completed && army !== null, army, attacksPerMinute: checkpoint?.attacksPerMinute ?? null };
      const survival: L3SurvivalSeed = {
        seed, valid: report.outcome === 'complete' && !!report.s1?.completed,
        s1: report.s1 ? { ...report.s1 } : null,
        density: report.density,
      };
      rows.push({ seed, run: levelReport, observation, definitions: observer!.definitions, quality: observer!.quality, nativeStateHash: hash, army: armySeed, survival });
    } finally { world.dispose(); }
  }
  return rows;
}
