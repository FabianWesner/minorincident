/* eslint-disable @typescript-eslint/no-explicit-any -- one-off diagnostic script (r26-l8follow), not shipped */
// Usage: node --import tsx/esm tools/qa/diag/l8follow.ts [seed] [passive|skilled] [trace]
// Reproduces the threat-audit L8 stage (ThreatObserver, low tier) and prints per-follower speed medians for phase/breached.
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { ThreatObserver } from '../threat/observer';
const seed = Number(process.argv[2] ?? 1), passive = (process.argv[3] ?? 'passive') === 'passive', trace = process.argv[4] === 'trace';
const campaign: any = preset('L8-default' as any); campaign.seed = seed; campaign.settings.quality = 'low';
let observer: any, obs: any; const rows: string[] = [];
const report = await runLevel('L8', 'complete', seed, passive ? 150 : undefined, 'auto', campaign, undefined, 0, {
  quality: 'low', passive,
  beforeDispose: () => { obs = observer.finish(); },
  beforeBegin: (world: any) => {
    observer = new ThreatObserver(world, 'L8');
    if (!trace) return;
    const update = world.update.bind(world);
    world.update = (...a: any[]) => {
      const r = update(...a);
      if (world.tick % 120 === 0 && world.missions.l8.state.breachedAt) {
        const p = world.entities.get(1).transform;
        const f = world.missions.l8.state.roster.map((id: number) => world.entities.get(id)).filter((e: any) => e && e.health.current > 0 && !e.infected);
        rows.push(`t=${(world.tick / 60) | 0} P${p.x | 0},${p.z | 0} ` + f.map((e: any) => `${e.id}@${e.transform.x | 0},${e.transform.z | 0}:${(e.motion?.speed ?? 0).toFixed(1)}`).join(' '));
      }
      return r;
    };
  },
} as any);
for (const p of obs.phases ?? []) if (p.key === 'phase/breached' || p.key.startsWith('step/')) console.log(p.key, 'median', p.followerMedian?.toFixed?.(2), p.followerSpeeds.map((f: any) => `${f.id}:${f.samples}:${f.median.toFixed(2)}`).join(' '));
if (trace) console.log(rows.join('\n'));
console.log('RESULT seed', seed, passive ? 'passive' : 'skilled', report.outcome, report.time | 0);
process.exit(0);
