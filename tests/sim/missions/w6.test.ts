import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { buildScene } from '../../../src/debug/scenelab/spec';
import { worldTiers } from '../../../src/levels/districts/types';
import { validateMission } from '../../../src/sim/missions/schema';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { missionSandbox } from '../../fixtures/scenarios/mission-sandbox';

test('T-E29-16-tier @E29-AC16 checkpoint restores W6 mission/world tier, navigation and weapon ownership', async () => {
  const built = buildScene({ tier: 6, ground: 'asphalt', actors: [{ kind: 'courier', at: [0, 0] }] }, new Map((manifest as AssetDef[]).map(a => [a.id, a])));
  const def = missionSandbox('custom'); def.actors = {}; def.groups = {}; def.onStart = [{ kind: 'tier', tier: 6 }];
  expect(validateMission(def)).toEqual([]);
  const world = new SimWorld(); await world.init();
  try {
    world.loadComposition(built.composition, [built.layout], 1);
    const mission = world.loadMission(def); mission.begin();
    const originalHash = world.districts!.nav.hash;
    const originalWeapons = structuredClone(world.entities.get(1)!.weapons);
    for (const tier of worldTiers) {
      mission.state.tier = tier; world.setTier(tier); mission.checkpoint('C');
      expect(JSON.parse(JSON.stringify(mission.state)).tier).toBe(tier);
      mission.state.tier = tier === 6 ? 0 : 6; world.setTier(mission.state.tier);
      mission.restore('C');
      expect(world.districts!.composition.tier).toBe(tier); expect(mission.state.tier).toBe(tier);
      expect(world.districts!.nav.hash).toBe(originalHash);
      expect(world.entities.get(1)!.weapons).toEqual(originalWeapons);
    }
  } finally { world.dispose(); }
});
