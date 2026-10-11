import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { expect, test } from 'vitest';
import { bakeInfected, civilianClips } from '../../../src/render/characters/bakeInfected';
import { simplifyCrowdLod } from '../../../src/render/characters/crowdLodGeometry';
import { handTriangles, prepareGrip } from '../../../src/render/npc/civilianGrip';

test('@E18-AC01 @perf far worker reduces geometry while retaining every vertex channel and rigid-part ownership', async () => {
  const file = readFileSync('public/assets/models/inf.common-worker.lod2.glb');
  const model = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const baked = bakeInfected(model.scene); deinterleaveGeometry(baked.geometry);
  const geometry = mergeVertices(baked.geometry); baked.geometry.dispose();
  const before = geometry.index!.count, attributes = { ...geometry.attributes };
  const eyes = new Set(Array.from(geometry.index!.array).filter(i => geometry.getAttribute('_emissive').getX(i) > .5));
  await simplifyCrowdLod(geometry);
  console.log({ before: before / 3, after: geometry.index!.count / 3 });
  expect(geometry.index!.count).toBeLessThan(before * .9); // crowd-feel rebuilt this LOD2 already lean (3782 tris): only a bounded further reduction remains
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

test('T-E25-14g @E25 @E25-AC14 gripped far civilian remains within its authored triangle count and retains vertex channels', async () => {
  const bytes = readFileSync('public/assets/models/npc.civilian-man-a.lod2.glb');
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const baked = bakeInfected(scene, [], false, civilianClips), handPart = baked.clip.parts.indexOf('handR');
  const authoredTriangles = baked.geometry.getAttribute('position').count / 3;
  prepareGrip(baked.geometry, handPart);
  const geometry = mergeVertices(baked.geometry); baked.geometry.dispose();
  const attributes = { ...geometry.attributes };
  await simplifyCrowdLod(geometry, .01, .35);
  expect(geometry.index!.count / 3).toBeLessThanOrEqual(authoredTriangles);
  expect(geometry.userData.crowdLodError).toBeLessThanOrEqual(.01);
  expect(handTriangles(geometry, handPart).length).toBeGreaterThan(0);
  for (const [name, attribute] of Object.entries(attributes)) expect(geometry.getAttribute(name)).toBe(attribute);
  geometry.dispose();
});
