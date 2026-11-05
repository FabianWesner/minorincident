/** Production L3 identity census, including unchanged looks through turning and death. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadL3, runL3, inL3GameView } from '../sim-runner/l3Bots';
import { infectedDef } from '../../src/data/infected';
import type { EntitySnapshot } from '../../src/sim/world/types';

const out = 'docs/reports/l3-all-new';
mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string; crowdSkin?: boolean }[];
const baseline = JSON.parse(execFileSync('git', ['show', '83503eb18:src/assets/manifest.json'], { encoding: 'utf8' })) as typeof manifest;
function asset(e: EntitySnapshot): string | undefined {
  if (e.survivor) return `char.courier-${e.survivor.variant}`;
  if (e.companion) return 'char.corgi';
  if (e.appearance?.entityId === e.id) return e.appearance.asset;
  if (e.infected) {
    const model = e.infected.model ?? e.infected.variant;
    return model?.startsWith('infected.') ? infectedDef(model).asset : model ?? infectedDef(e.archetype).asset;
  }
  return e.civilian?.model;
}
const receipts = [];
for (const tier of ['high', 'low'] as const) {
  const { world, mission } = await loadL3(1, tier);
  const counts: Record<string, { distinct: Set<number>; initial: number; peak: number; infected: Set<number>; corpses: Set<number>; entitySeconds: number; visibleSeconds: number }> = {};
  const sample = (initial = false) => {
    const present: Record<string, number> = {};
    for (const e of world.entities.iterate()) {
      if (e.hidden || e.infected?.hidden) continue;
      const id = asset(e); if (!id || !/^(char|npc|inf|amb)\./.test(id)) continue;
      const row = counts[id] ??= { distinct: new Set(), initial: 0, peak: 0, infected: new Set(), corpses: new Set(), entitySeconds: 0, visibleSeconds: 0 };
      row.distinct.add(e.id); present[id] = (present[id] ?? 0) + 1;
      if (e.infected) row.infected.add(e.id);
      if (e.corpse || e.health.current <= 0 || e.civilian?.state === 'finished') row.corpses.add(e.id);
      if (!initial) { row.entitySeconds += 1 / 60; if (inL3GameView(world, e.transform)) row.visibleSeconds += 1 / 60; }
    }
    for (const [id, n] of Object.entries(present)) { counts[id].peak = Math.max(counts[id].peak, n); if (initial) counts[id].initial = n; }
  };
  const update = world.update.bind(world); world.update = () => { update(); sample(); };
  sample(true);
  const report = runL3(world, mission, 'complete', { seed: 1, maxSeconds: 600 });
  receipts.push({ tier, seed: 1, outcome: report.outcome, simSeconds: report.simSeconds, counts: Object.fromEntries(Object.entries(counts).sort().map(([id, row]) => [id, { ...row, distinct: row.distinct.size, infected: row.infected.size, corpses: row.corpses.size, entitySeconds: Math.round(row.entitySeconds), visibleSeconds: Math.round(row.visibleSeconds), baselineSkinned: baseline.find(a => a.id === id)?.crowdSkin ?? id.startsWith('char.courier-'), skinned: manifest.find(a => a.id === id)?.crowdSkin ?? id.startsWith('char.courier-') }])) });
  world.dispose();
}
writeFileSync(`${out}/census.json`, JSON.stringify({ source: 'Production L3 complete input bot, seed 1, high/low; actual game-camera frustum exposure, not occlusion tested.', receipts, invariant: 'Every LevelThreeCollapse.emerge call uses spawnPedestrian -> turnNow. appearance.asset is preserved for runner and sprinter brains, turns and corpses. The six old regularInfectedModels never render in authored L3.', additionalPotential: ['char.courier-male'], exclusions: [] }, null, 2) + '\n');
console.log(JSON.stringify(receipts));
