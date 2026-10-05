import { expect, test } from 'vitest';
import { Clock } from '../../src/core/Clock';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { stateHash } from '../../src/sim/world/stateHash';
import { scriptedInput } from '../fixtures/inputScript';

test('T-E01-02 @E01 @E01-AC02 600 ticks match at 30, 60 and 144 render Hz', async () => {
  const hashes: string[] = [];
  for (const fps of [30, 60, 144]) {
    const world = new SimWorld(); await world.init(); world.loadScenario('empty', 1);
    const clock = new Clock();
    for (let frame = 0; frame < fps * 10; frame++) clock.advance(1 / fps, () => {
      world.setInput(scriptedInput(world.tick)); world.update();
    });
    expect(world.tick).toBe(600);
    hashes.push(stateHash(world.getState())); world.dispose();
  }
  expect(new Set(hashes).size).toBe(1);
});

test('T-E01-04 @E01 @E01-AC04 same seed and script give the same 3600-tick state', async () => {
  const hashes: string[] = [];
  for (const seed of [1, 1, 42]) {
    const world = new SimWorld(); await world.init(); world.loadScenario('empty', seed);
    for (let tick = 0; tick < 3600; tick++) { world.setInput(scriptedInput(tick)); world.update(); }
    expect(world.getState().player?.transform.y).toBeCloseTo(0.5, 1);
    hashes.push(stateHash(world.getState()));
    const state = world.getState(); state.entities[0].transform.x = 999;
    expect(world.getState().entities[0].transform.x).not.toBe(999);
    world.reset();
    expect(world.getState().perf).toEqual({ entities: 0, bodies: 0, colliders: 0, listeners: 0 });
    world.dispose();
  }
  expect(hashes[0]).toBe(hashes[1]); expect(hashes[0]).not.toBe(hashes[2]);
});

test('S-05-foundation @smoke empty scripted 1800-tick golden hash', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('empty', 1);
  try {
    for (let tick = 0; tick < 1800; tick++) { world.setInput(scriptedInput(tick)); world.update(); }
    expect(stateHash(world.getState())).toBe('4e5fda97');
  } finally { world.dispose(); }
});
