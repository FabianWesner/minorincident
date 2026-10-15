import { createHash } from 'node:crypto';
import { l5, l5Wanderers } from '../../src/data/l5';
import { infectedDefinitions } from '../../src/data/infected';
import { afterEach, expect, test } from 'vitest';
import { loadL5, runL5 } from '../../tools/sim-runner/l5Bots';
import type { SimWorld } from '../../src/sim/world/SimWorld';
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
test('PO #29 @E23 seed 1 balance baseline: complete and newbie outcomes and deaths stay pinned', async () => {
  expect(createHash('sha256').update(JSON.stringify({ infected: l5.infected, wanderers: l5Wanderers, definitions: infectedDefinitions })).digest('hex')).toBe('ead63ee4655dc2641428681d1ee3572631793ddb5e1f7fd86231bf9e948f1aa3');
  for (const profile of ['complete', 'newbie'] as const) {
    const loaded = await loadL5(1); world = loaded.world;
    const report = runL5(world, loaded.mission, profile, { seed: 1 });
    console.log('PO29', profile, JSON.stringify({ outcome: report.outcome, deaths: report.deaths, rescued: report.rescued, fates: report.fates, infectedAtStart: report.infectedAtStart }));
    expect(report.outcome).toBe('complete');
    expect(report.deaths).toBe(0);
    world.dispose(); world = undefined;
  }
}, 1_800_000);

