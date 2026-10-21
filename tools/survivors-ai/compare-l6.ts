import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL6, runL6 } from '../sim-runner/l6Bots';

// Compare the real evacuation result and waiting/lost people separately. Identical seeds, budgets and policies on each head.
const label = process.argv[2] ?? 'branch', rows = [];
for (const seed of [1, 2, 3]) for (const profile of ['complete', 'evade-only'] as const) {
  const { world } = await loadL6(seed);
  let allyAttacks = 0;
  world.events.on('ally.attack', e => { if (e.type === 'ally.attack' && world.entities.get(e.sourceId)?.civilian?.survivor) allyAttacks++; });
  try {
    const r = runL6(world, profile, 600), lost = r.fates.filter(f => f.status === 'turned' || f.status === 'dead').length;
    const row = { label, seed, profile, outcome: r.outcome, seconds: r.simSeconds, deaths: r.deaths, rescued: r.rescued, total: r.total, lost, potentiallyRescued: r.total - lost, allyAttacks, fates: r.fates };
    rows.push(row); console.log(JSON.stringify(row));
    mkdirSync('test-results/survivors-ai/compare-l6', { recursive: true });
    writeFileSync(`test-results/survivors-ai/compare-l6/${label}.json`, JSON.stringify(rows, null, 2) + '\n');
  } finally { world.dispose(); }
}
