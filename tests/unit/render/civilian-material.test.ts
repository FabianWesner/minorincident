import { expect, test, vi } from 'vitest';
import { DataTexture, FloatType, RGBAFormat, Scene } from 'three/webgpu';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import { civilianMaterial } from '../../../src/render/npc/CivilianMaterial';

test('civilian shader leases share side/hand graphs and retire only after the last batch', () => {
  const scene = new Scene(), lighting = new Lighting(scene), shading = new Materials(lighting);
  const textures = [1, 2].map(value => new DataTexture(new Float32Array(16).fill(value), 4, 1, RGBAFormat, FloatType));
  const a = civilianMaterial(shading, false, 12, textures[0]), b = civilianMaterial(shading, false, 12, textures[1]);
  const sided = civilianMaterial(shading, true, 12, textures[0]), hand = civilianMaterial(shading, false, 13, textures[0]);
  expect(a.material).toBe(b.material); expect(sided.material).not.toBe(a.material); expect(hand.material).not.toBe(a.material);
  const retired = vi.fn(); a.material.addEventListener('dispose', retired);
  const key = a.material.customProgramCacheKey(); a.bindTexture(textures[0]); b.bindTexture(textures[1]);
  expect(a.material.customProgramCacheKey()).toBe(key);
  a.release(); a.release(); expect(retired).not.toHaveBeenCalled();
  b.release(); expect(retired).toHaveBeenCalledOnce();
  const next = civilianMaterial(shading, false, 12, textures[0]); expect(next.material).not.toBe(a.material);
  next.release(); sided.release(); hand.release(); textures.forEach(texture => texture.dispose()); shading.dispose(); lighting.dispose();
});
