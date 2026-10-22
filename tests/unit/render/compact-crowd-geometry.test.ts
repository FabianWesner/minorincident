import { BufferAttribute, BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute } from 'three';
import { expect, test } from 'vitest';
import { compactCrowdGeometry } from '../../../src/render/characters/compactCrowdGeometry';

function expanded(g: BufferGeometry) {
  return Object.fromEntries(Object.entries(g.attributes).map(([name, a]) => {
    const data = 'data' in a ? a.data.array : a.array;
    return [name, Array.from(g.index!.array).flatMap(i => {
      const offset = 'data' in a ? i * a.data.stride + a.offset : i * a.itemSize;
      return Array.from(data.subarray(offset, offset + a.itemSize));
    })];
  }));
}

test('@E28-AC10 @E25-AC14 @E29-AC19 compaction discards only unreferenced vertices and retains exact drawn attribute bytes', () => {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([99, 99, 99, 1, 2, 3, 4, 5, 6, 98, 98, 98, 7, 8, 9]), 3));
  g.setAttribute('color', new BufferAttribute(new Uint8Array([255, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]), 3, true));
  g.setAttribute('_part_index', new InterleavedBufferAttribute(new InterleavedBuffer(new Uint16Array([500, 0, 501, 1, 502, 2, 503, 3, 504, 4]), 2), 1, 1));
  g.setIndex([4, 1, 2, 2, 1, 4]); g.addGroup(0, 3, 2); g.setDrawRange(0, 6);
  g.computeBoundingBox(); g.computeBoundingSphere();
  const before = expanded(g), bounds = g.boundingBox!.clone(), sphere = g.boundingSphere!.clone();
  compactCrowdGeometry(g);
  expect(g.getAttribute('position').count).toBe(3);
  expect(expanded(g)).toEqual(before);
  expect(g.getAttribute('color').normalized).toBe(true);
  expect(g.getAttribute('color').array).toBeInstanceOf(Uint8Array);
  expect(g.getAttribute('_part_index').array).toBeInstanceOf(Uint16Array);
  expect(g.groups).toEqual([{ start: 0, count: 3, materialIndex: 2 }]);
  expect(g.drawRange).toEqual({ start: 0, count: 6 });
  expect(g.boundingBox).toEqual(bounds); expect(g.boundingSphere).toEqual(sphere);
  const attributes = { ...g.attributes }, index = g.index;
  compactCrowdGeometry(g);
  for (const [name, a] of Object.entries(attributes)) expect(g.getAttribute(name)).toBe(a);
  expect(g.index).toBe(index);
});

test('@E28-AC10 @E25-AC14 @E29-AC19 prepared crowd clones share immutable arrays with independent geometry and GPU wrappers', async () => {
  const { cloneCrowdGeometry } = await import('../../../src/render/characters/cloneCrowdGeometry');
  const source = new BufferGeometry();
  source.setAttribute('position', new BufferAttribute(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), 3));
  source.setAttribute('color', new BufferAttribute(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]), 3, true));
  source.setIndex([0, 1, 2]); source.userData.crowdLod = 'lod2'; source.computeBoundingBox();
  const a = cloneCrowdGeometry(source), b = cloneCrowdGeometry(source);
  expect(expanded(a)).toEqual(expanded(source));
  for (const name of Object.keys(source.attributes)) {
    expect(a.getAttribute(name)).not.toBe(source.getAttribute(name));
    expect(a.getAttribute(name)).not.toBe(b.getAttribute(name));
    expect(a.getAttribute(name).array).toBe(source.getAttribute(name).array);
  }
  expect(a.index).not.toBe(source.index); expect(a.index!.array).toBe(source.index!.array);
  expect(a.userData).not.toBe(source.userData); expect(a.boundingBox).not.toBe(source.boundingBox);
  a.setAttribute('_state', new BufferAttribute(new Float32Array(4), 4)); a.userData.crowdLod = 'lod1';
  expect(source.hasAttribute('_state')).toBe(false); expect(b.hasAttribute('_state')).toBe(false);
  expect(source.userData.crowdLod).toBe('lod2');
  a.dispose(); expect(expanded(b)).toEqual(expanded(source));
});
