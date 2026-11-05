import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL5, runL5 } from '../sim-runner/l5Bots';

/** Fixed PO comparison: no cheats, identical seeds/profiles/budgets on main and this lane. Does not change any balance pin. */
const label = process.argv[2] ?? 'branch';
const reports = [];
for (const seed of [1, 2, 3]) for (const profile of ['complete', 'newbie', 'evade-only'] as const) {
  const { world, mission } = await loadL5(seed);
  let allyAttacks = 0;
  const armed = new Set<string>();
  world.events.on('ally.attack', e => { if (e.type === 'ally.attack' && world.entities.get(e.sourceId)?.civilian?.survivor) allyAttacks++; });
  try {
    const r = runL5(world, mission, profile, { seed, maxSeconds: profile === 'evade-only' ? 240 : 600, each: () => {
      for (const e of world.entities.iterate()) if (e.civilian?.survivor && e.civilian.ally?.gun) armed.add(e.civilian.survivor.key);
    } });
    const row = { label, seed, profile, outcome: r.outcome, seconds: r.simSeconds, deaths: r.deaths, rescued: r.rescued, kills: r.kills, infectedAtStart: r.infectedAtStart, maxConcurrent: r.maxConcurrent, armed: [...armed], allyAttacks, fates: r.fates };
    reports.push(row); console.log(JSON.stringify(row));
    mkdirSync('test-results/survivors-ai/compare', { recursive: true });
    writeFileSync(`test-results/survivors-ai/compare/${label}.json`, JSON.stringify(reports, null, 2) + '\n');
  } finally { world.dispose(); }
}
