// Asset contract: every shipped GLB (all levels, all LODs) passes the one validator in tools/assets/validate.ts.
// Validator rejection cases and atlas identity details are shared across every figure build.
import { Document } from '@gltf-transform/core';
import { expect, test } from 'vitest';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { validateAssets, validateDocument } from '../../tools/assets/validate';
import { PNG } from 'pngjs';
import { classifyCrowdAtlas } from '../../tools/assets/skin-crowd-regions';
import { crowdRegion } from '../../src/render/characters/crowdRegionData';

function fixture(): { doc: Document; def: AssetDef } {
  const doc = new Document(), buffer = doc.createBuffer();
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1])).setBuffer(buffer);
  const material = doc.createMaterial('pal_survivorRed');
  const mesh = doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', pos).setMaterial(material));
  const body = doc.createNode('body').setMesh(mesh), front = doc.createNode('front').setTranslation([1, 0, 0]);
  doc.getRoot().setDefaultScene(doc.createScene().addChild(body).addChild(front));
  const def: AssetDef = { id: 'prop.test', category: 'prop', status: 'modeled', tier: 'side', glb: 'test.glb', dimensions: { x: 1, y: 1, z: 1, tolerance: .05 }, forward: '+X', frontNodes: ['front'], requiredNodes: ['body'], animatedNodes: ['body'], sockets: ['front'], budget: { triangles: 2, materials: 2, fileKB: 1 } } as AssetDef;
  return { doc, def };
}

test('crowd atlas cleanup preserves enclosed eye paint and its authored alpha class', () => {
  for (const garments of [false, true]) {
    const doc = new Document(), buffer = doc.createBuffer(), png = new PNG({ width: 128, height: 128 });
    for (let i = 0; i < png.data.length; i += 4) png.data.set([224, 168, 124, 255], i);
    for (let y = 56; y < 64; y++) for (let x = 56; x < 64; x++) png.data.set([244, 244, 238, 255], (y * 128 + x) * 4);
    for (let y = 59; y < 61; y++) for (let x = 59; x < 61; x++) png.data.set([35, 31, 29, 255], (y * 128 + x) * 4);
    const attribute = (values: number[], type: 'VEC2' | 'VEC3' | 'SCALAR') => doc.createAccessor().setBuffer(buffer).setType(type).setArray(new Float32Array(values));
    const material = doc.createMaterial().setBaseColorTexture(doc.createTexture().setImage(new Uint8Array(PNG.sync.write(png))).setMimeType('image/png'));
    const prim = doc.createPrimitive().setMaterial(material)
      .setAttribute('POSITION', attribute([1, 0, -1, 1, 1, -1, 1, 1, 1, 1, 0, 1], 'VEC3'))
      .setAttribute('TEXCOORD_0', attribute([0, 0, 0, 1, 1, 1, 1, 0], 'VEC2'))
      .setAttribute('_CROWD_PART', attribute([0, 0, 0, 0], 'SCALAR'))
      .setAttribute('_CROWD_REGION', attribute([1, 1, 1, 1], 'SCALAR'))
      .setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 2, 3])));
    const scene = doc.createScene(), head = doc.createNode('head'); scene.addChild(head);
    scene.addChild(doc.createNode('skin_body').setSkin(doc.createSkin().addJoint(head)).setMesh(doc.createMesh().addPrimitive(prim)));
    scene.addChild(doc.createNode('skin_eyes').setMesh(doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', attribute([1, .8, 0], 'VEC3')))));
    classifyCrowdAtlas(doc, garments);
    const result = PNG.sync.read(Buffer.from(material.getBaseColorTexture()!.getImage()!));
    for (const [x, y, rgb] of [[60, 60, [35, 31, 29]], [57, 57, [244, 244, 238]]] as const) {
      const offset = (y * 128 + x) * 4;
      expect([...result.data.subarray(offset, offset + 3)], `eye RGB, garments=${garments}`).toEqual(rgb);
      expect(result.data[offset + 3], `eye class, garments=${garments}`).toBe(Math.round((crowdRegion.authored + 1) * 255 / 7));
    }
  }
});

