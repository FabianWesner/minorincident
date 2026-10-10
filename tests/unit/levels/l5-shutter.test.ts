import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Matrix4, Mesh, Object3D, Vector3, type InstancedMesh } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { staticBatch } from '../../../src/assets/staticBatch';
import { InstancedGroup } from '../../../src/render/InstancedGroup';

test('T-E23-shutter @E23 @E23-AC15 the authored Metro shutter closes vertically at every W5 LOD and retains its pose after repartition', async () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  for (const suffix of ['', '.lod1', '.lod2']) {
    const file = readFileSync(`public/assets/models/bld.metro-entrance.w5${suffix}.glb`);
    const source = (await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
    expect(source.getObjectByName('shutter')).toBeDefined(); source.userData.splitDoors = ['shutter'];
    const prototype = staticBatch(source, false), ref = new Object3D();
    ref.position.set(30, 0, -40); ref.rotation.y = Math.PI / 2;
    const group = new InstancedGroup(prototype, [ref]);
    const shutterIndex = prototype.children.findIndex(child => child.userData.door === 'shutter');
    expect(shutterIndex).toBeGreaterThanOrEqual(0);
    const shutter = group.children[shutterIndex] as InstancedMesh;
    expect(shutter, suffix).toBeDefined();
    const matrix = new Matrix4(); shutter.getMatrixAt(0, matrix);
    const before = new Vector3().setFromMatrixPosition(matrix);
    for (const fraction of [.25, .5, 1]) {
      group.slide('shutter', -1.2 * fraction, ref); shutter.getMatrixAt(0, matrix);
      const after = new Vector3().setFromMatrixPosition(matrix);
      expect(after.x).toBeCloseTo(before.x, 5); expect(after.z).toBeCloseTo(before.z, 5);
      expect(after.y).toBeCloseTo(before.y - 1.2 * fraction, 5);
    }
    const repartitioned = new InstancedGroup(prototype, [ref]);
    const restored = repartitioned.children[shutterIndex] as InstancedMesh;
    const back = new Matrix4(); restored.getMatrixAt(0, back);
    expect(back.elements).toEqual(matrix.elements);
    group.dispose(); repartitioned.dispose();
    for (const root of [source, prototype]) root.traverse(child => {
      if (!(child instanceof Mesh)) return;
      child.geometry.dispose(); for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
    });
  }
});
