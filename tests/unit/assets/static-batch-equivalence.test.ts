// Equivalence of the optimized staticBatch vertex loop with the original per-vertex implementation.
import { readFileSync } from 'node:fs';
import { BufferAttribute, BufferGeometry, Mesh, Scene, type Material, type Object3D } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import { AssetRegistry } from '../../../src/assets/registry';
import { staticBatch } from '../../../src/assets/staticBatch';
import { paletteTokens, type PaletteToken } from '../../../src/data/palette';
import { Materials } from '../../../src/render/Materials';
import { Lighting } from '../../../src/render/Lighting';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function load(url: string) {
  const file = readFileSync(`public${url}`);
  return (await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
}
/** The pre-optimization loop (commit 84e7fca), returning the per-bucket source geometries. */
function reference(source: Object3D, lit: boolean, materials?: Materials): Map<boolean, BufferGeometry[]> {
  source.updateMatrixWorld(true);
  const buckets = new Map<boolean, BufferGeometry[]>();
  source.traverse(node => {
    if (!(node instanceof Mesh) || node.userData.foliageProxy) return;
    for (let parent: Object3D | null = node; parent; parent = parent.parent) if (!parent.visible || parent.userData.foliageProxy) return;
    const material = (Array.isArray(node.material) ? node.material[0] : node.material) as Material & { color: import('three').Color; vertexColors: boolean };
    const emissive = material.name.startsWith('emi_') || material.userData.emissiveStrength > 0;
    const geometry = new BufferGeometry();
    // Decode quantized attributes before applying transforms (integer arrays clamp).
    for (const name of ['position', 'normal']) {
      const attribute = node.geometry.getAttribute(name), values = new Float32Array(attribute.count * attribute.itemSize);
      for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) values[i * attribute.itemSize + c] = attribute.getComponent(i, c);
      geometry.setAttribute(name, new BufferAttribute(values, attribute.itemSize));
    }
    if (node.geometry.index) geometry.setIndex(node.geometry.index.clone());
    geometry.applyMatrix4(node.matrixWorld);
    const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3), indices = new Float32Array(count), vertexColor = node.geometry.getAttribute('color');
    for (let i = 0; i < count; i++) {
      const color = material.color.toArray();
      if (material.vertexColors && vertexColor) for (let c = 0; c < 3; c++) color[c] *= vertexColor.getComponent(i, c);
      if (emissive && !lit) for (let c = 0; c < 3; c++) color[c] *= .08;
      colors.set(color, i * 3);
      const token = material.name.replace(/^(pal|emi)_/, '') as PaletteToken;
      const tokenIndex = paletteTokens.indexOf(token);
      // Authored vertex-color assets are quantized to the shared sheet; figures keep their swatches.
      indices[i] = material.vertexColors || tokenIndex < 0 ? materials?.nearest(material.color.clone().fromArray(color)) ?? 0 : tokenIndex;
      if (source.userData.paletteHydrant && token === 'survivorRed') indices[i] -= paletteTokens.length;
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setAttribute('_palette', new BufferAttribute(indices, 1));
    if (!buckets.has(emissive)) buckets.set(emissive, []);
    buckets.get(emissive)!.push(geometry);
  });
  return buckets;
}
test('optimized static batch attributes equal the reference loop @load', async () => {
  const materials = new Materials(new Lighting(new Scene()));
  const registry = new AssetRegistry(event => { throw new Error(JSON.stringify(event)); }, { load });
  for (const id of ['bld.house-a', 'veh.sedan-red', 'prop.bench', 'prop.fire-hydrant', 'bld.joes-diner']) for (const lit of [true, false]) {
    const source = await registry.loadAsset(id, 'lod1');
    source.userData.paletteHydrant = id === 'prop.fire-hydrant';
    const expected = reference(source, lit, materials), batch = staticBatch(source, lit, materials);
    for (const mesh of batch.children as Mesh[]) {
      const parts = expected.get(mesh.name === 'window-light')!;
      for (const name of ['position', 'normal', 'color', '_palette']) {
        const merged = Float32Array.from(parts.flatMap(g => Array.from(g.getAttribute(name).array as Float32Array)));
        expect(Array.from(mesh.geometry.getAttribute(name).array as Float32Array), `${id} ${lit} ${name}`).toEqual(Array.from(merged));
      }
      mesh.geometry.dispose(); (mesh.material as Material).dispose();
    }
  }
  await registry.dispose(); materials.dispose();
});
