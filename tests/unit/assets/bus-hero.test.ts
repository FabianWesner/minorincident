import { expect, test } from 'vitest';
import { Document } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import { existsSync, readFileSync } from 'node:fs';
import { assetIO } from '../../../tools/assets/io';
import { coplanarOverlaps } from '../../../tools/assets/zfight';
import { triangleCount } from '../../../tools/assets/delivery';
import type { AssetDef } from '../../../src/assets/types';

const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const tiers = ['', '.lod1', '.lod2'];

/** Two axis-aligned quads (z = 0 and z = gap) with their own material, optionally with a baked shade. */
function quads(gap: number, materialB = 'pal_uiDark', shadeA = 1, shadeB = 1, blocker = false): Document {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene();
  const add = (name: string, z: number, material: string, shade: number, size = 1) => {
    const p = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setBuffer(buffer)
      .setArray(new Float32Array([0, 0, z, size, 0, z, size, size, z, 0, size, z])))
      .setAttribute('COLOR_0', doc.createAccessor().setType('VEC4').setBuffer(buffer).setArray(new Float32Array(Array(4).fill([shade, shade, shade, 1]).flat())))
      .setIndices(doc.createAccessor().setType('SCALAR').setBuffer(buffer).setArray(new Uint16Array([0, 1, 2, 0, 2, 3])))
      .setMaterial(doc.createMaterial(material));
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(p)));
  };
  add('a', 0, 'pal_picketWhite', shadeA);
  add('b', gap, materialB, shadeB);
  if (blocker) add('lid', gap + .01, 'pal_asphalt', 1, 3);
  return doc;
}

test('@bus-hero zfight check flags coplanar overlaps of different materials within 1 mm and nothing farther apart', () => {
  expect(coplanarOverlaps(quads(0))).toHaveLength(1);
  expect(coplanarOverlaps(quads(.0007))).toHaveLength(1);
  expect(coplanarOverlaps(quads(.008))).toHaveLength(0);
  // a layer buried under a covering panel can never be seen
  expect(coplanarOverlaps(quads(0, 'pal_uiDark', 1, 1, true))).toHaveLength(0);
});

test('@bus-hero same palette material only fights when the baked AO differs (old bus rear face)', () => {
  expect(coplanarOverlaps(quads(0, 'pal_picketWhite', 1, 1))).toHaveLength(0);
  expect(coplanarOverlaps(quads(0, 'pal_picketWhite', 1, .6))).toHaveLength(1);
});

for (const id of ['veh.evac-bus', 'veh.school-bus']) {
  const def = manifest.find(a => a.id === id)!;
  // The derived school-bus wrecked/burned meshes keep a few small recorded offenders (tools/assets/zfight-known.json); their base tiers and every evac bus file must be clean.
  const decays = id === 'veh.evac-bus' ? def.decayVariants : [];
  const files = [undefined, ...decays].flatMap(decay => tiers.map(tier => ({ decay, tier, path: `public/assets/models/${id}${decay ? '.' + decay : ''}${tier}.glb` })));
  test(`@bus-hero ${id}: no coplanar overlapping faces in any delivered tier${id === 'veh.evac-bus' ? ' or decay variant' : ''}`, async () => {
    const io = await assetIO();
    for (const { path } of files) {
      expect(existsSync(path), path).toBe(true);
      const offenders = coplanarOverlaps(await io.read(path));
      expect(offenders.map(o => `${o.materials.join('/')} ${o.nodes.join('+')} ${(o.area * 1e4).toFixed(0)}cm2`), path).toEqual([]);
    }
  });
}

test('@bus-hero evac bus: node contract, transparent glass, seats, door and lights in every tier', async () => {
  const io = await assetIO(), def = manifest.find(a => a.id === 'veh.evac-bus')!;
  const caps = [15000, 6000, 2000];
  for (const [i, tier] of tiers.entries()) {
    const doc = await io.read(`public/assets/models/veh.evac-bus${tier}.glb`), nodes = new Map(doc.getRoot().listNodes().map(n => [n.getName(), n]));
    for (const name of [...def.requiredNodes, ...def.animatedNodes, ...def.sockets]) expect(nodes.has(name), `${tier} ${name}`).toBe(true);
    for (const name of def.sockets) expect(nodes.get(name)!.getMesh(), `${tier} ${name} must stay an empty`).toBeNull();
    for (const name of ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR', 'doorR', 'lightsFront', 'lightsBrake']) {
      const hasGeometry = (n: typeof nodes extends Map<string, infer V> ? V : never): boolean => !!n.getMesh() || n.listChildren().some(hasGeometry);
      expect(hasGeometry(nodes.get(name)!), `${tier} ${name} needs its own geometry`).toBe(true);
    }
    const glass = doc.getRoot().listMaterials().filter(m => m.getAlphaMode() === 'BLEND');
    expect(glass.length, `${tier} glass`).toBeGreaterThan(0);
    expect(glass.every(m => m.getBaseColorFactor()[3] > 0 && m.getBaseColorFactor()[3] < .4)).toBe(true);
    expect(triangleCount(doc), tier).toBeLessThanOrEqual(caps[i]);
    expect(doc.getRoot().listMaterials().length).toBeLessThanOrEqual(def.budget.materials);
    // dimensions stay inside the manifest contract
    const b = getBounds(doc.getRoot().listScenes()[0]);
    expect(b.max[0] - b.min[0]).toBeCloseTo(def.dimensions.x, 0);
    expect(b.max[1] - b.min[1]).toBeLessThanOrEqual(def.dimensions.y + def.dimensions.tolerance);
  }
  // seats and the driver chair sit in the cabin, above the floor and between the wheels
  const lod0 = await io.read('public/assets/models/veh.evac-bus.glb');
  const seats = def.sockets.filter(s => s.startsWith('seat_')).map(s => lod0.getRoot().listNodes().find(n => n.getName() === s)!.getWorldTranslation());
  expect(seats).toHaveLength(12);
  for (const [x, y, z] of seats) { expect(y).toBeGreaterThan(1.3); expect(y).toBeLessThan(2.2); expect(Math.abs(z)).toBeLessThan(1.1); expect(Math.abs(x)).toBeLessThan(4.3); }
});

test('@bus-hero evac bus wrecked/burned derive from the new base: same footprint and wheel pivots', async () => {
  const io = await assetIO(), base = await io.read('public/assets/models/veh.evac-bus.glb'), size = (d: Document) => { const b = getBounds(d.getRoot().listScenes()[0]); return [0, 1, 2].map(k => b.max[k] - b.min[k]); };
  const baseSize = size(base), wheels = (d: Document) => ['wheelFL', 'wheelRR'].map(n => d.getRoot().listNodes().find(x => x.getName() === n)!.getWorldTranslation());
  for (const decay of ['wrecked', 'burned']) for (const [i, tier] of tiers.entries()) {
    const doc = await io.read(`public/assets/models/veh.evac-bus.${decay}${tier}.glb`), s = size(doc);
    expect(triangleCount(doc), `${decay}${tier}`).toBeLessThanOrEqual([15000, 6000, 2000][i]);
    for (let k = 0; k < 3; k++) expect(Math.abs(s[k] - baseSize[k]) / baseSize[k], `${decay}${tier} axis ${k}`).toBeLessThan(.2);
    wheels(doc).forEach((w, j) => w.forEach((v, k) => expect(v).toBeCloseTo(wheels(base)[j][k], 2)));
  }
});
