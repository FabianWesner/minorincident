/** L4 production spawn census; render look selection matches CrowdView. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadLevel } from '../../tests/qa/invariants/world';
import { runL4 } from '../sim-runner/l4Bots';
import { infectedDef } from '../../src/data/infected';
import { alphaLook, alphaLooks } from '../../src/data/alphaLooks';
import { l4InfectedArchetypes, l4InfectedLooks } from '../../src/data/l4';
import type { AssetDef } from '../../src/assets/types';
import type { EntitySnapshot } from '../../src/sim/world/types';

const out = 'docs/reports/l4-all-new'; mkdirSync(out, { recursive: true });
const baseline = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const model = (e: EntitySnapshot): string | undefined => {
  if (e.survivor) return `char.courier-${e.survivor.variant}`;
  if (e.companion) return 'char.corgi';
  if (e.appearance?.entityId === e.id) return e.appearance.asset;
  if (e.infected) return alphaLook(e.infected.model ?? e.infected.variant ?? infectedDef(e.archetype).asset, e.id);
  return e.civilian?.model;
};
const runs = [];
for (const tier of ['high', 'low'] as const) {
  const world = await loadLevel('L4', 1, tier);
  const counts: Record<string, { peak: number; actorSeconds: number; infectedSeconds: number; corpseSeconds: number }> = {};
  const update = world.update.bind(world);
  world.update = () => {
    update(); if (world.tick % 30) return;
    const live: Record<string, number> = {};
    for (const e of world.entities.iterate()) {
      if (e.hidden || e.infected?.hidden) continue;
      const id = model(e); if (!id) continue;
      const row = counts[id] ??= { peak: 0, actorSeconds: 0, infectedSeconds: 0, corpseSeconds: 0 };
      live[id] = (live[id] ?? 0) + 1; row.actorSeconds += .5;
      if (e.infected) row.infectedSeconds += .5;
      if (e.corpse || e.health.current <= 0 || e.civilian?.state === 'finished') row.corpseSeconds += .5;
    }
    for (const [id, n] of Object.entries(live)) counts[id].peak = Math.max(counts[id].peak, n);
  };
  const report = runL4(world, world.missions!, 'complete', { seed: 1, maxSeconds: 600 });
  runs.push({ tier, report, counts }); world.dispose();
}
const authored = [...new Set([...l4InfectedLooks, ...l4InfectedArchetypes.filter(id => id !== 'infected.sprinter').map(id => infectedDef(id).asset), ...alphaLooks['inf.alpha'], 'char.courier-female', 'char.courier-male', 'char.corgi'])];
const inherited = new Set(['inf.common-worker', 'npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-elderly', 'char.courier-female', 'char.courier-male', 'char.corgi']);
const rows = authored.map(id => ({ id, inheritedV2: inherited.has(id), crowdSkin: baseline.find(a => a.id === id)?.crowdSkin ?? false, high: runs[0].counts[id] ?? null, low: runs[1].counts[id] ?? null }));
const data = { source: 'Production L4 complete bot, seed 1, sampled every 0.5 s; world population exposure, not camera visibility', sources: ['src/data/l4.ts', 'src/levels/L4/layout.ts', 'src/sim/missions/LevelFourWar.ts', 'src/data/alphaLooks.ts', 'src/render/CrowdView.ts'], scope: rows.filter(r => !r.inheritedV2).map(r => r.id), carryover: rows.filter(r => r.inheritedV2).map(r => r.id), excluded: [{ id: 'inf.sprinter', reason: 'Every L4 sprinter has an explicit model from l4InfectedLooks; default batch is intentionally omitted by CrowdView' }], deferred: [], rows, runs };
writeFileSync(`${out}/census.json`, JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify({ scope: data.scope, runs: runs.map(r => ({ tier: r.tier, outcome: r.report.outcome, seconds: r.report.simSeconds })) }));
