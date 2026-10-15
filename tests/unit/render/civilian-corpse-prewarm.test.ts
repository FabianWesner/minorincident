import { expect, test, vi } from 'vitest';
import { loadCivilianBake } from '../../../src/assets/civilianBake';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';
import { CivilianCrowd } from '../../../src/render/npc/CivilianCrowd';
import { prepareCivilianGeometry } from '../../../src/render/npc/prepareCivilianGeometry';
import { createCivilianPlaceholder } from '../../../src/render/npc/placeholders';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

vi.mock('../../../src/assets/civilianBake', () => ({ loadCivilianBake: vi.fn() }));

test.each([
  ['L4', 'high', 'lod1'], ['L4', 'low', 'lod2'],
  ['L6', 'low', 'lod1'], ['L7', 'low', 'lod2'],
] as const)('@E18 %s %s prewarms the actual settled-corpse band %s', async (scenario, tier, expected) => {
  const world = { tick: 0, scenario, infected: { director: { tier } }, entities: { iterate: () => [] } } as unknown as SimWorld;
  const crowd = new CivilianCrowd(world);
  const prepare = vi.spyOn(StaticCorpses.prototype, 'prepare').mockImplementation(() => {});
  type Batch = { init(): Promise<void>; update(): void; dispose(): void };
  try {
    for (const lod of ['lod1', 'lod2'] as const) {
      const rig = createCivilianPlaceholder();
      const baked = await prepareCivilianGeometry(rig, 'npc.civilian-man-a', lod === 'lod2', true);
      vi.mocked(loadCivilianBake).mockResolvedValue({ ...baked, rig });
      const batch = (crowd as unknown as { batch(model: string, lod: string): Batch }).batch('npc.civilian-man-a', lod);
      const update = vi.spyOn(batch, 'update').mockImplementation(() => {});
      prepare.mockClear();
      try { await batch.init(); expect(prepare).toHaveBeenCalledTimes(lod === expected ? 1 : 0); }
      finally { update.mockRestore(); batch.dispose(); baked.geometry.dispose(); }
    }
  } finally { prepare.mockRestore(); crowd.dispose(); }
});
