// L7 at 3x density (PO 11-26): why seeds 2/3 end as mission-failed (3 deaths or collision invariant).
import { runLevel } from '../../sim-runner/levels';
for (const seed of [2, 3]) {
  const r = await runLevel('L7', 'complete', seed);
  console.log('seed', seed, r.outcome, Math.round(r.time), 'deaths', r.deaths, JSON.stringify(r.failures), (r.blocker?.detail ?? '').slice(0, 300));
}
process.exit(0);
