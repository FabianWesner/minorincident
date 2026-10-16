import { expect, test } from 'vitest';
import { InstancedInterleavedBuffer, InterleavedBufferAttribute } from 'three/webgpu';
// @ts-expect-error Three's backend utility has no declaration.
import WebGPUAttributeUtils from 'three/src/renderers/webgpu/utils/WebGPUAttributeUtils.js';
import { installInterleavedBufferDisposal } from '../../../src/render/Renderer';

test('@E18-AC05 WebGPU interleaved columns upload fresh buffers after level retirement', () => {
  const records = new WeakMap<object, { buffer?: { destroyed: boolean } }>();
  const buffers: { destroyed: boolean }[] = [];
  const backend = {
    get(key: object) { let data = records.get(key); if (!data) { data = {}; records.set(key, data); } return data; },
    delete(key: object) { records.delete(key); },
    device: {
      createBuffer({ size }: { size: number }) {
        const buffer = { destroyed: false, getMappedRange: () => new ArrayBuffer(size), unmap() {}, destroy() { this.destroyed = true; } };
        buffers.push(buffer); return buffer;
      },
    },
    destroyAttribute(attribute: object) { utils.destroyAttribute(attribute); },
  };
  const utils = new WebGPUAttributeUtils(backend);
  installInterleavedBufferDisposal(backend);
  const data = new InstancedInterleavedBuffer(new Float32Array(32), 16);
  const first = new InterleavedBufferAttribute(data, 4, 0), second = new InterleavedBufferAttribute(data, 4, 4);
  utils.createAttribute(first, 0); utils.createAttribute(second, 0);
  expect(buffers).toHaveLength(1);
  backend.destroyAttribute(first); backend.destroyAttribute(second);
  expect(buffers[0].destroyed).toBe(true);
  expect(backend.get(data).buffer).toBeUndefined();
  utils.createAttribute(second, 0);
  expect(buffers).toHaveLength(2);
  expect(backend.get(data).buffer).toBe(buffers[1]);
  expect(buffers[1].destroyed).toBe(false);
});
