import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { warmL4Alarm } from '../../../src/sim/missions/l4AlarmWarmup';
import { preset } from '../../../src/sim/progression/Campaign';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import type { DistrictLayout } from '../../../src/levels/districts/types';

/** The run after a scratch alarm warm-up (perf-w6) is identical to one without it: same alarm tick, same end state. */
test('T-E22-20-alarm-warmup @E22-AC20 the loading-time scratch alarm leaves the real L4 simulation unchanged', async () => {
  const composition = compositions.L4;
  const layouts = composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))) as DistrictLayout[];
  const run = async (warm: boolean) => {
    // The game passes the same layout objects it built the real world from.
    if (warm) await warmL4Alarm(composition, layouts, 2, 'low');
    const world = new SimWorld();
    try {
      await world.init(); world.loadComposition(composition, layouts, 2);
      world.infected!.director.setTier('low'); world.npcs!.setQuality('low');
      applyCampaign(world, preset('L4-default'));
      const mission = world.loadMission(resolveCampaignMission('L4', world.districts!)); mission.begin();
      mission.completeObjective('ride'); for (let i = 0; i < 120; i++) world.update();
      mission.completeObjective('quartermaster');
      const turnAt = mission.state.l4!.turnAt;
      for (let i = 0; i < 240; i++) world.update();
      return { turnAt, state: JSON.stringify(world.getState()) };
    } finally { world.dispose(); }
  };
  const plain = await run(false), warmed = await run(true);
  expect(plain.turnAt).toBeGreaterThan(0);
  expect(warmed.turnAt).toBe(plain.turnAt);
  expect(warmed.state === plain.state).toBe(true);
}, 120_000);
