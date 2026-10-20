import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SkinnedMesh } from 'three';
import { expect, test } from 'vitest';

const budget = { '': 1200, '.low': 600, '.lod2': 250 } as const;
for (const sex of ['female', 'male']) for (const [lod, limit] of Object.entries(budget)) test(`${sex} courier tier gear${lod || ' LOD0'}: tier ranges ordered, within triangle budget, skinned to body bones`, async () => {
  const bytes = readFileSync(`public/assets/models/acc.courier-gear.${sex}.tiers${lod}.glb`);
  const scene = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  let mesh: SkinnedMesh | undefined; scene.traverse(node => { if ((node as SkinnedMesh).isSkinnedMesh) mesh = node as SkinnedMesh; });
  expect(mesh).toBeDefined();
  const tiers = JSON.parse(String(mesh!.userData.tierTris)) as number[];
  expect(tiers).toHaveLength(4);
  expect(tiers.every((count, i) => count > (tiers[i - 1] ?? 0))).toBe(true);
  expect(tiers[3]).toBeLessThanOrEqual(limit);
  const index = mesh!.geometry.getIndex()!, position = mesh!.geometry.getAttribute('position');
  expect(index.count / 3).toBe(tiers[3]);   // one mesh, one draw call, no hidden extra triangles
  const meanY = (from: number, to: number) => { let sum = 0; for (let i = from * 3; i < to * 3; i++) sum += position.getY(index.getX(i)); return sum / ((to - from) * 3); };
  // glTF is Y up: tier 1 (knees, gloves) sits low on the body and tier 2 (vest) above the waist: the index order survived the export.
  expect(meanY(0, tiers[0])).toBeLessThan(.55);
  expect(meanY(tiers[0], tiers[1])).toBeGreaterThan(.7);
  // The Scene Lab guard subtracts `_thick` (designed plate thickness) from each vertex's distance to the skin; capped at 1.2 cm so it cannot hide a gap.
  const thick = mesh!.geometry.getAttribute('_thick');
  expect(thick, '_thick attribute').toBeDefined();
  let maxThick = 0; for (let i = 0; i < thick.count; i++) maxThick = Math.max(maxThick, thick.getX(i));
  expect(maxThick).toBeLessThanOrEqual(.012);
  const names = mesh!.skeleton.bones.map(bone => bone.name);
  for (const required of ['legL', 'kneeL', 'handR', 'chest', 'head']) expect(names).toContain(required);
});
