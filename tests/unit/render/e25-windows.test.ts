import { readFileSync } from 'node:fs';
import { Mesh, Scene } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { test, expect } from 'vitest';
import { staticBatch } from '../../../src/assets/staticBatch';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';

test('T-E25-12s @E25 @E25-AC12 real house windows retain power indices and normalized room coordinates in every LOD', async () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  try {
    for (const lod of ['', '.lod1', '.lod2']) {
      const file = readFileSync(`public/assets/models/bld.house-a${lod}.glb`);
      const root = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
      root.userData.assetId = 'bld.house-a';
      const batch = staticBatch(root, true, materials), mesh = batch.getObjectByName('window-light') as Mesh;
      const body = batch.getObjectByName('static-body') as Mesh;
      for (const attribute of ['_light', '_window', '_windowUV', '_surface']) expect(body.geometry.hasAttribute(attribute), `${lod} matte body ${attribute}`).toBe(false);
      const buffers = new Set(Object.values(mesh.geometry.attributes).map(input => 'data' in input ? input.data : input));
      // InstancedGroup replaces _lightBase and adds matrix and identity tint.
      expect(buffers.size + 2, `${lod} portable WebGPU vertex-buffer limit`).toBeLessThanOrEqual(8);
      const mask = mesh.geometry.getAttribute('_window'), power = mesh.geometry.getAttribute('_light'), uv = mesh.geometry.getAttribute('_windowUV');
      const windows = Array.from({ length: mask.count }, (_, i) => i).filter(i => mask.getX(i) === 1);
      expect(windows.length, lod).toBeGreaterThan(0);
      expect(windows.every(i => power.getX(i) >= 0)).toBe(true);
      expect(Math.max(...windows.map(i => uv.getX(i)))).toBeGreaterThanOrEqual(.99);
      expect(Math.min(...windows.map(i => uv.getX(i)))).toBeLessThanOrEqual(.01);
    }
  } finally { materials.dispose(); lighting.dispose(); }
});

test('T-E25-11s @E25 @E25-AC11 shipped car primitives preserve gloss paint, environment-dominant chrome, and matte tyres', async () => {
  const { AssetMaterials } = await import('../../../src/assets/materials');
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  const file = readFileSync('public/assets/models/veh.sedan-green.glb');
  const root = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
  root.userData.assetId = 'veh.sedan-green'; new AssetMaterials(materials).swap(root, true);
  const paint: number[] = [], chrome: number[] = [], tyres: number[] = [];
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (material.name === 'pal_backpackTeal') paint.push(material.userData.surfaceClass);
      if (material.name === 'pal_sidewalk') chrome.push(material.userData.surfaceClass);
      let wheel = false; for (let part: import('three').Object3D | null = node; part; part = part.parent) if (/wheel/i.test(part.name)) wheel = true;
      if (wheel && material.name === 'pal_uiDark') tyres.push(material.userData.surfaceClass);
    }
  });
  expect(paint.length).toBeGreaterThan(0); expect(paint.every(value => value === 1)).toBe(true);
  expect(chrome.length).toBeGreaterThan(0); expect(chrome.every(value => value === 2)).toBe(true);
  expect(tyres.length).toBeGreaterThan(0); expect(tyres.every(value => value === 0)).toBe(true);
  materials.dispose(); lighting.dispose();
});

test('T-E25-05p @E25 tinted and plain instances use one warmed vertex-input layout and clear old tint', async () => {
  const { BoxGeometry, Group, Object3D, MeshLambertNodeMaterial, Color } = await import('three/webgpu');
  const { InstancedGroup } = await import('../../../src/render/InstancedGroup');
  const geometry = new BoxGeometry(), material = new MeshLambertNodeMaterial(), prototype = new Group(); prototype.add(new Mesh(geometry, material));
  const plain = new Object3D(), tinted = new Object3D(); tinted.userData.tint = '#713b22';
  const batch = new InstancedGroup(prototype, [tinted, plain]), mesh = batch.children[0] as import('three').InstancedMesh;
  expect(mesh.instanceColor).not.toBeNull();
  const color = new Color(); mesh.getColorAt(1, color); expect(color.getHex()).toBe(0xffffff);
  batch.references.splice(0, 2, plain, tinted); batch.update(); mesh.getColorAt(0, color); expect(color.getHex()).toBe(0xffffff);
  mesh.getColorAt(1, color); expect(color.getHex()).toBe(0x713b22);
  batch.dispose(); geometry.dispose(); material.dispose();
});

test('T-E25-11p T-E25-12p @E25 shared district materials preserve window and polished-floor shader graphs', async () => {
  const { Group, BoxGeometry, MeshLambertNodeMaterial } = await import('three/webgpu');
  const { DistrictAssets } = await import('../../../src/assets/DistrictAssets');
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), assets = new DistrictAssets(materials);
  const share = (assets as unknown as { share(root: import('three').Group): void }).share.bind(assets);
  const geometry = new BoxGeometry(), roots: import('three').Group[] = [];
  for (const features of ['0:0:0', '1:0:0', '0:1:1', '0:0:0']) {
    const root = new Group(), material = new MeshLambertNodeMaterial(); material.userData.batchFeatures = features;
    const mesh = new Mesh(geometry, material); mesh.name = 'static-body'; root.add(mesh); roots.push(root); share(root);
  }
  const mats = roots.map(root => (root.children[0] as Mesh).material);
  expect(mats[0]).toBe(mats[3]); expect(mats[0]).not.toBe(mats[1]); expect(mats[0]).not.toBe(mats[2]);
  assets.dispose(); geometry.dispose(); materials.dispose(); lighting.dispose();
});


test('T-E25-13b @E25 @E25-AC13 shared light-bearing dressing keeps the player see-through graph', async () => {
  const { Group, BoxGeometry } = await import('three/webgpu');
  const { color } = await import('three/tsl');
  const { DistrictAssets } = await import('../../../src/assets/DistrictAssets');
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), assets = new DistrictAssets(materials);
  const share = (assets as unknown as { share(root: import('three').Group): void }).share.bind(assets);
  const geometry = new BoxGeometry();
  for (const name of ['static-body', 'window-light']) {
    const root = new Group(), material = materials.shaded(color('#283344'));
    const mesh = new Mesh(geometry, material); mesh.name = name; root.add(mesh); share(root);
    expect(material.userData.seeThrough, name).toBe(true);
  }
  assets.dispose(); geometry.dispose(); materials.dispose(); lighting.dispose();
});
