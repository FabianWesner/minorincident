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
