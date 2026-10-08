import { expect, test } from 'vitest';
import { arena, equip } from './helpers';
import { emptyInput } from '../../../src/input/InputFrame';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

/** One released LMB click on `id`, as InputSystem resolves a click on a drawn body. */
function click(w: SimWorld, id: number) {
  const frame = emptyInput(); frame.aimSource = 'pointer'; frame.pointerTarget = true; frame.mouseAttack = true; frame.cancelMove = true;
  frame.left = { down: true, held: false, up: true }; frame.attackTarget = { id, side: 'LEFT' };
  w.applyInput(frame, 'mouse-only'); w.update();
}
function idle(w: SimWorld, ticks: number) {
  for (let i = 0; i < ticks; i++) { const frame = emptyInput(); frame.aimSource = 'pointer'; frame.pointerTarget = true; w.applyInput(frame, 'mouse-only'); w.update(); }
}
const attacks = (w: SimWorld) => w.events.events().filter(e => e.type === 'combat.attack' && e.sourceId === 1);

for (const weapon of ['weapon.bat', 'weapon.fists']) for (const delay of [1, 4, 8, 12, 16]) {
  test(`@E05 P1 a click ${delay} ticks into a ${weapon} swing queues the next swing (Diablo input buffer), feet planted`, async () => {
    const w = await arena(); equip(w, [weapon]);
    const id = w.spawnDummy('infected.runner', { x: 1.2, z: 0 }, { hp: 1000 });
    const start = { ...w.entities.get(1)!.transform };
    click(w, id); expect(attacks(w)).toHaveLength(1);
    idle(w, delay - 1);
    const running = w.combat!.runner.running.LEFT!;
    expect(w.tick).toBeLessThan(running.endsAt);
    click(w, id); idle(w, running.endsAt - w.tick + 3);
    const list = attacks(w);
    expect(list, 'queued click swung').toHaveLength(2);
    expect(list[1].tick - running.endsAt).toBeLessThanOrEqual(1);
    const p = w.entities.get(1)!.transform;
    expect(Math.hypot(p.x - start.x, p.z - start.z), 'an attack click in reach never moves the courier').toBeLessThan(.02);
    idle(w, 60); expect(attacks(w), 'one click, one swing').toHaveLength(2);
  });
}

test('@E05 P1 a click on a downed infected swings at it and restarts its down time (PO 10-08), once per click', async () => {
  const w = await arena(); equip(w, ['weapon.bat']); w.loadScenario('horde-arena', 1); equip(w, ['weapon.bat']);
  w.infected!.configureL1v2();
  const id = w.infected!.spawn('infected.runner', { x: 1.2, z: 0 }, { state: 'idle' });
  const target = w.entities.get(id)!;
  for (let i = 0; i < 6 && target.health.current > 0; i++) { click(w, id); idle(w, 30); }
  expect(target.health.current).toBe(0); expect(target.infected!.recoverAt).toBeGreaterThan(w.tick);
  idle(w, 60);
  const before = target.infected!.recoverAt, swings = attacks(w).length;
  click(w, id); idle(w, 30);
  expect(attacks(w).length, 'the ground click swings').toBe(swings + 1);
  expect(target.infected!.recoverAt, 'down time restarted').not.toBe(before);
  expect(target.infected!.recoverAt - w.tick).toBeGreaterThan(9 * 60);
  idle(w, 60); expect(attacks(w).length, 'no repeat without a new click').toBe(swings + 1);
});

test('@E05 P1 a held LMB on a live target stops when it goes down (no endless ground hits)', async () => {
  const w = await arena(); w.loadScenario('horde-arena', 1); equip(w, ['weapon.bat']);
  const id = w.infected!.spawn('infected.runner', { x: 1.2, z: 0 }, { state: 'idle' });
  const target = w.entities.get(id)!;
  for (let i = 0; i < 240; i++) {
    const frame = emptyInput(); frame.aimSource = 'pointer'; frame.pointerTarget = true; frame.mouseAttack = true;
    frame.left = { down: i === 0, held: true, up: false }; if (i === 0) frame.attackTarget = { id, side: 'LEFT' };
    w.applyInput(frame, 'mouse-only'); w.update();
  }
  expect(target.health.current).toBe(0);
  const downAt = w.events.events().find(e => e.type === 'combat.kill' && e.targetId === id)!.tick;
  expect(attacks(w).filter(e => e.tick > downAt + 1)).toHaveLength(0);
});
