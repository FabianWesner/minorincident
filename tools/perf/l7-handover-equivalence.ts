/** Exact sim comparison for consuming an L8 district prepared before handover. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { resolveCampaignMission } from '../../src/levels/missions';
import { applyCampaign } from '../../src/sim/progression/apply';
import { preset } from '../../src/sim/progression/Campaign';
import { DistrictWorld } from '../../src/sim/world/DistrictWorld';
import { SimWorld } from '../../src/sim/world/SimWorld';

const composition = compositions.L8;
const layouts = composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8')) as DistrictLayout);
let snapshots = 0;
for (const tier of ['high', 'low'] as const) {
  const prepared = new DistrictWorld(composition, layouts, 1);
  const worlds = [new SimWorld(), new SimWorld()];
  try {
    for (const [i, world] of worlds.entries()) {
      await world.init(); world.loadComposition(composition, layouts, 1, null, undefined, undefined, undefined, i ? prepared : undefined);
      world.infected!.director.setTier(tier); applyCampaign(world, preset('L8-default'));
      world.loadMission(resolveCampaignMission('L8', world.districts!)).begin();
    }
    for (let tick = 0; tick <= 600; tick++) {
      if (tick % 60 === 0) {
        const a = worlds[0], b = worlds[1];
        if (JSON.stringify(a.getState()) !== JSON.stringify(b.getState()) || JSON.stringify(a.entities.values()) !== JSON.stringify(b.entities.values())) throw Error(`Prepared district differs at ${tier}/${tick}`);
        snapshots++;
      }
      for (const world of worlds) world.update();
    }
  } finally { for (const world of worlds) world.dispose(); }
}
const out = 'test-results/l7-perf/handover-equivalence.json';
mkdirSync('test-results/l7-perf', { recursive: true });
const result = { exact: true, tiers: ['high', 'low'], ticksPerTier: 600, snapshots };
writeFileSync(out, JSON.stringify(result, null, 2) + '\n'); console.log(result);
