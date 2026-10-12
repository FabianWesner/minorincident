import RAPIER from '@dimforge/rapier3d-compat';
import { afterEach, expect, test } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL5 } from '../../tools/sim-runner/l5Bots';
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); });
test('T-E23-12d @E23 @E23-AC12 basement shotgun rests on the shelf within 3 m, can be reached from the aisle and disappears on collection', async () => {
  const loaded = await loadL5(1); world = loaded.world;
  const start = loaded.mission.def.anchors['l5-cellar-in'];
  const companion = world.entities.values().find(e => e.companion)!;
  expect(world.infected!.nav.clear(companion.transform.x, companion.transform.z, companion.combat?.radius ?? .4)).toBe(true);
  const shelf = loaded.mission.def.anchors['l5-shotgun'];
  expect(shelf).toBeDefined();
  expect(Math.hypot(shelf.x - start.x, shelf.z - start.z)).toBeLessThanOrEqual(3);
  const pickup = world.entities.values().find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === 'weapon.shotgun')!;
  expect(pickup.transform).toMatchObject({ x: shelf.x, z: shelf.z });
  expect(pickup.pickup && 'actionId' in pickup.pickup && pickup.pickup.surfaceY).toBeCloseTo(.385);
  const player = world.entities.get(1)!;
  const at = { x: shelf.x + .95, y: player.transform.y, z: shelf.z };
  Object.assign(player.transform, at); world.physics.playerBody!.setTranslation(at, true); world.physics.playerBody!.setNextKinematicTranslation(at);
  world.spatial.set(1, at.x, at.z);
  const input = emptyInput(); input.interact = true;
  for (let i = 0; i < 38; i++) { world.applyInput(input, 'keyboard'); world.update(); }
  expect(world.entities.get(pickup.id)).toBeUndefined();
  expect(player.weapons!.RIGHT.rack.map(s => s.id)).toContain('weapon.shotgun');
  expect(player.weapons!.RIGHT.rack[player.weapons!.RIGHT.index].id).toBe('weapon.shotgun');
});
test('T-E23-15d @E23 @E23-AC15 metro closure enables the matching passage collider at the end of the visible descent', async () => {
  const loaded = await loadL5(1); world = loaded.world;
  const m = loaded.mission;
  expect(m.def.gates['l5-metro-shutter'].open).toBe(true);
  const anchor = m.def.anchors['l5-metro-shutter'];
  expect(anchor.z).toBeCloseTo(-47.13);
  m.completeObjective('emerge'); for (let i = 0; i < 661; i++) world.update();
  m.completeObjective('look');
  // Fixture starts the district's closing animation; encounter lane owns physical follower ingress.
  m.state.l5!.shutterAt = world.tick; m.state.l5!.phase = 'shelter';
  for (let i = 0; i < 119; i++) world.update();
  expect(m.state.gates['l5-metro-shutter']).toBe(true);
  world.update(); expect(m.state.gates['l5-metro-shutter']).toBe(false);
  let blocked = false;
  const ray = new RAPIER.Ray({ x: anchor.x, y: 1.2, z: anchor.z + 1 }, { x: 0, y: 0, z: -1 });
  world.physics.world!.forEachCollider(c => {
    if (Math.abs(c.translation().z - anchor.z) < .01 && Math.abs(c.translation().x - anchor.x) < .01) blocked ||= c.isEnabled() && c.castRay(ray, 2, true) >= 0;
  });
  expect(blocked).toBe(true);
});
