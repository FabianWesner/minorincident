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

test('the companion follows around a large corpse without crossing its footprint', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 3);
  try {
    const ai = world.infected!; for (const e of [...ai.active]) ai.release(e);
    ai.director.ambientTarget = 0; ai.director.queue.length = 0;
    const id = ai.spawn('infected.alpha', { x: 5, z: 0 });
    world.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: 1, actionId: 'burn', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 9999, multiplier: 1, type: 'status', knockback: 0, stagger: 0, permanent: true });
    for (let tick = 0; tick < 125; tick++) world.update();
    const companion = world.entities.get(world.npcs!.companion.spawn())!;
    world.npcs!.companion.forceSafe = true;
    world.solids.relocate(companion, { x: 0, y: .3, z: 0 }, 'test.companion');
    world.solids.relocate(world.entities.get(1)!, { x: 9, y: .7, z: 0 }, 'test.player');
    let nearest = Infinity;
    for (let tick = 0; tick < 600; tick++) { world.update(); nearest = Math.min(nearest, Math.hypot(companion.transform.x - 5, companion.transform.z)); }
    expect(nearest, 'the corgi must respect the dead Alpha footprint').toBeGreaterThan(1.3);
    expect(companion.transform.x, 'the corgi must reach the far side rather than remain stuck at the body').toBeGreaterThan(6);
  } finally { world.dispose(); }
});

test('Mega and every zoo species retain a solid corpse for courier and companion queries', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 3);
  try {
    const ai = world.infected!; for (const e of [...ai.active]) ai.release(e);
    ai.director.ambientTarget = 0; ai.director.queue.length = 0;
    const companion = world.npcs!.companion.spawn();
    const ids = ['alpha', 'lion', 'gorilla', 'elephant', 'zebra', 'flamingo'].map((name, i) => ai.spawn(`infected.${name}`, { x: 6 + i * 5, z: 8 }, name === 'alpha' ? { variant: 'inf.mega-alpha' } : {}));
    for (const id of ids) world.combat!.damage.apply({ sourceId: 1, targetId: id, attackId: id, actionId: 'burn', origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 99999, multiplier: 1, type: 'status', knockback: 0, stagger: 0, permanent: true });
    for (let tick = 0; tick < 125; tick++) world.update();
    for (const id of ids) {
      const body = world.entities.get(id)!; expect(body.corpse).toBe(true);
      expect(world.solids.clear(body.transform, .35, 1), body.archetype).toBe(false);
      expect(world.solids.clear({ ...body.transform, y: .3 }, .44, companion), `${body.archetype} / corgi`).toBe(false);
    }
  } finally { world.dispose(); }
});
