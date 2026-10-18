import { expect, test, vi } from 'vitest';
import { CrowdView } from '../../../src/render/CrowdView';
import { regularInfectedModels } from '../../../src/data/crowdAppearance';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

for (const low of [false, true]) test(`T-E27-14h @E27 @E18 ${low ? 'low retains LOD2' : 'high loads resident close-detail models'} before play`, async () => {
  const model = regularInfectedModels[0];
  const world = { scenario: 'blast-stress', entities: { iterate: () => [{ archetype: 'infected.runner', infected: { model } }] } } as unknown as SimWorld;
  const crowd = new CrowdView(world, low);
  const load = vi.spyOn(crowd as unknown as { loadBatch(def: { asset: string }, lod: string): Promise<void> }, 'loadBatch').mockResolvedValue();
  const update = vi.spyOn(crowd, 'update').mockImplementation(() => {});
  try {
    await crowd.init();
    const heroModels = new Set(load.mock.calls.filter(([, lod]) => lod === 'lod0').map(([def]) => def.asset));
    expect([...heroModels]).toEqual(low ? [] : [model]);
    if (low) expect(load.mock.calls.every(([, lod]) => lod === 'lod2')).toBe(true);
  } finally { update.mockRestore(); load.mockRestore(); crowd.dispose(); }
});
