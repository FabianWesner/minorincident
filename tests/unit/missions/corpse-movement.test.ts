import { expect, test } from 'vitest';
import { emptyInput } from '../../../src/input/InputFrame';
import { SimWorld } from '../../../src/sim/world/SimWorld';

test('the courier walks through retained corpses without losing movement or any body', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 3);
  try {
    const ai = world.infected!; for (const e of [...ai.active]) ai.release(e);
    ai.director.ambientTarget = 0; ai.director.queue.length = 0;
    const ids: number[] = [];
    for (let x = 1; x <= 6; x++) {
      const id = ai.spawn('infected.runner', { x, z: 0 }); ids.push(id);
      world.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: x, actionId: 'burn', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 9999, multiplier: 1, type: 'status', knockback: 0, stagger: 0, permanent: true });
    }
    for (let tick = 0; tick < 125; tick++) world.update();
    expect(ids.every(id => world.entities.get(id)?.corpse)).toBe(true);
    const frame = emptyInput(); frame.move = { x: 1, z: 0 };
    for (let tick = 0; tick < 180; tick++) { world.applyInput(frame, 'keyboard'); world.update(); }
    expect(world.entities.get(1)!.transform.x).toBeGreaterThan(7);
    expect(ids.every(id => world.entities.get(id)?.corpse)).toBe(true);
  } finally { world.dispose(); }
});

test('a retained Alpha corpse has a solid footprint while small human corpses stay passable', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 3);
  try {
    const ai = world.infected!; for (const e of [...ai.active]) ai.release(e);
    ai.director.ambientTarget = 0; ai.director.queue.length = 0;
    const human = ai.spawn('infected.runner', { x: 2, z: 0 });
    const alpha = ai.spawn('infected.alpha', { x: 5, z: 0 });
    for (const [id, attackId] of [[human, 1], [alpha, 2]] as const) world.combat!.damage.apply({ sourceId: 1, targetId: id, attackId, actionId: 'burn', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 9999, multiplier: 1, type: 'status', knockback: 0, stagger: 0, permanent: true });
    for (let tick = 0; tick < 125; tick++) world.update();
    expect(world.entities.get(human)?.corpse).toBe(true);
    expect(world.entities.get(alpha)?.corpse).toBe(true);
    expect(world.solids.clear({ x: 2, y: .7, z: 0 }, .35, 1), 'small corpse remains walkable').toBe(true);
    expect(world.solids.clear({ x: 5, y: .7, z: 0 }, .35, 1), 'Alpha corpse blocks the courier footprint').toBe(false);
    const frame = emptyInput(); frame.move = { x: 1, z: 0 };
    for (let tick = 0; tick < 180; tick++) { world.applyInput(frame, 'keyboard'); world.update(); }
    const courier = world.entities.get(1)!.transform;
    expect(courier.x).toBeGreaterThan(3);
    expect(courier.x).toBeLessThan(4.5);
  } finally { world.dispose(); }
});