test('uniform and civilian faces and yellow bare arms share the per-person skin class', () => {
  for (const garments of [false, true]) {
    const doc = new Document(), buffer = doc.createBuffer(), png = new PNG({ width: 128, height: 128 });
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) png.data.set(x < 64 ? [224, 168, 124, 255] : [247, 221, 147, 255], (y * 128 + x) * 4);
    // Navy gloves and warm gold uniform shoulder patches must not join the skin region.
    for (let y = 16; y < 40; y++) for (let x = 88; x < 112; x++) png.data.set(y < 28 ? [30, 40, 70, 255] : [247, 211, 147, 255], (y * 128 + x) * 4);
    const attribute = (values: number[], type: 'VEC2' | 'VEC3' | 'SCALAR') => doc.createAccessor().setBuffer(buffer).setType(type).setArray(new Float32Array(values));
    const material = doc.createMaterial().setBaseColorTexture(doc.createTexture().setImage(new Uint8Array(PNG.sync.write(png))).setMimeType('image/png'));
    const prim = doc.createPrimitive().setMaterial(material)
      .setAttribute('POSITION', attribute([1, 0, -1, 1, 1, -1, 1, 1, 1, 1, 0, 1, 0, 0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0, .9, -.5, 0, 1, -.5, 0, 1, .5, 0, .9, .5], 'VEC3'))
      .setAttribute('TEXCOORD_0', attribute([0, 0, 0, 1, .5, 1, .5, 0, .5, 0, .5, 1, 1, 1, 1, 0, 88 / 128, 28 / 128, 88 / 128, 40 / 128, 112 / 128, 40 / 128, 112 / 128, 28 / 128], 'VEC2'))
      .setAttribute('_CROWD_PART', attribute([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2], 'SCALAR'))
      .setAttribute('_CROWD_REGION', attribute([1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1], 'SCALAR'))
      .setIndices(doc.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11])));
    const scene = doc.createScene(), head = doc.createNode('head'), arm = doc.createNode('foreArmL'), shoulder = doc.createNode('armL'); scene.addChild(head).addChild(arm).addChild(shoulder);
    scene.addChild(doc.createNode('skin_body').setSkin(doc.createSkin().addJoint(head).addJoint(arm).addJoint(shoulder)).setMesh(doc.createMesh().addPrimitive(prim)));
    scene.addChild(doc.createNode('skin_eyes').setMesh(doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION', attribute([1, .8, 0], 'VEC3')))));
    classifyCrowdAtlas(doc, garments);
    const result = PNG.sync.read(Buffer.from(material.getBaseColorTexture()!.getImage()!));
    const pixel = (x: number, y: number) => [...result.data.subarray((y * 128 + x) * 4, (y * 128 + x) * 4 + 4)];
    const face = pixel(32, 80), forearm = pixel(96, 80), skinAlpha = Math.round((crowdRegion.skin + 1) * 255 / 7);
    expect(face[3]).toBe(skinAlpha); expect(forearm[3]).toBe(skinAlpha);
    expect(Math.max(...face.slice(0, 3).map((v, c) => Math.abs(v - forearm[c])))).toBeLessThan(20);
    expect(pixel(96, 20)[3]).not.toBe(skinAlpha);
    if (!garments) expect(pixel(96, 32)[3], 'warm gold shoulder patch').not.toBe(skinAlpha);
  }
});

test('the asset validator rejects every contract violation, and every production asset passes it', async () => {
  const { doc, def } = fixture();
  expect(validateDocument(doc, def, 1024).errors).toEqual([]);
  const cases: [string, (d: Document, a: AssetDef) => void][] = [
    ['dimensions.x', (_d, a) => { a.dimensions.x = 5; }],
    ['node wheel', (_d, a) => { a.requiredNodes.push('wheel'); }],
    ['forward front', (d) => { d.getRoot().listNodes()[1].setTranslation([-1, 0, 0]); }],
    ['triangles', (_d, a) => { a.budget.triangles = 0; }],
    ['fileKB', (_d, a) => { a.budget.fileKB = 0; }],
    ['material: unknown', (d) => { d.getRoot().listMaterials()[0].setName('pal_unknown'); }],
    ['non-finite', (d) => { d.getRoot().listAccessors()[0].setArray(new Float32Array([NaN, 0, 0, 1, 0, 0, 0, 1, 1])); }],
    ['degenerate', (d) => { d.getRoot().listAccessors()[0].setArray(new Float32Array(9)); }],
  ];
  for (const [error, mutate] of cases) {
    const fresh = fixture(); mutate(fresh.doc, fresh.def);
    expect(validateDocument(fresh.doc, fresh.def, 1024).errors.join('\n'), error).toContain(error);
  }
  expect(new Set(manifest.map(a => a.id)).size).toBe(manifest.length);
  // Per change: the first shipped asset of every category plus the school bus (door/seat node contract) end to end.
  // The whole inventory (1,262 reports, about 80 s on the Mac and > 5 min on a runner) is in tests/nightly/content-invariants.
  const assets = manifest as AssetDef[], categories = [...new Set(assets.map(a => a.category))];
  const sample = [...categories.map(category => assets.find(a => a.category === category && a.lods?.lod1)).filter(a => a !== undefined), assets.find(a => a.id === 'veh.school-bus')!];
  const reports = await validateAssets(sample, true);
  expect(reports.length).toBeGreaterThanOrEqual(sample.length);
  expect(reports.flatMap(r => r.errors.map(e => `${r.id}: ${e}`))).toEqual([]);
}, 120_000);
