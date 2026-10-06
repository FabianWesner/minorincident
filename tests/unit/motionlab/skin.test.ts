import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { SkinnedMesh, Vector3, type Group } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { LabCrowd } from '../../../src/debug/motionlab/Crowd';
import { motion, steer } from '../../../src/debug/motionlab/Motion';
import { skinFigure } from '../../../src/debug/motionlab/Skin';

test('motion lab joint weights preserve rest geometry and independent clone bones', async () => {
  const buffer = await readFile('public/assets/models/char.survivor-female.lod1.glb');
  const parsed = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  const model = skinFigure(parsed.scene as Group), mesh = model.getObjectByName('lab-skin') as SkinnedMesh;
  model.updateMatrixWorld(true); const weights = mesh.geometry.getAttribute('skinWeight'), vertices = mesh.geometry.getAttribute('position'); let blended = 0;
  for (let i = 0; i < weights.count; i++) {
    expect(weights.getX(i) + weights.getY(i)).toBeCloseTo(1, 6);
    if (weights.getY(i) > 0) blended++;
    if (i % 101 === 0) expect(mesh.getVertexPosition(i, new Vector3()).distanceTo(new Vector3().fromBufferAttribute(vertices, i))).toBeLessThan(.00001);
  }
  expect(blended).toBeGreaterThan(0);
  const copied = clone(model), knee = copied.getObjectByName('shinL')!;
  expect(knee).not.toBe(model.getObjectByName('shinL')); knee.rotation.z += .5;
  expect(knee.rotation.z).not.toBe(model.getObjectByName('shinL')!.rotation.z);
  mesh.skeleton.dispose(); mesh.geometry.dispose(); (mesh.material as import('three').Material).dispose();
});

test('motion lab crowd palettes yield finite landmarks and use one instanced mesh', async () => {
  const buffer = await readFile('public/assets/models/inf.jogger.lod1.glb');
  const parsed = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
  for (const prototype of [false, true]) {
    const model = parsed.scene.clone(true) as Group;
    const crowd = new LabCrowd(prototype ? skinFigure(model) : model, 200, prototype), state = motion();
    for (let i = 0; i < 120; i++) { steer(state, { x: 1, z: 0 }, 2.4, prototype); crowd.update([state], [new Vector3(state.x, 0, state.z)]); }
    expect(crowd.mesh.isInstancedMesh).toBe(true); expect(crowd.mesh.count).toBe(1);
    for (const name of ['head', 'footL']) expect(crowd.landmark(0, name).toArray().every(Number.isFinite)).toBe(true);
    crowd.dispose();
  }
});
