import { expect, test } from 'vitest';
import { SpatialHash, type ContactCells } from '../../../src/sim/spatial/SpatialHash';

test.each([2, 4])('%d m cells retain both radius policies across alternating queries and inserts', cellSize => {
  const hash = new SpatialHash(cellSize), calls = [0, 0], maxima = [0, 0];
  hash.set(1, .1, .1); hash.set(2, .2, .2);
  const policy = (index: number): ContactCells => ({ epoch: 1,
    radius: id => { calls[index]++; return id === 3 ? 2 - index : .3 + index; },
    intersects: maximum => { maxima[index] = maximum; return true; },
  });
  const a = policy(0), b = policy(1), query = { x: 0, z: 0, r: 2 };
  for (const p of [a, b, a, b]) expect(hash.query(query, [], false, undefined, p)).toEqual([1, 2]);
  expect(calls).toEqual([2, 2]);
  hash.set(3, .3, .3);
  for (const p of [a, b]) expect(hash.query(query, [], false, undefined, p)).toEqual([1, 2, 3]);
  expect(calls).toEqual([3, 3]); expect(maxima).toEqual([2, 1.3]);
  a.epoch++;
  hash.query(query, [], false, undefined, a); hash.query(query, [], false, undefined, b);
  expect(calls).toEqual([6, 3]);
});

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

test('queries retain live membership, nested visits and reset order', () => {
  const hash = new SpatialHash(2), query = { x: 0, z: 0, r: 6 };
  hash.set(9, -1, 0); hash.set(2, 0, 0); hash.set(7, .2, 0);
  expect(hash.query(query, [], false)).toEqual([9, 2, 7]);
  // Refill an empty bucket, then insert a previously unseen bucket.
  hash.delete(9); hash.set(5, -1, 0); hash.set(3, 3, 0);
  expect(hash.query(query, [], false)).toEqual([5, 2, 7, 3]);
  const visited: number[] = [];
  hash.query(query, [], false, id => {
    visited.push(id);
    expect(hash.query({ x: 100, z: 100, r: 1 })).toEqual([]);
  });
  expect(visited).toEqual([5, 2, 7, 3]);
  // A move within a bucket must expose the latest coordinates.
  hash.set(7, 1.9, 1.9);
  expect(hash.query({ x: 0, z: 0, r: .5 })).toEqual([2]);
  hash.reset(); hash.set(10, 0, 0);
  expect(hash.query(query, [], false)).toEqual([10]);
});
