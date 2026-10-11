import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
import { simplifyCrowdLod } from '../../../src/render/characters/crowdLodGeometry';
import { packCrowdParts } from '../../../src/assets/crowdParts';

test('T-E29-19-corpses @E29-AC19 settled crowd bodies keep positions/colors/rig ownership with fewer triangles', async () => {
  const bytes = readFileSync('public/assets/models/inf.common-worker.lod2.glb');
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const baked = bakeInfected(scene); deinterleaveGeometry(baked.geometry);
  const live = mergeVertices(baked.geometry); baked.geometry.dispose();
  await simplifyCrowdLod(live);
  const corpse = live.clone(); await simplifyCrowdLod(corpse, .04, .1);
  expect(corpse.index!.count).toBeLessThan(live.index!.count);
  expect(corpse.userData.crowdLodError).toBeLessThanOrEqual(.04);
  for (const name of ['position', 'color', '_part_index']) expect(corpse.getAttribute(name).array).toEqual(live.getAttribute(name).array);
  const index = corpse.index!, owner = corpse.getAttribute('_part_index');
  for (let i = 0; i < index.count; i += 3) {
    expect(owner.getX(index.getX(i + 1))).toBe(owner.getX(index.getX(i)));
    expect(owner.getX(index.getX(i + 2))).toBe(owner.getX(index.getX(i)));
  }
  const phone = live.clone(); await simplifyCrowdLod(phone, .025, .2);
  expect(phone.index!.count).toBeLessThan(live.index!.count);
  expect(phone.userData.crowdLodError).toBeLessThanOrEqual(.025);
  packCrowdParts(corpse); packCrowdParts(phone);
  expect(corpse.getAttribute('_parts').count).toBe(corpse.getAttribute('position').count);
  expect(phone.getAttribute('_parts').count).toBe(phone.getAttribute('position').count);
  phone.dispose();
  corpse.dispose(); live.dispose();
});
