import { expect, test } from 'vitest';
import { loadL5 } from '../../../tools/sim-runner/l5Bots';

// PO 2026-10-15 (verbatim): "L5: I cannot take the weapon. When I click it nothnig happens."
test('T-E23-12-click @E23 @E23-AC12 clicking the cellar shelf shotgun walks over and collects it without E', async () => {
  const { world } = await loadL5(1);
  const pickup = [...world.entities.iterate()].find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === 'weapon.shotgun')!;
  expect(pickup, 'cellar shotgun spawned').toBeDefined();
  const at = { x: pickup.transform.x, z: pickup.transform.z };
  world.setInput({ moveTarget: at, pointerGround: true });
  world.update();
  world.setInput({ moveTarget: undefined, pointerGround: false });
  for (let t = 0; t < 600 && world.entities.get(pickup.id); t++) world.update();
  expect(world.entities.get(pickup.id), 'shotgun collected within 10 s of one click').toBeUndefined();
  expect(world.combat!.runner.loadout.current('RIGHT').id).toBe('weapon.shotgun');
  const p = world.entities.get(1)!.transform;
  expect(Math.hypot(p.x - at.x, p.z - at.z), 'the courier stays in the cellar by the shelf').toBeLessThan(3);
});
