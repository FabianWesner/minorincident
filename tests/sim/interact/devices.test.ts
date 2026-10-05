import { expect, test } from 'vitest';
import { arena, step } from '../combat/helpers';
import { NavGrid } from '../../../src/sim/world/NavGrid';

function move(w: Awaited<ReturnType<typeof arena>>, x: number, z = 0) {
  const p = w.entities.get(1)!; Object.assign(p.transform, { x, z });
  w.physics.playerBody!.setTranslation(p.transform, true); w.spatial.set(1, x, z);
}
test('T-E11-01 @E11 @E11-AC01 ring fills, exit decays twice as fast and completion emits once', async () => {
  const w = await arena(), id = w.interactables!.spawn('switch', { x: 0, z: 0 }, { holdTime: 2 });
  step(w, 60); expect(w.entities.get(id)!.interactable!.progress).toBeCloseTo(.5);
  move(w, 4); step(w, 15); expect(w.entities.get(id)!.interactable!.progress).toBeCloseTo(.25);
  move(w, 0); step(w, 90); expect(w.entities.get(id)!.interactable!.progress).toBe(1);
  step(w, 120); expect(w.events.events().filter(e => e.type === 'interact.completed')).toHaveLength(1);
});
test('T-E11-01b @E11 @E11-AC01 instant input requires range and permission; nearest ring wins', async () => {
  const w = await arena(), a = w.interactables!.spawn('button', { x: .2, z: 0 }), b = w.interactables!.spawn('radio', { x: .8, z: 0 });
  w.setInput({ interact: true }); step(w, 1); w.clearInput();
  expect(w.entities.get(a)!.interactable!.completed).toBe(true); expect(w.entities.get(b)!.interactable!.progress).toBe(0);
  const c = w.interactables!.spawn('valve', { x: 5, z: 0 }, { instant: false, holdTime: 2 });
  move(w, 5); w.setInput({ interact: true }); step(w, 1);
  expect(w.entities.get(c)!.interactable!.progress).toBeCloseTo(1 / 120);
  move(w, 9); step(w, 120); expect(w.entities.get(c)!.interactable!.completed).toBe(false);
});
test('T-E11-02 @E11 @E11-AC02 accepted damage floors progress to a 25% notch only on interruptible devices', async () => {
  const w = await arena(), id = w.interactables!.spawn('generator', { x: 0, z: 0 }, { holdTime: 4, fuel: 10 });
  step(w, 155); w.player!.damage(1, w.tick);
  expect(w.entities.get(id)!.interactable!.progress).toBe(.5);
  w.entities.get(id)!.interactable!.interruptOnDamage = false;
  step(w, 65); const progress = w.entities.get(id)!.interactable!.progress;
  w.player!.damage(1, w.tick); expect(w.entities.get(id)!.interactable!.progress).toBe(progress);
});
test('T-E11-03 @E11 @E11-AC03 locked hint, key requirement, open/close and nav update in one tick', async () => {
  const w = await arena(), nav = new NavGrid([-3, -1], [4, 2]); nav.cells.fill(1); w.interactables!.nav = nav;
  const id = w.interactables!.spawn('door', { x: 1, z: 0 }, { key: 'key.house', halfX: .4, halfZ: 2 });
  expect(nav.flood([-2, 0])[nav.index(3, 0)]).toBe(0);
  w.setInput({ interact: true }); step(w, 1);
  expect(w.entities.get(id)!.interactable!.hint).toBe('locked');
  expect(w.entities.get(id)!.interactable!.open).toBe(false);
  w.interactables!.giveItem('key.house'); step(w, 1); w.clearInput();
  expect(w.entities.get(id)!.interactable!.open).toBe(true);
  expect(nav.flood([-2, 0])[nav.index(3, 0)]).toBe(1);
  expect(w.events.events().filter(e => e.type === 'world.blocker.changed')).toMatchObject([{ id, blocked: true, tick: 0 }, { id, blocked: false, tick: w.tick }]);
  const colliderCount = w.physics.colliderCount;
  step(w, 120); expect(w.entities.get(id)!.interactable!.open).toBe(true);
  move(w, -3); step(w, 1); move(w, 0); w.setInput({ interact: true }); step(w, 1);
  expect(w.entities.get(id)!.interactable!.open).toBe(false);
  expect(w.physics.colliderCount).toBe(colliderCount + 1);
});
test('T-E11-devices @E11 generator fuel conditions and all objective device types complete', async () => {
  const w = await arena(), g = w.interactables!.spawn('generator', { x: 0, z: 0 });
  w.setInput({ interact: true }); step(w, 1); expect(w.entities.get(g)!.interactable!.hint).toBe('fuel');
  w.interactables!.refuel(g, 2); step(w, 1); w.clearInput();
  expect(w.entities.get(g)!.interactable!.powered).toBe(true);
  w.interactables!.refuel(g, 1); step(w, 120); expect(w.entities.get(g)!.interactable!.powered).toBe(true);
  expect(w.events.events().filter(e => e.type === 'interact.completed' && e.id === g)).toHaveLength(1);
  step(w, 60); expect(w.entities.get(g)!.interactable!.powered).toBe(false);
  move(w, 10);
  for (const kind of ['breaker', 'lever', 'valve', 'button', 'radio', 'rescue', 'car-door', 'gate'] as const) {
    const id = w.interactables!.spawn(kind, { x: 10, z: 0 }, { requires: [`fuse.${kind}`] });
    w.setInput({ interact: true }); step(w, 1); expect(w.entities.get(id)!.interactable!.completed).toBe(false);
    w.interactables!.giveItem(`fuse.${kind}`); step(w, 1); w.clearInput();
    expect(w.entities.get(id)!.interactable!.completed).toBe(true);
    move(w, 20); step(w, 1); move(w, 10);
    // Completed doors re-arm only on exit; keep them out of subsequent selections.
    w.entities.get(id)!.interactable!.enabled = false;
  }
});
