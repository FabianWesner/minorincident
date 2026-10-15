import { afterEach, expect, test, vi } from 'vitest';
import { TextureNode, type DataTexture, type Node } from 'three/webgpu';
// Three's binding manager is omitted from @types/three.
// @ts-expect-error internal module has no declaration
import { NodeSampledTexture } from 'three/src/renderers/common/nodes/NodeSampledTexture.js';
import { ivec2, textureLoad } from 'three/tsl';
import { clipTexture, poseTexture } from '../../../src/assets/crowd';

type TextureInternals = { setupUV(builder: { isFlipY(): boolean }, uv: Node): Node; update(): void; _flipYUniform: { value: boolean } | null };

afterEach(() => vi.unstubAllGlobals());

test('@E18 pose atlas texel coordinates equal the unflipped Three path on both backends', () => {
  vi.stubGlobal('ImageBitmap', class {});
  const atlas = clipTexture({ parts: ['root'], frames: 2, duration: 1, matrices: Float32Array.from({ length: 32 }, (_, i) => i) });
  const pose = poseTexture(atlas), uv = ivec2(2, 1);
  for (const flipBackend of [false, true]) {
    const builder = { isFlipY: () => flipBackend };
    const original = textureLoad(atlas, uv) as unknown as TextureInternals;
    original.setupUV(builder, uv); original.update();
    expect(original._flipYUniform?.value ?? false).toBe(false);
    const sample = textureLoad(pose, uv);
    expect((sample as unknown as TextureInternals).setupUV(builder, uv)).toBe(uv);
    expect((sample as unknown as TextureInternals)._flipYUniform).toBeNull();
    expect(sample.sampler).toBe(false);
    expect(sample.value).toBe(atlas);
    expect(sample).toBeInstanceOf(TextureNode);
  }
  atlas.dispose();
});

test('@E18 pose texture clones retain per-draw rebinding and mutable atlas uploads', () => {
  const first = clipTexture({ parts: ['root'], frames: 1, duration: 1, matrices: new Float32Array(16) });
  const second = clipTexture({ parts: ['root'], frames: 1, duration: 1, matrices: new Float32Array(16).fill(2) });
  const pose = poseTexture(first), sample = textureLoad(pose, ivec2(0, 0));
  const binding = new NodeSampledTexture('pose', sample, null);
  expect(binding.texture).toBe(first);
  pose.value = second;
  expect(binding.update()).toBe(true);
  expect(binding.texture).toBe(second);
  expect(sample.value).toBe(second);
  const version = second.version;
  (second.image.data as Float32Array)[0] = 3;
  second.addUpdateRange(0, 16); second.needsUpdate = true;
  expect(sample.value.version).toBe(version + 1);
  expect(sample.value.updateRanges).toEqual([{ start: 0, count: 16 }]);
  expect(((sample.value as DataTexture).image.data as Float32Array)[0]).toBe(3);
  expect(first.matrix.elements).toEqual(second.matrix.elements);
  expect(first.matrixAutoUpdate).toBe(false);
  first.dispose(); second.dispose();
});
