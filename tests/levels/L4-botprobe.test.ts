import { mkdirSync, writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

/** Measurement probe (not a gate): one complete-bot pass with the death log. */
test.skipIf(!process.env.L4_PROBE)('L4 complete bot probe', async () => {
  const seed = Number(process.env.L4_SEED ?? 3);
  const l = await loadL4(seed);
  const r = runL4(l.world, l.mission, 'complete', { seed, maxSeconds: 800 });
  const out = { outcome: r.outcome, simSeconds: r.simSeconds, deaths: r.deaths, deathsAt: r.deathsAt, timeline: r.timeline, breakAfterS: r.breakAfterS, soldiersAtBreak: r.soldiersAtBreak };
  mkdirSync('test-results/epics/E22', { recursive: true }); writeFileSync(`test-results/epics/E22/bot-probe-${seed}.json`, JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out));
  l.world.dispose();
}, 1_800_000);
