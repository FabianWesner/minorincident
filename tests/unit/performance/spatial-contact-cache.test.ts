import { expect, test } from 'vitest';
import { SpatialHash } from '../../../src/sim/spatial/SpatialHash';

test.each([2, 4])('%d m cells retain exact circle queries across negative cell edges and moves', cellSize => {
  const hash = new SpatialHash(cellSize), positions = new Map<number, { x: number; z: number }>();
  for (let id = 1; id <= 80; id++) {
    const p = { x: (id % 13 - 6) * .4, z: (Math.floor(id / 13) - 3) * .7 };
    positions.set(id, p); hash.set(id, p.x, p.z);
  }
  for (const id of [1, 7, 21]) { const p = { x: -4 + id * .001, z: 2 - id * .001 }; positions.set(id, p); hash.set(id, p.x, p.z); }
  hash.delete(12); positions.delete(12);
  for (const x of [-4.001, -4, -3.999, -2, 0, 1.999, 2, 2.001]) for (const z of [-2.001, -2, 0, 2]) for (const r of [0, .35, .7, 1.2, 2.6, 6]) {
    const expected = [...positions].filter(([, p]) => (p.x - x) ** 2 + (p.z - z) ** 2 <= r * r).map(([id]) => id).sort((a, b) => a - b);
    expect(hash.query({ x, z, r })).toEqual(expected);
    const visited: number[] = [];
    hash.query({ x, z, r }, [], false, id => { visited.push(id); return false; });
    expect(visited).toEqual(hash.query({ x, z, r }, [], false).slice(0, 1));
  }
});

// The bucket-order test for phone-perf's filtered contact buckets was dropped with that SpatialHash rewrite (main's contact cells only bound cells;
// callers filter radii). The simulation-equivalence test below covers both.
test.each([false, true])('contact cache preserves horde state against unfiltered queries (mixed zoo: %s)', async mixed => {
  const { SimWorld } = await import('../../../src/sim/world/SimWorld');
  const actual = new SimWorld(), reference = new SimWorld();
  try {
    await actual.init(); await reference.init();
    const contactIndex = (reference.solids as unknown as { bodyIndex: SpatialHash }).bodyIndex;
    for (const index of [reference.spatial, contactIndex]) {
      const query = index.query;
      index.query = function (within, result, sorted, visit) { return query.call(this, within, result, sorted, visit); };
    }
    const specials: { world: typeof actual; ids: number[] }[] = [];
    for (const world of [actual, reference]) {
      world.loadScenario(mixed ? 'perf-horde-200' : 'perf-horde-100', 2);
      if (mixed) {
        const ids = world.infected!.active.slice(0, 20).map((old, i) => {
          const at = { x: old.transform.x, z: old.transform.z }; world.infected!.release(old);
          return world.infected!.spawn(i % 2 ? 'infected.gorilla' : 'infected.elephant', at, { state: 'chase' });
        });
        specials.push({ world, ids });
      }
    }
    for (let tick = 1; tick <= 300; tick++) {
      if (tick % 90 === 1) for (const { world, ids } of specials) for (const [i, id] of ids.entries()) {
        const e = world.entities.get(id)!, p = world.entities.get(1)!;
        world.infected!.startSpecial(id, i % 2 ? 'gorilla.grab-throw' : 'elephant.charge', { id: 1, x: p.transform.x, z: p.transform.z }, { x: e.transform.x, z: e.transform.z, radius: 1, dx: 1, dz: 0 });
      }
      actual.update(); reference.update();
      if (tick % 60 === 0) expect(actual.getState()).toEqual(reference.getState());
    }
  } finally { actual.dispose(); reference.dispose(); }
});
