import { expect, test, vi } from 'vitest';
import { CrowdView } from '../../../src/render/CrowdView';
import { regularInfectedModels } from '../../../src/data/crowdAppearance';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

for (const low of [false, true]) test(`T-E27-14h @E27 @E18 ${low ? 'low prepares near and far bands' : 'high loads resident close-detail models'} before play`, async () => {
  const model = regularInfectedModels[0];
  const world = { scenario: 'blast-stress', entities: { iterate: () => [{ archetype: 'infected.runner', infected: { model } }] } } as unknown as SimWorld;
  const crowd = new CrowdView(world, low);
  const load = vi.spyOn(crowd as unknown as { loadBatch(def: { id: string; asset: string }, lod: string): Promise<void> }, 'loadBatch').mockResolvedValue();
  const update = vi.spyOn(crowd, 'update').mockImplementation(() => {});
  try {
    await crowd.init();
    const heroModels = new Set(load.mock.calls.filter(([, lod]) => lod === 'lod0').map(([def]) => def.asset));
    expect([...heroModels]).toEqual(low ? [] : [model]);
    if (low) {
      const models = new Set(load.mock.calls.map(([def]) => def.id));
      for (const id of models) expect(load.mock.calls.filter(([def]) => def.id === id).map(([, lod]) => lod).sort(), id).toEqual(['lod1', 'lod2']);
    }
  } finally { update.mockRestore(); load.mockRestore(); crowd.dispose(); }
});

for (const low of [false, true]) test(`PO #21 @E18 resident Alpha full body is ready before play (${low ? 'low' : 'high'})`, async () => {
  const world = { scenario: 'blast-stress', entities: { iterate: () => [{ archetype: 'infected.alpha', infected: {} }] } } as unknown as SimWorld;
  const crowd = new CrowdView(world, low);
  const load = vi.spyOn(crowd as unknown as { loadBatch(def: { id: string; asset: string }, lod: string): Promise<void> }, 'loadBatch').mockResolvedValue();
  const update = vi.spyOn(crowd, 'update').mockImplementation(() => {});
  try {
    await crowd.init();
    const heroes = new Set(load.mock.calls.filter(([, lod]) => lod === 'lod0').map(([def]) => def.asset));
    expect([...heroes]).toEqual(['inf.alpha']);
    expect(load.mock.calls.filter(([def]) => def.asset === 'inf.alpha').map(([, lod]) => lod).sort()).toEqual(['lod0', 'lod1', 'lod2']);
  } finally { update.mockRestore(); load.mockRestore(); crowd.dispose(); }
});
