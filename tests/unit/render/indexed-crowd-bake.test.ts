import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakeInfected, framesPerClip, infectedClips } from '../../../src/render/characters/bakeInfected';
import * as clips from '../../../src/render/characters/clips';
import { mergeCrowdVertices } from '../../../src/render/characters/mergeCrowdVertices';

const digest = (values: ArrayBufferView) => createHash('sha256').update(new Uint8Array(values.buffer, values.byteOffset, values.byteLength)).digest('hex');

test.each(['inf.common-worker', 'inf.common-worker.lod1', 'inf.common-worker.lod2', 'inf.jogger', 'inf.jogger.lod1', 'inf.jogger.lod2', 'inf.dog.lod1', 'inf.mega-alpha', 'inf.mega-alpha.lod1', 'inf.mega-alpha.lod2'])('%s indexed bake retains exact welded triangles, channels and animation', async asset => {
  const bytes = readFileSync(`public/assets/models/${asset}.glb`);
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const expanded = bakeInfected(scene.clone(true));
  const indexed = bakeInfected(scene.clone(true), [], false, undefined, undefined, true);
  expect(indexed.geometry.getAttribute('position').count).toBeLessThan(expanded.geometry.getAttribute('position').count);
  expect(digest(new Float32Array(indexed.clip.matrices))).toBe(digest(new Float32Array(expanded.clip.matrices)));
  deinterleaveGeometry(expanded.geometry); deinterleaveGeometry(indexed.geometry);
  const before = mergeVertices(expanded.geometry), after = mergeCrowdVertices(indexed.geometry);
  expect(digest(after.index!.array)).toBe(digest(before.index!.array));
  expect(Object.keys(after.attributes)).toEqual(Object.keys(before.attributes));
  for (const name of Object.keys(before.attributes)) expect(digest(after.getAttribute(name).array), name).toBe(digest(before.getAttribute(name).array));
  for (const geometry of [expanded.geometry, indexed.geometry, before, after]) geometry.dispose();
});

test('indexed weld retains first-use quantization and restores its source index', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([1, 0, 0, 1.00001, 0, 0, 0, 0, 0]), 3));
  geometry.setIndex([1, 2, 0, 0, 2, 1]);
  const source = geometry.index, expected = mergeVertices(geometry), actual = mergeCrowdVertices(geometry);
  expect(geometry.index).toBe(source);
  expect(actual.index!.array).toEqual(expected.index!.array);
  expect(actual.getAttribute('position').array).toEqual(expected.getAttribute('position').array);
});

test('a fresh human LOD reuses non-ground samples from its identical skeleton', async () => {
  const sample = vi.spyOn(clips, 'sampleClip');
  try {
    for (const suffix of ['', '.lod1']) {
      const bytes = readFileSync(`public/assets/models/inf.common-worker${suffix}.glb`);
      const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
      sample.mockClear();
      const baked = bakeInfected(scene, [], false, undefined, undefined, true);
      if (suffix) expect(sample.mock.calls.length).toBeLessThan(infectedClips.length * framesPerClip);
      baked.geometry.dispose();
    }
  } finally { sample.mockRestore(); }
});
