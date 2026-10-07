import { readFileSync } from 'node:fs';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';

test('corgi and courier runtime model heights match the asset dimensions @E04 @E08', async () => {
  const heights: number[] = [];
  for (const id of ['char.corgi', 'char.courier-female']) {
    const asset = manifest.find(a => a.id === id)!; const file = readFileSync(asset.glb);
    const scene = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
    const height = new Box3().setFromObject(scene).getSize(new Vector3()).y; heights.push(height);
    expect(scene.scale.toArray()).toEqual([1, 1, 1]); expect(height).toBeCloseTo(asset.dimensions.y, 2);
  }
  expect(heights[0] / heights[1]).toBeCloseTo(.655, 2);
});
