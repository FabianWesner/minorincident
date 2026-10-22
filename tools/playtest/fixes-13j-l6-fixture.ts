import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { applyCampaign } from '../../src/sim/progression/apply';
import { preset } from '../../src/sim/progression/Campaign';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { LevelSixBot } from '../../src/debug/bot/LevelSixBot';
import { followFrustum } from '../sim-runner/l3Bots';
import { playtestSave } from './startup';

/** Reach the L6 result through the production simulation policy, without objective hooks.
 * This precondition keeps the browser regression about the handover itself.
 */
const destination = process.argv[2];
assert.ok(destination, 'Usage: fixes-13j-l6-fixture.ts <result-fixture.json.gz>');
const world = new SimWorld();
try {
  await world.init();
  world.loadComposition(compositions.L6, [JSON.parse(readFileSync('public/assets/layouts/D-SUBWAY.layout.json', 'utf8'))], 1);
  world.infected!.director.setTier('low'); world.npcs!.setQuality('low');
  const campaign = playtestSave(preset('L6-default'), 'male', 'weapons');
  campaign.settings.quality = 'low';
  applyCampaign(world, campaign);
  const mission = world.loadMission(resolveCampaignMission('L6', world.districts!)); mission.begin();
  const bot = new LevelSixBot(world, 'complete');
  for (let tick = 0; tick < 1200 * 60 && mission.state.phase !== 'result'; tick++) {
    followFrustum(world); world.applyInput(bot.sample(), 'keyboard'); world.update();
  }
  assert.equal(mission.state.phase, 'result', 'The ordinary policy must actually reach the L6 result');
  completeCampaignLevel(campaign, 6, mission.state.result!, world);
  // Reproduce the reported L7 entry loadout; the preceding L6 route uses its normal arsenal.
  world.combat!.setLoadout(['weapon.fists'], ['weapon.kick']);
  campaign.racks = { LEFT: ['weapon.fists'], RIGHT: ['weapon.kick'] };
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, gzipSync(JSON.stringify({ campaign, resume: mission.saveResume() })));
  console.log(JSON.stringify({ tick: world.tick, rescued: mission.state.result!.rescued, deaths: mission.state.stats.deaths, destination }));
} finally { world.dispose(); }
