import { statSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { readFileSync } from 'node:fs';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';
import { validateDocument } from '../../../tools/assets/validate';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
import { alphaLook, alphaLookIndex, alphaLooks } from '../../../src/data/alphaLooks';

// PO #23 (10-19): "alphas could have different looks". Every look is the same rig, height and animation set as its base,
// within +10% of the base's triangles and file size at every LOD, with identity-preserving far LODs.
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function load(path: string) {
  const bytes = readFileSync(path);
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}
const asset = (id: string) => manifest.find(a => a.id === id) as AssetDef;
const lodPath = (def: AssetDef, lod: number) => lod === 0 ? def.glb : def.lods![lod === 1 ? 'lod1' : 'lod2']!;
const height = (root: Awaited<ReturnType<typeof load>>) => {
  root.traverse(node => { if (node.name.startsWith('stump_')) node.visible = false; });
  return new Box3().setFromObject(root).getSize(new Vector3()).y;
};

for (const [baseId, looks] of Object.entries(alphaLooks)) {
  const base = asset(baseId);
  test(`alpha-looks @PO23 ${baseId}: first look is the shipped asset and every look is a registered, integrated infected asset`, () => {
    expect(looks[0]).toBe(baseId);
    expect(looks.length).toBeGreaterThanOrEqual(baseId === 'inf.alpha' ? 5 : 3);
    expect(new Set(looks).size).toBe(looks.length);
    for (const id of looks) {
      const def = asset(id);
      expect(def, id).toBeTruthy();
      expect(def.category).toBe('infected');
      expect(def.status).toBe('integrated');
      expect(def.animatedNodes).toEqual(base.animatedNodes);
      expect(def.requiredNodes).toEqual(base.requiredNodes);
      expect(def.budget.triangles).toBeLessThanOrEqual(base.budget.triangles);
    }
  });
  for (const id of looks.slice(1)) for (const lod of [0, 1, 2]) {
    test(`alpha-looks @PO23 ${id} LOD${lod}: budgets within +10% of ${baseId}, same height, same rig, eyes kept`, async () => {
      const def = asset(id), path = lodPath(def, lod), basePath = lodPath(base, lod);
      const io = await assetIO(), doc = await io.read(path), baseDoc = await io.read(basePath);
      const validation = validateDocument(doc, def, statSync(path).size, lod), reference = validateDocument(baseDoc, base, statSync(basePath).size, lod);
      expect(validation.errors).toEqual([]);
      expect(validation.triangles).toBeLessThanOrEqual(Math.floor(reference.triangles * 1.1));
      expect(statSync(path).size).toBeLessThanOrEqual(Math.floor(statSync(basePath).size * 1.1));
      // Standalone primitive count (one per owner and palette material): the extra trim materials add at most a few primitives.
      // In the crowd every look is baked to one geometry, so an Alpha instance adds no draw call; each look on screen is one instanced batch.
      expect(validation.drawCalls).toBeLessThanOrEqual(def.budget.drawCalls);
      expect(validation.drawCalls).toBeLessThanOrEqual(reference.drawCalls + 10);
      expect(validation.materials).toBeLessThanOrEqual(def.budget.materials);
      const model = await load(path), original = await load(basePath);
      const ratio = height(model) / height(original);
      // Same size class: hats and hoods add a few centimetres, a bald suit loses the hair cap (PO: the Mega is the Alpha's size).
      expect(ratio).toBeGreaterThan(.94);
      expect(ratio).toBeLessThan(1.04);
      for (const name of def.animatedNodes) {
        const joint = model.getObjectByName(name)!;
        expect(joint, name).toBeTruthy();
        expect(joint.scale.toArray()).toEqual([1, 1, 1]);
        expect(joint.quaternion.toArray()).toEqual([0, 0, 0, 1]);
        expect(joint.position.toArray(), name).toEqual(original.getObjectByName(name)!.position.toArray());
      }
      const baked = bakeInfected(model, def.animatedNodes);
      expect(baked.clip.matrices.every(Number.isFinite)).toBe(true);
      const emissive = baked.geometry.getAttribute('_emissive');
      let eyeVertices = 0;
      for (let i = 0; i < emissive.count; i++) if (emissive.getX(i) > .5) eyeVertices++;
      expect(eyeVertices, 'glowing eyes survive at every LOD').toBeGreaterThan(0);
    });
  }
}

test('alpha-looks @PO23 seeded by entity id: stable, spread over every look, never the sim', () => {
  for (const [baseId, looks] of Object.entries(alphaLooks)) {
    const seen = new Map<string, number>();
    for (let id = 1; id <= 600; id++) {
      const look = alphaLook(baseId, id);
      expect(look).toBe(alphaLook(baseId, id));
      expect(looks).toContain(look);
      seen.set(look, (seen.get(look) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual([...looks].sort());
    // Roughly even: no look is rarer than half or commoner than twice its fair share.
    for (const count of seen.values()) { expect(count).toBeGreaterThan(600 / looks.length / 2); expect(count).toBeLessThan(600 / looks.length * 2); }
    // A pack of eight consecutive ids shows several looks.
    for (const start of [2, 20, 77, 140]) expect(new Set(Array.from({ length: 8 }, (_, i) => alphaLook(baseId, start + i))).size).toBeGreaterThanOrEqual(Math.min(looks.length, 3));
  }
  expect(alphaLook('inf.common-worker', 5)).toBe('inf.common-worker');
  expect(alphaLookIndex(7, 5)).toBe(alphaLookIndex(7, 5));
});
