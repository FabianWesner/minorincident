/** L7 production census: resolve appearance, pooled runner choices and Alpha look selection. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadLevel } from '../../tests/qa/invariants/world';
import { LevelSevenBot } from '../../src/debug/bot/LevelSevenBot';
import { followFrustum } from '../sim-runner/l3Bots';
import { regularInfectedModels } from '../../src/data/crowdAppearance';
import { alphaLook, alphaLooks } from '../../src/data/alphaLooks';
import { infectedDef } from '../../src/data/infected';
import { l5Survivors } from '../../src/data/l5';
import type { EntitySnapshot } from '../../src/sim/world/types';
import type { AssetDef } from '../../src/assets/types';

const baselineRevision = '93d73c529', out = 'docs/reports/l7-all-new';
const baseline = JSON.parse(execFileSync('git', ['show', `${baselineRevision}:src/assets/manifest.json`], { encoding: 'utf8' })) as AssetDef[];
const resolveModel = (e: EntitySnapshot): string | undefined => {
  if (e.survivor) return `char.courier-${e.survivor.variant}`;
  if (e.companion) return 'char.corgi';
  if (e.appearance?.entityId === e.id) return e.appearance.asset;
  if (!e.infected) return e.civilian?.model;
  const selected = e.infected.model ?? e.infected.variant ?? e.archetype;
  const asset = selected.startsWith('infected.') ? infectedDef(selected).asset : selected;
  return e.infected.model || e.infected.variant === 'inf.alpha' ? asset : alphaLook(asset, e.id);
};
type Exposure = { peak: number; actorSeconds: number; infectedSeconds: number; corpseSeconds: number };
const runs: { tier: 'high' | 'low'; counts: Record<string, Exposure>; simSeconds: number; finished: boolean; phase: string; deaths: number }[] = [];
for (const tier of ['high', 'low'] as const) {
  const world = await loadLevel('L7', 1, tier), bot = new LevelSevenBot(world);
  const counts: Record<string, Exposure> = {};
  for (let tick = 0; tick < 900 * 60 && !bot.finished && world.entities.get(1)!.health.current > 0; tick++) {
    followFrustum(world); world.applyInput(bot.sample(), 'keyboard'); world.update();
    if (world.tick % 30) continue;
    const live: Record<string, number> = {};
    for (const e of world.entities.iterate()) {
      if (e.hidden || e.infected?.hidden) continue;
      const id = resolveModel(e); if (!id) continue;
      const row = counts[id] ??= { peak: 0, actorSeconds: 0, infectedSeconds: 0, corpseSeconds: 0 };
      row.actorSeconds += .5; live[id] = (live[id] ?? 0) + 1;
      if (e.infected) row.infectedSeconds += .5;
      if (e.corpse || e.health.current <= 0) row.corpseSeconds += .5;
    }
    for (const [id, n] of Object.entries(live)) counts[id].peak = Math.max(counts[id].peak, n);
  }
  runs.push({ tier, counts, simSeconds: world.tick / 60, finished: bot.finished, phase: world.l7Departure!.state.phase, deaths: world.missions!.state.result?.deaths ?? 0 });
  world.dispose();
}
const authored = [...new Set([...alphaLooks['inf.alpha'], 'char.courier-female', 'char.courier-male', 'char.corgi', 'npc.civilian-man-b.aftermath', 'npc.civilian-woman-b.aftermath', 'npc.marcus.aftermath', 'npc.shelter-survivor.bandaged', 'npc.shelter-survivor.lying', 'npc.shelter-survivor.sitting', ...l5Survivors.map(s => s.model), ...runs.flatMap(r => Object.keys(r.counts))])];
const rows = authored.map(id => ({ id, v2AtStart: id.startsWith('char.courier-') || baseline.find(a => a.id === id)?.crowdSkin === true, high: runs[0].counts[id] ?? null, low: runs[1].counts[id] ?? null }));
const old = rows.filter(r => !r.v2AtStart).sort((a, b) => ((b.high?.actorSeconds ?? 0) + (b.low?.actorSeconds ?? 0)) - ((a.high?.actorSeconds ?? 0) + (a.low?.actorSeconds ?? 0)));
mkdirSync(out, { recursive: true });
const review = ['npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-elderly', 'npc.civilian-man-b.aftermath', 'npc.civilian-woman-b.aftermath', ...alphaLooks['inf.alpha']];
writeFileSync(`${out}/census.json`, JSON.stringify({ baselineRevision, sources: ['src/sim/missions/LevelSevenEncounters.ts', 'src/sim/ai/InfectedSystem.ts:spawn', 'src/data/crowdAppearance.ts:regularInfectedModels', 'src/data/alphaLooks.ts', 'src/render/CrowdView.ts', 'src/sim/outbreak/Outbreak.ts:dressInfected/rise', 'src/sim/missions/LevelSixSubway.ts:prepare'], method: 'Production L7 complete input policy, seed 1 high/low, sampled after cleanup at 0.5 s. Population exposure is not camera visibility. Authored carried-survivor choices are included even if absent from L7-default. Turned pedestrians preserve their appearance asset.', scope: old.slice(0, 12).map(r => r.id), deferred: old.slice(12).map(r => r.id), review, excluded: regularInfectedModels.map(id => ({ id, reason: 'L7 Outbreak.dressInfected replaces the temporary native runner variant with a civilian appearance before rendering; zero post-cleanup exposure on both tiers.' })), carryover: rows.filter(r => r.v2AtStart).map(r => r.id), rows, runs }, null, 2) + '\n');
console.log(JSON.stringify({ scope: old.map(r => r.id), runs: runs.map(r => ({ tier: r.tier, simSeconds: r.simSeconds, finished: r.finished, phase: r.phase, deaths: r.deaths })) }));
