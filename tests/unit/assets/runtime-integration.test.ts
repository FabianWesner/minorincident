import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Box3, Color, Mesh, MeshBasicNodeMaterial, Vector3 } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import { AssetRegistry } from '../../../src/assets/registry';
import { characterNodes } from '../../../src/data/survivor';
import { batchRigidParts } from '../../../src/render/characters/batchRigidParts';
import { staticBatch } from '../../../src/assets/staticBatch';
import { loadCharacter, disposeCharacter } from '../../../src/render/characters/rig';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function load(url: string) {
  const file = readFileSync(`public${url}`);
  return (await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
}
test('production runtime exports are integrated, while missing exports retain their status @E17-AC09', () => {
  const files = new Set(execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0'));
  for (const def of manifest) if ('sourceGlb' in def && def.sourceGlb && files.has(def.sourceGlb) && files.has(def.glb)) expect(def.status, def.id).toBe('integrated');
});
test('runtime survivor rigs accept normalized heights and keep ground contact @E17-AC05 @E04-AC08', async () => {
  for (const variant of ['female', 'male'] as const) for (const lod of ['lod0', 'lod1'] as const) {
    const def = manifest.find(a => a.id === `char.survivor-${variant}`)!;
    const result = await loadCharacter(variant, () => load((lod === 'lod0' ? def.glb : def.lods!.lod1).replace('public', '')), def.dimensions.y);
    expect(result.source, result.reason ?? '').toBe('glb');
    const box = new Box3().setFromObject(result.model);
    expect(box.min.y).toBeCloseTo(0, 2); expect(box.max.y).toBeCloseTo(1.8, 2);
    disposeCharacter(result.model);
  }
});
test('static production batches preserve dimensions, reduce draws and exclude hidden geometry @E17-AC03', async () => {
  const registry = new AssetRegistry(event => { throw new Error(JSON.stringify(event)); }, { load });
  for (const id of ['bld.house-a', 'veh.sedan-red', 'prop.bench']) {
    const source = await registry.loadAsset(id, 'lod1'), before = new Box3().setFromObject(source), batch = staticBatch(source, true);
    let sourceMeshes = 0; source.traverse(node => { if (node instanceof Mesh) sourceMeshes++; });
    expect(batch.children.length).toBeLessThan(sourceMeshes);
    for (const node of batch.children) if (node instanceof Mesh) expect(node.geometry.index, 'Retain shared vertices in detailed static meshes').not.toBeNull();
    const after = new Box3().setFromObject(batch);
    expect(after.min.distanceTo(before.min)).toBeLessThan(.001); expect(after.max.distanceTo(before.max)).toBeLessThan(.001);
    batch.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); (node.material as import('three').Material).dispose(); } });
  }
  await registry.dispose();
});

test('invalid building LOD2 exports use in-bounds production geometry @E17-AC05', async () => {
  const logs: unknown[] = [], registry = new AssetRegistry(event => logs.push(event), { load });
  for (const id of ['bld.house-b', 'bld.house-c', 'bld.joes-diner']) {
    const model = await registry.loadAsset(id, 'lod2'), def = registry.definition(id);
    const size = new Box3().setFromObject(model).getSize(new Vector3());
    for (const axis of ['x', 'y', 'z'] as const) expect(Math.abs(size[axis] / def.dimensions[axis] - 1)).toBeLessThanOrEqual(def.dimensions.tolerance);
    expect(model.userData.placeholder).not.toBe(true);
  }
  expect(logs).toEqual([]); await registry.dispose();
});


test('batched survivor primitives preserve animated joint poses and sockets @E17-AC03', async () => {
  const def = manifest.find(a => a.id === 'char.survivor-female')!;
  const model = await load(def.lods!.lod1.replace('public', '')), head = model.getObjectByName('head')!, socket = model.getObjectByName('weaponSocketR');
  let before = 0; model.traverse(node => { if (node instanceof Mesh) before++; });
  head.rotation.y = .2; model.updateMatrixWorld(true);
  const expected: Vector3[] = [];
  head.traverse(node => { if (node instanceof Mesh) expected.push(new Vector3().fromBufferAttribute(node.geometry.getAttribute('position'), 0).applyMatrix4(node.matrixWorld)); });
  head.rotation.y = 0; model.updateMatrixWorld(true); const bounds = new Box3().setFromObject(model);
  const material = new MeshBasicNodeMaterial({ vertexColors: true });
  batchRigidParts(model, characterNodes, material, source => (source as import('three').MeshStandardMaterial).color ?? new Color('white'));
  expect(model.getObjectByName('weaponSocketR')).toBe(socket);
  const afterBounds = new Box3().setFromObject(model); expect(afterBounds.min.distanceTo(bounds.min)).toBeLessThan(.001); expect(afterBounds.max.distanceTo(bounds.max)).toBeLessThan(.001);
  let after = 0; model.traverse(node => { if (node instanceof Mesh) after++; }); expect(after).toBeLessThan(before / 2);
  head.rotation.y = .2; model.updateMatrixWorld(true);
  const actual: Vector3[] = [];
  head.traverse(node => { if (node instanceof Mesh) { const points = node.geometry.getAttribute('position'); for (let i = 0; i < points.count; i++) actual.push(new Vector3().fromBufferAttribute(points, i).applyMatrix4(node.matrixWorld)); } });
  for (const point of expected) expect(actual.some(candidate => candidate.distanceTo(point) < .001)).toBe(true);
  disposeCharacter(model); material.dispose();
});
