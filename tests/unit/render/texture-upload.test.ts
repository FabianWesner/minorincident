import { expect, test, vi } from 'vitest';
import { uploadFloatTexture, type FloatUploadDevice } from '../../../src/render/TextureUpload';
import { installTextureRanges } from '../../../src/render/TextureRanges';
import { DataTexture, FloatType, RGBAFormat } from 'three';

function device() {
  let bytes = new ArrayBuffer(0);
  const buffer = { getMappedRange: () => bytes, unmap: vi.fn(), destroy: vi.fn() };
  const command = {}, encoder = { copyBufferToTexture: vi.fn(), finish: () => command };
  const gpu = { createBuffer: vi.fn(({ size }: { size: number }) => { bytes = new ArrayBuffer(size); return buffer; }), createCommandEncoder: vi.fn(() => encoder), queue: { submit: vi.fn() } };
  return { gpu, buffer, encoder, command, bytes: () => new Uint8Array(bytes) };
}

for (const width of [4, 16, 76]) test(`@E18 lossless float upload preserves ${width}-texel rows, subarray offsets and 256-byte alignment`, () => {
  const d = device(), texture = {}, backing = Float32Array.from({ length: width * 8 + 4 }, (_, i) => i * .12345), pixels = backing.subarray(4);
  uploadFloatTexture(d.gpu, texture, pixels, width, 2);
  const stride = Math.ceil(width * 16 / 256) * 256;
  expect(d.gpu.createBuffer).toHaveBeenCalledWith({ label: 'pose atlas upload', size: stride * 2, usage: 4, mappedAtCreation: true });
  const source = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  for (let row = 0; row < 2; row++) {
    expect(d.bytes().slice(row * stride, row * stride + width * 16)).toEqual(source.slice(row * width * 16, (row + 1) * width * 16));
    expect(d.bytes().slice(row * stride + width * 16, (row + 1) * stride).every(v => v === 0)).toBe(true);
  }
  expect(d.encoder.copyBufferToTexture).toHaveBeenCalledWith({ buffer: d.buffer, bytesPerRow: stride, rowsPerImage: 2 }, { texture }, { width, height: 2, depthOrArrayLayers: 1 });
  expect(d.gpu.queue.submit).toHaveBeenCalledWith([d.command]);
  expect(d.buffer.unmap.mock.invocationCallOrder[0]).toBeLessThan(d.encoder.copyBufferToTexture.mock.invocationCallOrder[0]);
  expect(d.gpu.queue.submit.mock.invocationCallOrder[0]).toBeLessThan(d.buffer.destroy.mock.invocationCallOrder[0]);
});

test('@E18 cold and recreated WebGPU atlases use mapped copies; mutable rows retain range uploads', () => {
  const d = device(), original = vi.fn(), write = vi.fn(), data = { texture: {}, glTextureType: 0, glFormat: 0, glType: 0 };
  const backend = { ...d.gpu, device: { ...d.gpu, queue: { ...d.gpu.queue, writeTexture: write } } as FloatUploadDevice, get: () => data, updateTexture: original };
  const texture = new DataTexture(new Float32Array(128), 4, 8, RGBAFormat, FloatType);
  installTextureRanges(backend); backend.updateTexture(texture, {});
  expect(original).not.toHaveBeenCalled(); expect(d.gpu.queue.submit).toHaveBeenCalledOnce();
  // Repeated full updates (e.g. bone textures) retain Three's inexpensive warm path.
  backend.updateTexture(texture, {}); expect(original).toHaveBeenCalledOnce(); expect(d.gpu.queue.submit).toHaveBeenCalledOnce();
  texture.addUpdateRange(96, 32); backend.updateTexture(texture, {});
  expect(write).toHaveBeenCalledOnce(); expect(d.gpu.queue.submit).toHaveBeenCalledOnce();
  data.texture = {}; texture.addUpdateRange(96, 32); backend.updateTexture(texture, {});
  expect(d.gpu.queue.submit).toHaveBeenCalledTimes(2); texture.dispose();
});
