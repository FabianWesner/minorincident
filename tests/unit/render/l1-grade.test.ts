import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { BoxGeometry, Float32BufferAttribute, Group, Mesh, MeshLambertNodeMaterial, MeshStandardMaterial, Scene } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { AssetRegistry } from '../../../src/assets/registry';
import { AssetMaterials } from '../../../src/assets/materials';
import { staticBatch } from '../../../src/assets/staticBatch';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import { PaletteMaterial } from '../../../src/render/PaletteMaterial';
import { View } from '../../../src/render/View';
import { paletteTokens } from '../../../src/data/palette';
import type { DistrictLayout } from '../../../src/levels/districts/types';

const layout = (id: string) => JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8')) as DistrictLayout;

test('@E19 L1 scene built from production world assets contains no plain Lambert/Standard materials', async () => {
  const scene = new Scene(), lighting = new Lighting(scene), materials = new Materials(lighting);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const registry = new AssetRegistry(() => {}, { materials, load: async url => {
    const data = readFileSync(`public${url}`);
    return (await loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')).scene;
  } });
  const ids = new Set(['D-RES', 'D-MAIN', 'D-SHOP'].flatMap(id => layout(id).placements.map(p => p.assetId)));
  const aliases: Record<string, string> = { 'bld.pharmacy': 'int.pharmacy-clinic' };
  for (const id of ids) {
    const asset = await registry.loadAsset(aliases[id] ?? id, 'lod1');
    const batch = staticBatch(asset, true, materials, ['prop.tree', 'prop.hedge'].includes(id));
    scene.add(asset, batch);
  }
  let meshes = 0, emissives = 0;
  scene.traverse(node => {
    if (!(node instanceof Mesh)) return;
    meshes++;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      expect(material instanceof MeshStandardMaterial, `${node.name}: ${material.name}`).toBe(false);
      expect(material instanceof MeshLambertNodeMaterial && !(material instanceof PaletteMaterial), `${node.name}: ${material.name}`).toBe(false);
      if (material.name.startsWith('emi_')) { expect(material.userData.emissiveStrength).toBeGreaterThanOrEqual(1.5); emissives++; }
    }
  });
  expect(meshes).toBeGreaterThan(30); expect(emissives).toBeGreaterThanOrEqual(3);
  await registry.dispose(); materials.dispose(); lighting.dispose();
}, 60_000);

test('@E19 imported vertex-color and emissive variants share the palette shader', () => {
  const scene = new Scene(), lighting = new Lighting(scene), materials = new Materials(lighting), swap = new AssetMaterials(materials), root = new Group();
  const geometry = new BoxGeometry(); geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(.8), 3));
  for (const name of ['pal_brick', 'emi_windowGlow', 'emi_infectedEye']) {
    const material = new MeshStandardMaterial(); material.name = name; root.add(new Mesh(geometry, material));
  }
  swap.swap(root);
  root.traverse(node => { if (node instanceof Mesh) {
    expect(node.material).toBeInstanceOf(PaletteMaterial);
    const material = node.material as PaletteMaterial;
    if (material.name.startsWith('emi_')) expect(material.userData.emissiveStrength).toBeGreaterThanOrEqual(2);
    else expect(material.vertexColors).toBe(true);
  } });
  expect(materials.texture.image.width).toBe(paletteTokens.length * 2);
  geometry.dispose(); materials.dispose(); lighting.dispose();
});

test('@E19 golden morning has radial two-color fog and shadow bounds follow actual desktop/portrait views', () => {
  const scene = new Scene(), lighting = new Lighting(scene), view = new View(); lighting.set('L1'); lighting.setQuality('high');
  expect(scene.backgroundNode).toBe(lighting.radialFog);
  expect(lighting.color.value.getHexString()).toBe('ffd9b0'); expect(lighting.shadow.value.getHexString()).toBe('6b4fc2');
  expect(lighting.getState()).toMatchObject({ shadowSize: 2048, normalBias: .08, shadowRadius: 2, coreShadowEdges: [1, -.25], fogColors: ['#f2c7a5', '#c7a2c9'] });
  view.resize(1600, 900); view.reset({ x: 42, z: -6.5 }); lighting.update(view);
  const desktop = lighting.sun.shadow.camera.right;
  expect(desktop).toBeGreaterThan(8); expect(desktop).toBeLessThan(18);
  view.resize(390, 844); lighting.update(view);
  expect(lighting.sun.shadow.camera.right).toBeGreaterThan(desktop);
  lighting.dispose();
});
