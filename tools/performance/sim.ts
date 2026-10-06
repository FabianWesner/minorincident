import { SimWorld } from '../../src/sim/world/SimWorld';
/** Warm JIT/physics before sampling. Every measured tick retains the full living horde. */
export async function measureHorde(scenario: 'perf-horde-200' | 'perf-horde-100', ticks = 600, seed = 1) {
  if (!Number.isSafeInteger(ticks) || ticks <= 0) throw new RangeError('Perf measurement needs positive ticks');
  const world = new SimWorld();
  try {
    await world.init(); world.loadScenario(scenario, seed);
    for (let i = 0; i < 120; i++) world.update();
    const times = new Float64Array(ticks); let minInfected = Infinity;
    for (let i = 0; i < ticks; i++) {
      const start = performance.now(); world.update(); times[i] = performance.now() - start;
      minInfected = Math.min(minInfected, world.infected!.director.count);
    }
    times.sort();
    return { scenario, seed, warmup: 120, ticks, minInfected, cap: world.infected!.director.cap, simMsP50: times[Math.ceil(ticks * .5) - 1], simMsP95: times[Math.ceil(ticks * .95) - 1], simMsMax: times[ticks - 1] };
  } finally { world.dispose(); }
}
