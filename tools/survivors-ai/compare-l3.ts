import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL3, runL3 } from '../sim-runner/l3Bots';

// The same complete policy, budgets and seeds on both heads; retain deaths as well as finish time.
const label = process.argv[2] ?? 'branch', rows = [];
for (const seed of [1, 2, 3]) {
  const { world, mission } = await loadL3(seed);
  try {
    const r = runL3(world, mission, 'complete', { seed, maxSeconds: 600 });
    const row = { label, seed, profile: r.profile, outcome: r.outcome, seconds: r.simSeconds, deaths: r.deaths, deathsAt: r.deathsAt, squad: r.squad };
    rows.push(row); console.log(JSON.stringify(row));
    mkdirSync('test-results/survivors-ai/compare-l3', { recursive: true });
    writeFileSync(`test-results/survivors-ai/compare-l3/${label}.json`, JSON.stringify(rows, null, 2) + '\n');
  } finally { world.dispose(); }
}
