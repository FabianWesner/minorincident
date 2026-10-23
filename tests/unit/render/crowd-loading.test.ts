import { expect, test, vi } from 'vitest';
import { CrowdView } from '../../../src/render/CrowdView';
import { alphaLooks } from '../../../src/data/alphaLooks';
import { regularInfectedModels } from '../../../src/data/crowdAppearance';
import { cureEncounters, cureEncounterSlots } from '../../../src/levels/L10/encounters';

test.each(['high', 'low'] as const)('L10 %s prepares every future encounter, appearance and boss before play', async tier => {
  const calls = await preparation('L10', tier);
  const assets = new Set(calls.map(([def]) => def.asset));
  const roles = new Set(calls.map(([def]) => def.id));
  for (const group of cureEncounters) for (const slot of cureEncounterSlots(group, tier)) expect(roles.has(slot.archetype), slot.archetype).toBe(true);
  for (const asset of [...regularInfectedModels, ...alphaLooks['inf.alpha'], ...alphaLooks['inf.mega-alpha']]) expect(assets.has(asset), asset).toBe(true);
  for (const asset of [...alphaLooks['inf.alpha'], ...alphaLooks['inf.mega-alpha']]) expect(calls.some(([def, lod]) => def.asset === asset && lod === 'lod0'), asset).toBe(true);
  expect(calls.filter(([def]) => def.asset === 'inf.dog').map(([def]) => def.decay)).toEqual(expect.arrayContaining([undefined, 'black', 'cream']));
  expect(assets.has('inf.elephant')).toBe(false);
  expect(assets.has('inf.crawler')).toBe(false);
});

test.each(['high', 'low'] as const)('L8 %s prepares every animal conversion and future Alpha look', async tier => {
  const calls = await preparation('L8', tier);
  const assets = new Set(calls.map(([def]) => def.asset));
  for (const species of ['lion', 'gorilla', 'elephant', 'zebra', 'flamingo']) for (const state of ['amb', 'inf']) expect(assets.has(`${state}.${species}`), `${state}.${species}`).toBe(true);
  for (const asset of alphaLooks['inf.alpha']) expect(assets.has(asset), asset).toBe(true);
  expect(assets.has('npc.lab-tech-a')).toBe(false);
  expect(assets.has('inf.crawler')).toBe(false);
});

test('explicit infected NPC model overrides still prepare their original assets', async () => {
  const calls = await preparation('L8', 'low', true);
  expect(calls.some(([def]) => def.asset === 'npc.lab-tech-a')).toBe(true);
});

async function preparation(scenario: 'L8' | 'L10', tier: 'high' | 'low', override = false) {
  const entities = [
    { archetype: 'civilian', civilian: { schedule: {}, model: 'npc.lab-tech-a' } },
    ...(override ? [{ archetype: 'infected.runner', infected: { model: 'npc.lab-tech-a' } }] : []),
    ...(scenario === 'L8' ? ['lion', 'gorilla', 'elephant', 'zebra', 'flamingo'].map(zooAnimal => ({ archetype: 'civilian', civilian: { zooAnimal } })) : []),
  ];
  const load = vi.fn<(def: { id: string; asset: string; decay?: string }, lod: string) => Promise<void>>(async () => {});
  const view = Object.assign(Object.create(CrowdView.prototype), {
    world: { scenario, npcs: { civilians: { outbreak: {} } }, entities: { iterate: () => entities }, missions: { def: { actors: {} } } },
    low: tier === 'low', modelAliases: new Map(), definitions: new Map(), heroSlots: new Map(), batches: new Map(),
    add: () => {}, update: () => {}, loadBatch: load,
  }) as CrowdView;
  await view.init();
  return load.mock.calls;
}
