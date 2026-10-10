import { readFileSync } from 'node:fs';
import { CylinderGeometry, Matrix4, Vector3, type InstancedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { simplifyCrowdLod } from '../../../src/render/characters/crowdLodGeometry';
import { MeshoptDecoder } from 'meshoptimizer';
import { expect, test } from 'vitest';
import { bakeInfected, civilianClips } from '../../../src/render/characters/bakeInfected';
import { handTriangles, prepareGrip, removeAuthoredCane, gripReach } from '../../../src/render/npc/civilianGrip';
import { RoutineProps } from '../../../src/render/npc/RoutineProps';
import { boxOf, staticClipping, type TriangleSet } from '../../../src/debug/scenelab/geometry';
import type { CivilianProp } from '../../../src/sim/npc/types';

const models = ['man-a', 'man-b', 'woman-a', 'woman-b', 'elderly'];
for (const model of models) test(`@E08 native ${model} fingers clear all routine props`, async () => {
  const bytes = readFileSync(`public/assets/models/npc.civilian-${model}.glb`);
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  if (model === 'elderly') removeAuthoredCane(scene);
  const baked = bakeInfected(scene, [], false, civilianClips);
  prepareGrip(baked.geometry, baked.clip.parts.indexOf('handR'));
  const indexed = mergeVertices(baked.geometry); baked.geometry.dispose(); baked.geometry = indexed;
  await simplifyCrowdLod(baked.geometry, .005, .5);
  const hand = handTriangles(baked.geometry, baked.clip.parts.indexOf('handR'));
  const props = new RoutineProps(), matrix = new Matrix4(), point = new Vector3();
  for (const prop of ['coffee', 'phone', 'bag', 'cane', 'watering-can', 'parcel'] as CivilianProp[]) {
    props.begin(); props.held(prop, matrix, 1, hand, gripReach(hand));
    const mesh = props.children.find(m => (m as InstancedMesh).count > 0) as InstancedMesh;
    const propMatrix = new Matrix4(); mesh.getMatrixAt(0, propMatrix);
    const positions = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
    const tris = new Float32Array((index?.count ?? positions.count) * 3);
    for (let i = 0; i < tris.length / 3; i++) point.fromBufferAttribute(positions, index ? index.getX(i) : i).applyMatrix4(propMatrix).toArray(tris, i * 3);
    if (prop === 'phone') expect(boxOf(tris).min[0] - boxOf(hand).max[0]).toBeCloseTo(.001, 5);
    const sets: TriangleSet[] = [{ id: 'hand', assetId: model, tris: hand, box: boxOf(hand) }, { id: prop, assetId: prop, tris, box: boxOf(tris) }];
    expect(staticClipping(sets), `${model}/${prop}`).toEqual([]);
  }
  const native = handTriangles(baked.geometry, baked.clip.parts.indexOf('handR'), false);
  const oldCup = new CylinderGeometry(.07, .055, .16, 12).translate(0, .025, 0).toNonIndexed();
  const cup = oldCup.getAttribute('position').array as Float32Array;
  expect(staticClipping([{ id: 'native', assetId: model, tris: native, box: boxOf(native) }, { id: 'old-cup', assetId: 'coffee', tris: cup, box: boxOf(cup) }]).length).toBeGreaterThan(0);
  oldCup.dispose();
  props.dispose(); baked.geometry.dispose();
});
