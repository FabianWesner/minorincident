import { expect, test, vi } from 'vitest';
import { Group } from 'three/webgpu';
import { CivilianCrowd } from '../../../src/render/npc/CivilianCrowd';
import { l1CivilianModels } from '../../../src/data/npcs';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

test.each(['high', 'low'] as const)('L1 %s stages later cast after Begin and warms before publishing batches', async tier => {
  type Batch = Group & { model: string; lod: string; init(): Promise<void>; dispose(): void };
  const batches: Batch[] = [];
  const prototype = CivilianCrowd.prototype as unknown as { batch(model: string, lod: string): Batch };
  const batch = vi.spyOn(prototype, 'batch').mockImplementation((model, lod) => {
    const b = Object.assign(new Group(), { model, lod, init: async () => {}, dispose: () => {} });
    batches.push(b); return b;
  });
  const player = { id: 1, transform: { x: 0, z: 0 } };
  const near = { id: 2, transform: { x: 4, z: 0 }, civilian: { model: 'npc.civilian-man-a' } };
  const far = { id: 3, transform: { x: 100, z: 0 }, civilian: { model: 'npc.lab-tech-a' } };
  const world = { scenario: 'L1', missions: { state: { phase: 'briefing' } }, entities: { get: () => player, iterate: () => [player, near, far] } };
  const warm = vi.fn(async (b: Group) => { expect(b.parent).toBeNull(); });
  const crowd = new CivilianCrowd(world as unknown as SimWorld, undefined, undefined, warm);
  crowd.setQuality(tier);
  try {
    const discover = () => (crowd as unknown as { discover(): void }).discover();
    discover();
    expect(batches.map(b => `${b.model}:${b.lod}`)).toEqual(['npc.civilian-man-a:lod1', 'npc.civilian-man-a:lod2']);
    world.missions.state.phase = 'playing';
    discover(); await crowd.ready();
    for (const model of l1CivilianModels) {
      expect(batches.filter(b => b.model === model).map(b => b.lod).sort()).toEqual(tier === 'low' ? ['lod1', 'lod2'] : ['lod0', 'lod1', 'lod2']);
    }
    expect(batches.some(b => b.model === 'npc.police-officer' || b.model === 'npc.national-guard')).toBe(false);
    expect(warm).toHaveBeenCalledTimes(batches.length - 2);
    for (const b of batches) expect(b.parent).toBe(crowd);
    discover(); await crowd.ready();
    expect(batches).toHaveLength(l1CivilianModels.length * (tier === 'low' ? 2 : 3));
  } finally { crowd.dispose(); batch.mockRestore(); }
});
