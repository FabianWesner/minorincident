/** L5 production spawn census, including persistent turned appearances and corpses. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadL5, runL5 } from '../sim-runner/l5Bots';
import { infectedDef } from '../../src/data/infected';
import { alphaLook, alphaLooks } from '../../src/data/alphaLooks';
import { l5Survivors } from '../../src/data/l5';
import { l5Dressing } from '../../src/levels/L5/layout';
import type { AssetDef } from '../../src/assets/types';
import type { EntitySnapshot } from '../../src/sim/world/types';

const out = 'docs/reports/l5-all-new'; mkdirSync(out, { recursive: true });
const baseline = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const model = (e: EntitySnapshot): string | undefined => {
  if (e.survivor) return `char.courier-${e.survivor.variant}`;
  if (e.companion) return 'char.corgi';
  if (e.appearance?.entityId === e.id) return e.appearance.asset;
  if (e.infected) {
    const selected = e.infected.model ?? e.infected.variant ?? e.archetype;
    const asset = selected.startsWith('infected.') ? infectedDef(selected).asset : selected;
    return e.infected.model || e.infected.variant === 'inf.alpha' ? asset : alphaLook(asset, e.id);
  }
  return e.civilian?.model;
};
type Counts = Record<string, { peak: number; actorSeconds: number; infectedSeconds: number; corpseSeconds: number }>;
const runs: { tier: 'high' | 'low'; report: ReturnType<typeof runL5>; counts: Counts }[] = [];
for (const tier of ['high', 'low'] as const) {
  const { world, mission } = await loadL5(1, tier);
  const counts: Counts = {};
  const report = runL5(world, mission, 'complete', { maxSeconds: 600, each: () => {
    if (world.tick % 30) return;
    const live: Record<string, number> = {};
    for (const e of world.entities.iterate()) {
      if (e.hidden || e.infected?.hidden) continue;
      const id = model(e); if (!id || !/^(char|npc|inf|amb)\./.test(id)) continue;
      const row = counts[id] ??= { peak: 0, actorSeconds: 0, infectedSeconds: 0, corpseSeconds: 0 };
      live[id] = (live[id] ?? 0) + 1; row.actorSeconds += .5;
      if (e.infected) row.infectedSeconds += .5;
      if (e.corpse || e.health.current <= 0 || e.civilian?.state === 'finished') row.corpseSeconds += .5;
    }
    for (const [id, n] of Object.entries(live)) counts[id].peak = Math.max(counts[id].peak, n);
  } });
  runs.push({ tier, report, counts }); world.dispose();
}
const authored = [...new Set([...l5Survivors.map(s => s.model), 'npc.marcus.aftermath', 'npc.civilian-man-b.aftermath', 'npc.civilian-woman-b.aftermath', ...l5Dressing.filter(d => d.entity && d.kind === 'corpse').map(d => d.assetId), ...alphaLooks['inf.alpha'], 'char.courier-female', 'char.courier-male', 'char.corgi', ...runs.flatMap(r => Object.keys(r.counts))])];
const rows = authored.map(id => ({ id, inheritedV2: baseline.find(a => a.id === id)?.crowdSkin === true || id.startsWith('char.courier-'), high: runs[0].counts[id] ?? null, low: runs[1].counts[id] ?? null }));
const scope = rows.filter(r => !r.inheritedV2).map(r => r.id);
if (scope.length > 12) throw Error('Rank old figures by exposure before building more than 12');
writeFileSync(`${out}/census.json`, JSON.stringify({ revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), source: 'Production L5 complete bot, seed 1, sampled every 0.5 s; world population exposure, not camera visibility', sources: ['src/data/l5.ts', 'src/levels/L5/layout.ts', 'src/sim/missions/LevelFiveAftermath.ts', 'src/render/CrowdView.ts'], scope, carryover: rows.filter(r => r.inheritedV2).map(r => r.id), deferred: [], rows, runs }, null, 2) + '\n');
console.log(JSON.stringify({ scope, runs: runs.map(r => ({ tier: r.tier, outcome: r.report.outcome, seconds: r.report.simSeconds })) }));
