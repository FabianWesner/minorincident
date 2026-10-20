import { resolveCampaignMission } from '../../levels/missions';
import type { DistrictLayout, LevelComposition } from '../../levels/districts/types';
import { preset } from '../progression/Campaign';
import { applyCampaign } from '../progression/apply';
import { SimWorld } from '../world/SimWorld';

/**
 * perf-w6: the L4 alarm (the quartermaster's gun, the turn, the crowd's flight, the first wave groups) runs code that nothing
 * before it executes, so its first ticks ran cold, unoptimized JavaScript (about half of their cost in Node). Behind the
 * loading card this plays the alarm once in a private, view-less scratch world, so the real alarm runs compiled code.
 * The scratch world shares no state with the game (own SimWorld, events and physics world; a copy of the layouts) and is
 * disposed at once; the real simulation is unchanged (tests/sim/performance/l4-alarm-warmup.test.ts).
 */
export async function warmL4Alarm(composition: LevelComposition, layouts: readonly DistrictLayout[], seed: number, tier: 'high' | 'low'): Promise<void> {
  const world = new SimWorld();
  try {
    await world.init();
    world.loadComposition(composition, structuredClone(layouts) as DistrictLayout[], seed);
    if (tier === 'low') { world.infected!.director.setTier('low'); world.npcs!.setQuality('low'); }
    applyCampaign(world, preset('L4-default'));
    const mission = world.loadMission(resolveCampaignMission('L4', world.districts!));
    mission.begin();
    mission.completeObjective('ride'); world.update();
    mission.completeObjective('quartermaster');
    for (let i = 0; i < 30; i++) world.update();
  } finally { world.dispose(); }
}
