/** r37-l4north: do the three street-north encounters spawn on the route and engage the courier? Native complete run, read-only observers. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { l4CollapseGroups } from '../../src/data/l4';
import { preset } from '../../src/sim/progression/Campaign';
import { runLevel } from '../sim-runner/levels';
const first = l4CollapseGroups.findIndex(g => g[4]);
const out: unknown[] = [];
for (const tier of ['high', 'low'] as const) {
  const campaign = preset('L4-default'); campaign.settings.quality = tier;
  const seen = new Map<number, { group: number; archetype: string; spawnedTick: number; at: number[]; firstAttackOnPlayer?: number; dead?: number; minPlayerDist: number }>();
  let peak = 0;
  const run = await runLevel('L4', 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: tier, beforeBegin: world => {
    world.events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.targetId === 1) { const r = seen.get(e.sourceId); if (r && r.firstAttackOnPlayer === undefined) r.firstAttackOnPlayer = world.tick; } });
    world.events.on('sim.tick', () => {
      const s = world.missions!.state.l4!, p = world.entities.get(1)!;
      for (const q of s.pendingDoor ?? []) if (q.roster && q.id > 0) {
        const e = world.entities.get(q.id); if (!e) continue;
        const group = Number(q.door.split('-').pop()) - first;
        let r = seen.get(q.id);
        if (!r) { r = { group, archetype: e.archetype!, spawnedTick: world.tick, at: [Math.round(e.transform.x), Math.round(e.transform.z)], minPlayerDist: 999 }; seen.set(q.id, r); }
        r.minPlayerDist = Math.min(r.minPlayerDist, Math.round(Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z)));
        if (e.health.current <= 0 && !r.dead) r.dead = world.tick;
      }
      if (world.tick % 60 === 0) peak = Math.max(peak, world.infected!.active.filter(a => a.health.current > 0 && !a.hidden).length);
    }, 8);
  } });
  const rows = [...seen.entries()].map(([id, r]) => ({ id, ...r }));
  console.log(tier, run.outcome, 'peak alive', peak);
  for (const r of rows) console.log(' ', JSON.stringify(r));
  out.push({ tier, outcome: run.outcome, peak, rows });
}
mkdirSync('docs/reports/r37-l4north', { recursive: true });
writeFileSync('docs/reports/r37-l4north/probe.json', JSON.stringify(out, null, 1));
