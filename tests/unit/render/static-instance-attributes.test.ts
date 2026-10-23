import { expect, test, vi } from 'vitest';
import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, PerspectiveCamera, Scene } from 'three/webgpu';
import { positionLocal } from 'three/tsl';
// @ts-expect-error Three's internal module has no declaration
import RenderObjects from 'three/src/renderers/common/RenderObjects.js';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import { staticInstanceAttributes } from '../../../src/render/StaticInstanceAttributes';
import { installPaletteVariantCache } from '../../../src/render/Renderer';
import type { PaletteMaterial } from '../../../src/render/PaletteMaterial';

test('T-E22-20-static-transform @E22-AC20 equivalent material copies retain the warmed placement node', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), source = materials.get('sidewalk');
  source.userData.batchFeatures = '0:0:0';
  const copies = [source.frozenCopy(), source.frozenCopy(), source.frozenCopy(), source.frozenCopy()];
  copies[2].userData.batchFeatures = 'corpses'; copies[3].positionNode = positionLocal.add(1);
  const geometry = new BoxGeometry();
  const meshes = copies.map(material => {
    const mesh = new InstancedMesh(geometry, material, 2);
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(6).fill(1), 3);
    expect(staticInstanceAttributes(mesh)).toBe(true); return mesh;
  });
  try {
    const [a, b, corpse, deformed] = meshes.map(mesh => mesh.material as PaletteMaterial);
    expect(a.positionNode === b.positionNode, 'a new material owner must reuse the equivalent placement graph').toBe(true);
    expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
    expect(corpse.positionNode).not.toBe(a.positionNode); expect(deformed.positionNode).not.toBe(a.positionNode);
    expect(meshes[0].geometry.getAttribute('_placement0')).not.toBe(meshes[1].geometry.getAttribute('_placement0'));
  } finally {
    for (const mesh of meshes) { mesh.geometry.dispose(); mesh.dispose(); }
    for (const material of copies) material.dispose();
    geometry.dispose(); materials.dispose(); lighting.dispose();
  }
});

test('static batches share shader keys while keeping independent matrix/color buffers and counts', () => {
  const scene = new Scene(), lighting = new Lighting(scene), materials = new Materials(lighting), source = materials.get('sidewalk');
  source.userData.batchFeatures = '0:0:0';
  const geometry = new BoxGeometry(), camera = new PerspectiveCamera();
  const make = (count: number, x: number) => {
    const mesh = new InstancedMesh(geometry, source, count);
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(count * 3).fill(x), 3);
    mesh.setMatrixAt(0, new Matrix4().makeTranslation(x, 0, 0));
    expect(staticInstanceAttributes(mesh)).toBe(true); return mesh;
  };
  const a = make(2, 3), b = make(9, 7);
  expect(a.material).toBe(b.material); expect(a.geometry).not.toBe(b.geometry);
  const matrixA = a.geometry.getAttribute('_placement0') as import('three').InterleavedBufferAttribute;
  const matrixB = b.geometry.getAttribute('_placement0') as import('three').InterleavedBufferAttribute;
  expect(matrixA.data.array).toBe(a.instanceMatrix.array); expect(matrixB.data.array).toBe(b.instanceMatrix.array);
  expect(matrixA.data).not.toBe(matrixB.data); expect('isInstancedInterleavedBuffer' in matrixA.data).toBe(true);
  expect(a.geometry.getAttribute('_placementColor')).toBe(a.instanceColor);
  expect(b.geometry.getAttribute('_placementColor')).toBe(b.instanceColor);
  a.instanceMatrix.needsUpdate = true;
  a.onBeforeRender({} as never, scene, camera, a.geometry, a.material as never, null as never);
  expect(matrixA.data.version).toBe(a.instanceMatrix.version); expect(matrixB.data.version).toBe(0);
  expect(geometry.hasAttribute('_placement0')).toBe(false);
  const Manager = RenderObjects as unknown as new (...args: unknown[]) => { get(...args: unknown[]): { getCacheKey(): number }; dispose(): void };
  const nodes = { getCacheKey: () => 0, delete: vi.fn() }, objects = new Manager({ backend: {}, contextNode: { id: 1, version: 0 }, _currentSourceMaterial: null }, nodes, {}, { delete: vi.fn() }, { deleteForRender: vi.fn() }, {});
  installPaletteVariantCache(objects); const lights = {}, context = { id: 1 };
  const get = (mesh: InstancedMesh) => objects.get(mesh, mesh.material, scene, camera, lights, context, null);
  const key = get(a).getCacheKey(); expect(get(b).getCacheKey()).toBe(key);
  expect(a.count).toBe(2); expect(b.count).toBe(9);
  b.count = 0; expect(get(b).getCacheKey()).toBe(key); expect(b.count).toBe(0);
  expect(a.geometry.getAttribute('position')).not.toBe(b.geometry.getAttribute('position'));
  expect(a.geometry.getAttribute('position').array).toBe(geometry.getAttribute('position').array);
  expect(b.geometry.getAttribute('position').array).toBe(geometry.getAttribute('position').array);
  const mask = new MeshBasicNodeMaterial();
  const maskA = objects.get(a, mask, scene, camera, lights, context, null); expect(a.isInstancedMesh).toBe(true);
  const maskB = objects.get(b, mask, scene, camera, lights, context, null); expect(b.isInstancedMesh).toBe(true);
  expect(maskA.getCacheKey()).not.toBe(maskB.getCacheKey());
  expect(get(a).getCacheKey()).toBe(key); expect(a.isInstancedMesh).toBe(false);
  mask.dispose();
  b.geometry.deleteAttribute('normal'); expect(get(b).getCacheKey()).not.toBe(key);
  objects.dispose(); a.geometry.dispose(); b.geometry.dispose(); geometry.dispose(); a.dispose(); b.dispose(); materials.dispose(); lighting.dispose();
});
