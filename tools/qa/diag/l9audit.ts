import { runLevel } from '../../sim-runner/levels';
import { ThreatObserver } from '../threat/observer';
import { preset } from '../../../src/sim/progression/Campaign';
const campaign: any = preset('L9-default' as any);
campaign.seed = 1; campaign.settings.quality = 'low';
const t0 = performance.now();
const run = await runLevel('L9', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
  quality: 'low', passive: false,
  beforeBegin: (world: any) => { if (!process.env.NOOBS) new ThreatObserver(world, 'L9'); },
} as any);
console.log('RESULT', run.outcome, run.time, JSON.stringify(run.failures), 'furthest', run.furthestObjective, ((performance.now() - t0) / 1000) | 0, 's');
process.exit(run.outcome === 'complete' && !run.failures['collision-invariant'] ? 0 : 1);
