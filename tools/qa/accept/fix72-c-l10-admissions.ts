import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { provenance } from './probe';
import { atomicJson } from './report';

const rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L10-default'); campaign.settings.quality = tier;
  const samples: unknown[] = [];
  const groups = ['depot-workers', 'depot-alpha', 'research-approach', 'research-lab', 'research-quarantine', 'corridor-line', 'corridor-breach', 'corridor-exit'];
  let previous = '';
  const run = await runLevel('L10', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      const update = world.update.bind(world);
      world.update = () => {
        update();
        if (world.tick % 10) return;
        const slots = Object.entries(world.l10Encounters!.state.spawned);
        const admissions = Object.fromEntries(groups.map(group => [group, slots.filter(([key]) => key.startsWith(`${group}:`)).length]));
        const signature = JSON.stringify(admissions);
        if (signature === previous) return;
        previous = signature;
        const p = world.entities.get(1)!.transform;
        const ai = world.infected!;
        samples.push({ tick: world.tick, player: { x: p.x, z: p.z }, admissions,
          cap: ai.director.cap, count: ai.director.count,
          specials: ai.active.filter(e => e.archetype === 'infected.dog' || e.archetype === 'infected.alpha').map(e => ({
            id: e.id, archetype: e.archetype, hp: e.health.current, recoverAt: e.infected?.recoverAt,
            hidden: e.hidden || e.infected?.hidden, pending: e.pendingAdmission,
            x: e.transform.x, z: e.transform.z, region: e.infected?.cureRegion,
            slot: slots.find(([, id]) => id === e.id)?.[0],
          })),
        });
      };
    },
  });
  rows.push({ tier, run, samples });
  console.log(tier, run.outcome, samples.length);
}
atomicJson(`docs/reports/fix72-c/L10-03/admissions-${process.argv[2] ?? 'before'}.json`, { ...provenance(), rows });
