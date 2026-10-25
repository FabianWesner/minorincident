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
