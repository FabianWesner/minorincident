import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';
import { requiredLods, triangleCount } from '../../../tools/assets/delivery';

const accessories = (manifest as AssetDef[]).filter(def => def.category === 'accessory');
const hats = ['baseball-cap', 'beanie', 'sun-hat', 'hard-hat', 'flat-cap', 'bucket-hat'].map(name => `acc.hat-${name}`);
const hair = ['short-crop', 'ponytail', 'bun', 'afro', 'side-part', 'long-straight'].map(name => `acc.hair-${name}`);
const bases = ['npc.civilian-man-a', 'npc.civilian-man-b', 'npc.civilian-woman-a', 'npc.civilian-woman-b', 'npc.civilian-elderly', 'npc.civilian-kid'];

test('the crowd accessory set is 6 hats and 6 hair pieces with the agreed ids', () => {
  expect(accessories.map(def => def.id).sort()).toEqual([...hats, ...hair].sort());
  for (const def of accessories) expect(def.accessory?.slot).toBe(def.id.startsWith('acc.hat-') ? 'hat' : 'hair');
});

test('accessory manifest entries cap triangles, drop LOD2 and carry one fit per base rig', () => {
  for (const def of accessories) {
    expect(def.budget).toMatchObject({ triangles: 150, materials: 1, drawCalls: 1 });
    expect(def.authoredLodTriangles).toEqual({ lod1: 80, lod2: 0 });
    expect(def.lods?.lod2, def.id).toBeUndefined();
    expect(requiredLods(def, 100)).toEqual(['lod1']);
    expect(Object.keys(def.accessory!.fits).sort()).toEqual([...bases].sort());
    for (const base of bases) {
      const fit = def.accessory!.fits[base];
      expect(fit.scale.every(v => v > .6 && v < 1.4), `${def.id} ${base} scale`).toBe(true);
      expect(fit.offset.every(v => Math.abs(v) < .12), `${def.id} ${base} offset`).toBe(true);
    }
    expect(def.accessory!.fits['npc.civilian-man-b'].hasHeadwear).toBe(true);
  }
});

test('accessory GLBs stay within 150/80 triangles, one neutral material, mesh below the head node', async () => {
  const io = await assetIO();
  for (const def of accessories) {
    expect(existsSync(def.glb) && existsSync(def.lods!.lod1!), def.id).toBe(true);
    for (const [path, cap] of [[def.glb, 150], [def.lods!.lod1!, 80]] as const) {
      const document = await io.read(path);
      expect(triangleCount(document), `${path} triangles`).toBeLessThanOrEqual(cap);
      const materials = document.getRoot().listMaterials();
      expect(materials.map(material => material.getName()), path).toEqual([def.accessory!.slot === 'hat' ? 'pal_pants' : 'pal_hairWhite']);
      const head = document.getRoot().listNodes().find(node => node.getName() === 'head');
      const hasMesh = (node: NonNullable<typeof head>): boolean => !!node.getMesh() || node.listChildren().some(hasMesh);
      expect(!!head && hasMesh(head), `${path} mesh below the head node`).toBe(true);
    }
    expect(existsSync(def.glb.replace('.glb', '.lod2.glb')), `${def.id} has no LOD2 file`).toBe(false);
  }
});
