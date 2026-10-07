import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { expect, test } from 'vitest';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
import { simplifyCrowdLod } from '../../../src/render/characters/crowdLodGeometry';

test('@E18-AC01 @perf far worker reduces geometry while retaining every vertex channel and rigid-part ownership', async () => {
  const file = readFileSync('public/assets/models/inf.common-worker.lod2.glb');
  const model = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const baked = bakeInfected(model.scene); deinterleaveGeometry(baked.geometry);
  const geometry = mergeVertices(baked.geometry); baked.geometry.dispose();
  const before = geometry.index!.count, attributes = { ...geometry.attributes };
  const eyes = new Set(Array.from(geometry.index!.array).filter(i => geometry.getAttribute('_emissive').getX(i) > .5));
  await simplifyCrowdLod(geometry);
  console.log({ before: before / 3, after: geometry.index!.count / 3 });
  expect(geometry.index!.count).toBeLessThan(before * .6);
  expect(geometry.index!.count).toBeGreaterThan(0);
  expect(geometry.userData.crowdLodError).toBeLessThanOrEqual(.01);
  const retained = new Set(Array.from(geometry.index!.array));
  for (const eye of eyes) expect(retained.has(eye)).toBe(true);
  for (const [name, attribute] of Object.entries(attributes)) expect(geometry.getAttribute(name)).toBe(attribute);
  const parts = geometry.getAttribute('_part_index'), indices = geometry.index!;
  for (let i = 0; i < indices.count; i += 3) {
    expect(parts.getX(indices.getX(i))).toBe(parts.getX(indices.getX(i + 1)));
    expect(parts.getX(indices.getX(i))).toBe(parts.getX(indices.getX(i + 2)));
  }
  geometry.dispose();
});
