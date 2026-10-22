import { readFileSync } from 'node:fs';
import { compositions } from '../../../src/levels/compositions';
import { resolveCampaignMission, type MissionId } from '../../../src/levels/missions';
import { newCampaign, preset, reservedCampaignIds, type ProgressionPreset } from '../../../src/sim/progression/Campaign';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { SimWorld } from '../../../src/sim/world/SimWorld';

/** Same production load/preset path as the sim runner, with quality selected before mission population. */
export async function loadLevel(id: MissionId, seed: number, tier: 'high' | 'low' = 'high'): Promise<SimWorld> {
  const world = new SimWorld();
  try {
    await world.init();
    const campaign = id === 'L1' ? newCampaign('female', seed) : preset((id === 'L9' ? 'L8-default' : `${id}-default`) as ProgressionPreset);
    campaign.seed = seed; campaign.settings.quality = tier;
    const composition = compositions[id];
    world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed, id === 'L2' ? campaign.world?.L1 ?? null : null, id === 'L7' ? campaign.results?.L6?.escapedSurvivors : id === 'L8' ? campaign.results?.L7?.escapedSurvivors : undefined, id === 'L8' ? campaign.results?.L7?.companion : undefined, reservedCampaignIds(id, campaign));
    world.infected!.director.setTier(tier); world.npcs!.setQuality(tier); world.chunks?.setQuality(tier);
    applyCampaign(world, campaign);
    if (id === 'L7') world.l7Encounters!.prepare();
    world.loadMission(resolveCampaignMission(id, world.districts!)).begin();
    return world;
  } catch (error) { world.dispose(); throw error; }
}
