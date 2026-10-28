/** Inventory renderer identities after resolving L10's shared spawn selectors. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { regularInfectedModels } from '../../src/data/crowdAppearance';
import { alphaLooks } from '../../src/data/alphaLooks';
import { dogCoats } from '../../src/data/dogAppearance';
import { cureEncounters, cureEncounterSlots } from '../../src/levels/L10/encounters';
import type { AssetDef } from '../../src/assets/types';

const current = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const before = JSON.parse(execFileSync('git', ['show', 'e45cbde3b:src/assets/manifest.json'], { encoding: 'utf8' })) as AssetDef[];
const l9 = new Set<string>(regularInfectedModels.filter(id => id !== 'inf.common-worker'));
const groups = [
  { role: 'player courier', ids: ['char.courier-female', 'char.courier-male'], visibility: 'continuous, selected player identity' },
  { role: 'protected companion', ids: ['char.corgi'], visibility: 'continuous; never infected' },
  { role: 'ordinary runner', ids: [...regularInfectedModels], visibility: 'dominant regular population; least-crowded selector spreads seven looks' },
  { role: 'industrial tough', ids: ['inf.firefighter'], visibility: 'two per authored industrial group' },
  { role: 'regular Alpha', ids: [...alphaLooks['inf.alpha']], visibility: 'R3-R7; deterministic renderer look, all five possible' },
  { role: 'persistent Mega boss', ids: [...alphaLooks['inf.mega-alpha']], visibility: 'introduction, pursuit, finale; deterministic renderer look' },
  { role: 'infected dog', ids: dogCoats.map(coat => `inf.dog${coat ? `.${coat}` : ''}`), visibility: 'recurs R2-R7; seeded coat selector' },
  { role: 'epilogue resident', ids: ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-elderly'], visibility: 'three/six residents after cure release' },
];
const definition = (defs: AssetDef[], id: string) => defs.find(def => def.id === id.replace(/\.(black|cream)$/, ''))!;
const v2 = (defs: AssetDef[], id: string) => !!definition(defs, id).crowdSkin || id.startsWith('char.courier-') && existsSync(`public/assets/models/${id}.skin.glb`);
const population = groups.flatMap(group => group.ids.map(asset => ({ asset, role: group.role, visibility: group.visibility,
  v2AtLaneBase: v2(before, asset), v2Current: v2(current, asset), owner: l9.has(asset) ? 'L9; import after main merge' : v2(before, asset) ? 'already v2; skip' : 'L10 build',
  states: asset === 'char.corgi' ? ['alive'] : asset.startsWith('inf.') ? ['alive', 'knockdown', 'recovery', 'corpse'] : ['alive', 'corpse'],
})));
const authoredSlots = Object.fromEntries((['high', 'low'] as const).map(tier => {
  const counts: Record<string, number> = {};
  for (const encounter of cureEncounters) for (const slot of cureEncounterSlots(encounter, tier)) counts[slot.archetype] = (counts[slot.archetype] ?? 0) + 1;
  return [tier, counts];
}));
writeFileSync('docs/reports/l10-all-new/census.json', JSON.stringify({ date: '2026-10-28', base: 'e45cbde3b',
  sources: ['src/levels/L10/encounters.ts', 'src/sim/missions/LevelTenEncounters.ts', 'src/sim/ai/InfectedSystem.ts', 'src/data/crowdAppearance.ts', 'src/data/alphaLooks.ts', 'src/data/dogAppearance.ts', 'src/sim/missions/LevelTenEpilogue.ts', 'src/sim/npc/Civilians.ts', 'src/assets/manifest.json'],
  totalIdentities: population.length, authoredSlots, population,
  selection: 'All nine identities still rigid at the lane base fit the twelve-conversion limit: six shared runners are owned by L9, three Mega looks by this lane. No batch-3 remainder. Already-v2 Alpha looks, dog coats, couriers, companion and residents are retained and reviewed in the mixed crowd.',
  lifecycle: 'NPCs only emerge after cure release, which disables civilian grabs; no new turned identity can enter L10. Corpses retain the selected registered look. L10 begins alone after the crash: no carried survivor or passenger entities are imported.'
}, null, 2) + '\n');
console.log(`${population.length} L10 identities; ${population.filter(row => !row.v2AtLaneBase).length} legacy at base; ${population.filter(row => row.owner === 'L10 build').length} owned here`);
