/** L2 asset identities from production spawn data, including preserved turns and corpses. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadL2, runL2 } from '../sim-runner/l2Bots';
import { infectedDef } from '../../src/data/infected';
import type { EntitySnapshot } from '../../src/sim/world/types';

const out = 'docs/reports/l2-all-new';
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string; crowdSkin?: boolean; sourceGlb?: string }[];
const asset = (e: EntitySnapshot): string | undefined => e.survivor ? `char.courier-${e.survivor.variant}` : e.companion ? 'char.corgi' : e.appearance?.entityId === e.id ? e.appearance.asset : e.infected ? e.infected.model ?? e.infected.variant ?? infectedDef(e.archetype).asset : e.civilian?.model;
const receipts = [];
for (const tier of ['high', 'low'] as const) {
  const { world, mission } = await loadL2(1, tier);
  const counts: Record<string, { distinct: Set<number>; initial: number; peak: number; infected: Set<number>; corpses: Set<number>; entitySeconds: number }> = {};
  const sample = (initial = false) => {
    const present: Record<string, number> = {};
    for (const e of world.entities.iterate()) {
      if (e.hidden || e.infected?.hidden) continue;
      const id = asset(e); if (!id || !/^(char|npc|inf|amb)\./.test(id)) continue;
      const row = counts[id] ??= { distinct: new Set(), initial: 0, peak: 0, infected: new Set(), corpses: new Set(), entitySeconds: 0 };
      row.distinct.add(e.id); present[id] = (present[id] ?? 0) + 1;
      if (e.infected) row.infected.add(e.id);
      if (e.corpse || e.health.current <= 0 || e.civilian?.state === 'finished') row.corpses.add(e.id);
      if (!initial) row.entitySeconds += 1 / 60;
    }
    for (const [id, n] of Object.entries(present)) { counts[id].peak = Math.max(counts[id].peak, n); if (initial) counts[id].initial = n; }
  };
  const update = world.update.bind(world);
  world.update = () => { update(); sample(); };
  sample(true);
  const report = runL2(world, mission, 'complete', { maxSeconds: 360 });
  receipts.push({ tier, seed: 1, report, counts: Object.fromEntries(Object.entries(counts).sort().map(([id, row]) => [id, { ...row, distinct: row.distinct.size, infected: row.infected.size, corpses: row.corpses.size, entitySeconds: Math.round(row.entitySeconds), skinned: manifest.find(a => a.id === id)?.crowdSkin ?? id.startsWith('char.courier-') }])) });
  world.dispose();
}
writeFileSync(`${out}/census.json`, JSON.stringify({ source: 'production L2 complete-bot input simulation; world presence, not screen visibility', receipts,
  invariant: 'LevelTwoRescue.emerge -> spawnPedestrian -> turnNow keeps appearance; CrowdView/NpcView render appearance.asset rather than civilian.variant.',
  additionalPotential: ['char.courier-male', 'char.corgi', 'amb.dog', 'inf.dog', 'npc.depot-clerk', 'npc.lab-tech-a', 'npc.lab-tech-b', 'npc.lab-guard', 'inf.common-worker'],
  additionalReason: 'Courier choice, companion and L1 campaign corpse carryover; all already v2 at base. No healthy pets are authored in standalone L2.' }, null, 2) + '\n');
console.log(JSON.stringify(receipts.map(r => ({ tier: r.tier, outcome: r.report.outcome, seconds: r.report.simSeconds, counts: r.counts })), null, 2));
