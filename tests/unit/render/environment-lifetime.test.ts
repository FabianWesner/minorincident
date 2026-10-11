import { Scene, RenderTarget, type WebGPURenderer } from 'three/webgpu';
import { expect, test, vi } from 'vitest';
import { Lighting } from '../../../src/render/Lighting';
import { LookUniforms } from '../../../src/render/LookUniforms';
import type { Environment } from '../../../src/render/lighting/Environment';

test('district lighting borrows the renderer environment without disposing its cached presets', () => {
  const target = new RenderTarget(2, 2);
  const shared = { get: vi.fn(() => target), dispose: vi.fn() };
  const scene = new Scene(), lighting = new Lighting(scene, new LookUniforms(), {} as WebGPURenderer, shared as unknown as Environment);
  lighting.set('night');
  expect(lighting.environmentNode.value).toBe(target.texture);
  lighting.dispose();
  expect(shared.dispose).not.toHaveBeenCalled();
  const next = new Lighting(scene, new LookUniforms(), {} as WebGPURenderer, shared as unknown as Environment);
  next.set('golden'); expect(next.environmentNode.value).toBe(target.texture);
  next.dispose(); expect(shared.dispose).not.toHaveBeenCalled(); target.dispose();
});
