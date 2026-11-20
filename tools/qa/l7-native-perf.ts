/** Native L7 simulation timing proxy; this does not measure rendered frames. */
import { performance } from 'node:perf_hooks';
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';

for (const [tier, cap] of [['high', 200], ['high', 240], ['low', 100]] as const) {
  const campaign = preset('L7-default'); campaign.settings.quality = tier;
  const times: number[] = []; let peak = 0, arrivals = 0;
  const run = await runLevel('L7', 'complete', 1, 180, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      // The shared director halves the configured value for LOW.
      world.infected!.director.levelCap = tier === 'low' ? cap * 2 : cap;
      const update = world.update.bind(world);
      world.update = (...args: Parameters<typeof world.update>) => {
        const start = performance.now();
        try { return update(...args); } finally { times.push(performance.now() - start); }
      };
      world.events.on('sim.tick', () => { peak = Math.max(peak, world.infected!.director.count); });
    },
    beforeDispose: world => { arrivals = world.l7Encounters!.state.arrivals.filter(a => !a.alpha).length; },
  });
  times.sort((a, b) => a - b);
  const percentile = (p: number) => times[Math.floor((times.length - 1) * p)];
  console.log(JSON.stringify({ tier, cap, completed: run.completed, deaths: run.deaths, saved: run.survivorsSaved, total: run.survivorsTotal, arrivals, peak, ticks: times.length, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99) }));
}
