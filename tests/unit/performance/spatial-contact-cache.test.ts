import { expect, test } from 'vitest';

// The bucket-order test for phone-perf's filtered contact buckets was dropped with that SpatialHash rewrite (main's contact cells only bound cells;
// callers filter radii). The simulation-equivalence test below covers both.
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
