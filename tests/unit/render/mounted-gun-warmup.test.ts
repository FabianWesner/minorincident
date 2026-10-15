import { expect, test, vi } from 'vitest';
import { Group, type WebGPURenderer } from 'three/webgpu';
import { MountedGunView } from '../../../src/render/MountedGunView';
import type { Materials } from '../../../src/render/Materials';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

const registry = vi.hoisted(() => ({ loadAsset: vi.fn(), dispose: vi.fn() }));
vi.mock('../../../src/assets/registry', () => ({ AssetRegistry: class {
  loadAsset = registry.loadAsset;
  dispose = registry.dispose;
} }));

for (const disposed of [false, true]) test(`@E32 @E18 streamed gun waits for HDR compilation; disposed ${disposed}`, async () => {
  const model = new Group(); registry.loadAsset.mockResolvedValueOnce(model);
  let finish!: () => void;
  const compiled = new Promise<void>(resolve => { finish = resolve; });
  const warm = vi.fn(() => compiled);
  const world = { mountedGun: { placement: { x: 3990, y: 3, z: -33, yaw: 0 }, aim: { x: 1, z: 0 }, gun: { angle: 0, heat: 0, locked: false } } } as unknown as SimWorld;
  const view = new MountedGunView(world, true, {} as Materials, {} as WebGPURenderer, warm);
  const ready = view.ready(); await Promise.resolve();
  expect(warm).toHaveBeenCalledExactlyOnceWith(model);
  view.update(); expect(view.visible).toBe(false); expect(view.children).toHaveLength(0);
  if (disposed) view.dispose();
  finish(); await ready; view.update();
  expect(view.visible).toBe(!disposed);
  expect(view.children).toHaveLength(disposed ? 0 : 1);
  if (!disposed) { expect(view.position.toArray()).toEqual([3990, 3, -33]); view.dispose(); }
});
