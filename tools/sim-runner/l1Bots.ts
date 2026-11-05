import { l1Frames, type L1Report } from '../../src/debug/bot/LevelOneBot';
export type { L1Profile, L1Report } from '../../src/debug/bot/LevelOneBot';
export { Walker } from '../../src/debug/bot/Walker';
import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import type { Mission } from '../../src/sim/missions/Mission';
import { SimWorld } from '../../src/sim/world/SimWorld';

/**
 * L1 v2 bot policies (specs/90-test-concept.md section 5, epic-19 section 9). Bots read the sim like a player sees it
 * (positions, objective anchors) and write only InputFrame patches: no cheats, no teleports.
 */
export async function loadL1(seed: number): Promise<{ world: SimWorld; mission: Mission }> {
  const world = new SimWorld(); await world.init();
  const composition = compositions.L1;
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), seed);
  const mission = world.loadMission(resolveCampaignMission('L1', world.districts!)); mission.begin();
  return { world, mission };
}

export function runL1(...args: Parameters<typeof l1Frames>): L1Report {
  const frames = l1Frames(...args);
  let next = frames.next();
  while (!next.done) { args[0].update(); next = frames.next(); }
  return next.value;
}
