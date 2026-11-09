/** Build the compact production propane cylinder from simple, authored solid geometry. */
import { mkdirSync } from 'node:fs';
import { Document } from '@gltf-transform/core';
import { CylinderGeometry, SphereGeometry } from 'three';
import type { AssetDef } from '../../src/assets/types';
import manifest from '../../src/assets/manifest.json' with { type: 'json' };
import { assetIO } from './io';
import { optimizeAsset } from './optimize';

const original = (manifest as AssetDef[]).find(asset => asset.id === 'haz.propane-tank')!;
const def: AssetDef = { ...original, status: 'integrated', dimensions: { x: .72, y: 1.735, z: .72, tolerance: .1 } };
const doc = new Document(), buffer = doc.createBuffer();
const root = doc.createNode('root').setTranslation([0, .79, 0]); doc.createScene('propane-tank').addChild(root);
const materials = {
  red: doc.createMaterial('pal_redDark').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(.12).setRoughnessFactor(.58),
  dark: doc.createMaterial('pal_uiDark').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(.18).setRoughnessFactor(.78),
  brass: doc.createMaterial('pal_brass').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(.58).setRoughnessFactor(.42),
};
function add(name: string, geometry: CylinderGeometry | SphereGeometry, material: typeof materials[keyof typeof materials], at: [number, number, number], scale: [number, number, number] = [1, 1, 1]): void {
  geometry.scale(...scale); geometry.translate(...at);
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
  const primitive = doc.createPrimitive().setMaterial(material)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(position.array)).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(normal.array)).setBuffer(buffer));
  if (geometry.index) primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint16Array.from(geometry.index.array)).setBuffer(buffer));
  root.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));
  geometry.dispose();
}
// Rounded pressure shell, protective collar, service valve, and three welded feet.
add('tank-body', new CylinderGeometry(.36, .36, 1.02, 24, 1), materials.red, [0, 0, 0]);
add('tank-top-dome', new SphereGeometry(.36, 24, 12), materials.red, [0, .48, 0], [1, .45, 1]);
add('tank-bottom-dome', new SphereGeometry(.36, 24, 12), materials.red, [0, -.48, 0], [1, .45, 1]);
add('tank-collar', new CylinderGeometry(.255, .285, .19, 20), materials.red, [0, .64, 0]);
add('tank-valve', new CylinderGeometry(.075, .085, .17, 12), materials.brass, [0, .81, 0]);
add('tank-valve-handle', new CylinderGeometry(.035, .035, .29, 10).rotateZ(Math.PI / 2), materials.dark, [0, .91, 0]);
for (let i = 0; i < 3; i++) {
  const angle = i * Math.PI * 2 / 3;
  add(`foot-${i}`, new CylinderGeometry(.035, .035, .2, 8), materials.dark, [Math.cos(angle) * .29, -.69, Math.sin(angle) * .29], [1, 1, 1]);
}
root.addChild(doc.createNode('front').setTranslation([.48, .05, 0]));
const io = await assetIO();
mkdirSync('assets/haz.propane-tank', { recursive: true });
await io.write('assets/haz.propane-tank/model.glb', doc);
await optimizeAsset('assets/haz.propane-tank/model.glb', def.glb, def);
console.log(`Built ${def.id}: ${def.glb}`);
