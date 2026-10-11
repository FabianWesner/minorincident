import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import type { Game } from '../../../src/Game';
import { SceneLab } from '../../../src/debug/scenelab/SceneLab';
import { buildScene } from '../../../src/debug/scenelab/spec';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { SimWorld } from '../../../src/sim/world/SimWorld';

function fixture(asset = 'prop.fire-hydrant') {
  const world = new SimWorld();
  const built = buildScene({ props: [{ id: 'obstacle', asset, at: [0, 0] }] }, new Map((manifest as AssetDef[]).map(a => [a.id, a])));
  world.districts = new DistrictWorld(built.composition, [built.layout], 1);
  const actor = world.entities.create({ kind: 'civilian', archetype: 'npc.civilian-woman-a', transform: { x: 0, y: .7, z: 0, yaw: 0 }, faction: 'civilian', health: { current: 100, max: 100 } });
  actor.civilian = { state: 'calm' } as NonNullable<typeof actor.civilian>;
  return { world, actor, lab: new SceneLab({ world } as Game) };
}

test('capsule metric records consecutive ticks independently of navigation and does not double count a tick', () => {
  const { world, actor, lab } = fixture();
  expect(lab.samplePropPenetration(true).framesMax).toBe(1);
  expect(lab.samplePropPenetration().framesMax).toBe(1);
  world.tick++; expect(lab.samplePropPenetration().framesMax).toBe(2);
  world.tick++; expect(lab.samplePropPenetration().framesMax).toBe(3);
  actor.transform.x = 4; world.tick++;
  expect(lab.samplePropPenetration().pairs[0].run).toBe(0);
  actor.transform.x = 0; world.tick++;
  expect(lab.samplePropPenetration().pairs[0]).toMatchObject({ run: 1, max: 3, frames: 4 });
});

test('downed civilians and building interiors have no street-furniture walking capsule intersection', () => {
  const { actor, lab } = fixture(); actor.civilian!.state = 'finished';
  expect(lab.samplePropPenetration(true)).toMatchObject({ samples: 0, framesMax: 0 });
  const building = fixture('bld.house-a');
  const wall = building.world.districts!.districts[0].decay.colliders.find(c => !c.walkable)!.aabb;
  building.actor.transform.x = (wall.min[0] + wall.max[0]) / 2; building.actor.transform.z = (wall.min[2] + wall.max[2]) / 2;
  expect(building.lab.samplePropPenetration(true).framesMax).toBe(0);
});
