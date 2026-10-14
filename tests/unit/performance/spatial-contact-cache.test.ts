import { expect, test } from 'vitest';
import { SpatialHash, type ContactCells } from '../../../src/sim/spatial/SpatialHash';

test('contact buckets retain filtered query order through moves, deletion, reuse and epoch changes', () => {
  const hash = new SpatialHash(), radii = new Map<number, number>();
  const contacts: ContactCells = { epoch: 1, radius: id => radii.get(id) ?? 0, intersects: maximum => maximum > 0 };
  for (let id = 1; id <= 160; id++) { hash.set(id, id % 8 - 4, Math.floor(id / 8) % 8 - 4); radii.set(id, id % 5 === 0 ? .35 : 0); }
  const check = () => {
    for (const x of [-5, -1, 1, 5]) for (const z of [-5, -1, 1, 5]) {
      const query = { x, z, r: 7 }, expected = hash.query(query, [], false).filter(id => contacts.radius(id) > 0), actual: number[] = [];
      hash.query(query, [], false, id => actual.push(id), contacts);
      expect(actual).toEqual(expected);
    }
  };
  check();
  // Leave and re-enter a populated bucket: insertion order changes, including within one contact epoch.
  for (const id of [5, 10, 15, 20]) { hash.set(id, 10, 10); check(); hash.set(id, 1, 1); check(); }
  for (const id of [5, 25, 30]) { hash.delete(id); check(); hash.set(id, -1, 2); check(); }
  for (let id = 1; id <= 160; id++) radii.set(id, id % 3 === 0 ? .7 : 0);
  contacts.epoch++; check();
  hash.delete(9); hash.set(999, 1, 2); radii.set(999, .8); contacts.epoch++; check();
  contacts.radius = id => id % 7 === 0 ? .4 : 0; check();
});

test('contact cache preserves full horde simulation state against unfiltered spatial queries', async () => {
  const { SimWorld } = await import('../../../src/sim/world/SimWorld');
  const actual = new SimWorld(), reference = new SimWorld();
  try {
    await actual.init(); await reference.init();
    const query = reference.spatial.query;
    reference.spatial.query = function (within, result, sorted, visit) { return query.call(this, within, result, sorted, visit); };
    actual.loadScenario('perf-horde-100', 2); reference.loadScenario('perf-horde-100', 2);
    for (let tick = 1; tick <= 300; tick++) {
      actual.update(); reference.update();
      if (tick % 60 === 0) expect(actual.getState()).toEqual(reference.getState());
    }
  } finally { actual.dispose(); reference.dispose(); }
});
