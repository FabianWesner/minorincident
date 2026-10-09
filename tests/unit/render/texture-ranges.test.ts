import { DataTexture, FloatType, RGBAFormat } from 'three';
import { expect, test, vi } from 'vitest';
import { installTextureRanges } from '../../../src/render/TextureRanges';

test('@E18-AC01 float atlas initializes all rows, then uploads only mutable rows; recreated storage reinitializes', () => {
  const pixels = new Float32Array(4 * 8 * 4), texture = new DataTexture(pixels, 4, 8, RGBAFormat, FloatType);
  const resource = { textureGPU: {}, glTextureType: 1, glFormat: 2, glType: 3 };
  const original = vi.fn(), subImage = vi.fn();
  const backend = { updateTexture: original, get: () => resource, gl: { texSubImage2D: subImage }, state: { bindTexture: vi.fn() }, textureUtils: { setTextureParameters: vi.fn() } };
  installTextureRanges(backend);
  texture.addUpdateRange(6 * 16, 2 * 16); backend.updateTexture(texture, {});
  expect(original).toHaveBeenCalledTimes(1); expect(subImage).not.toHaveBeenCalled();
  texture.addUpdateRange(6 * 16, 2 * 16); backend.updateTexture(texture, {});
  expect(original).toHaveBeenCalledTimes(1);
  expect(subImage).toHaveBeenCalledWith(1, 0, 0, 6, 4, 2, 2, 3, pixels.subarray(96));
  expect(texture.updateRanges).toHaveLength(0);
  resource.textureGPU = {}; texture.addUpdateRange(96, 32); backend.updateTexture(texture, {});
  expect(original).toHaveBeenCalledTimes(2); expect(subImage).toHaveBeenCalledTimes(1);
  texture.dispose();
});

test('@E18-AC01 WebGPU atlas writes the same row offset and float bytes; non-row ranges fall back to a full upload', () => {
  const pixels = new Float32Array(4 * 8 * 4), texture = new DataTexture(pixels, 4, 8, RGBAFormat, FloatType);
  const resource = { texture: {}, glTextureType: 0, glFormat: 0, glType: 0 }, original = vi.fn(), write = vi.fn();
  const backend = { updateTexture: original, get: () => resource, device: { queue: { writeTexture: write } } }; installTextureRanges(backend);
  backend.updateTexture(texture, {}); texture.addUpdateRange(96, 32); backend.updateTexture(texture, {});
  expect(write).toHaveBeenCalledWith({ texture: resource.texture, origin: { x: 0, y: 6, z: 0 } }, pixels.subarray(96), { bytesPerRow: 64 }, { width: 4, height: 2, depthOrArrayLayers: 1 });
  texture.addUpdateRange(1, 17); backend.updateTexture(texture, {}); expect(original).toHaveBeenCalledTimes(2);
  texture.dispose();
});

test('@E18-AC01 crowd pose changes upload mutable rows without resending the baked clips', async () => {
  const { CrowdPosePalette } = await import('../../../src/render/characters/CrowdPosePalette');
  const matrices = new Float32Array(32); matrices[0] = matrices[5] = matrices[10] = matrices[15] = 1; matrices.set(matrices.subarray(0, 16), 16); matrices[28] = 1;
  const palette = new CrowdPosePalette({ parts: ['root'], frames: 2, duration: 1, matrices }, 2);
  const resource = { textureGPU: {}, glTextureType: 1, glFormat: 2, glType: 3 }, original = vi.fn(), upload = vi.fn();
  const backend = { updateTexture: original, get: () => resource, gl: { texSubImage2D: upload }, state: { bindTexture: vi.fn() }, textureUtils: { setTextureParameters: vi.fn() } };
  installTextureRanges(backend); backend.updateTexture(palette.texture, {});
  const [row] = palette.sample(1, 'idle', 0, 0); backend.updateTexture(palette.texture, {});
  expect(original).toHaveBeenCalledTimes(1);
  expect(upload.mock.calls[0].slice(0, 6)).toEqual([1, 0, 0, row, 4, 1]);
  palette.sample(1, 'idle', .5, .1); expect(palette.texture.updateRanges).toHaveLength(0);
  const corrected = palette.correct(1, .5, row, 1, pose => { pose[13] = .25; });
  expect(palette.texture.updateRanges).toEqual([{ start: corrected * 16, count: 16 }]);
  backend.updateTexture(palette.texture, {});
  expect(upload.mock.calls[1][3]).toBe(corrected); expect(original).toHaveBeenCalledTimes(1);
  expect(Array.from((palette.texture.image.data as Float32Array).subarray(0, 32))).toEqual(Array.from(matrices));
  expect((palette.texture.image.data as Float32Array)[corrected * 16 + 13]).toBe(.25);
  palette.texture.dispose();
});
