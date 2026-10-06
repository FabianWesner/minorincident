import { expect, test } from 'vitest';
import { Box3, Mesh, Vector3 } from 'three';
import manifest from '../../../src/assets/manifest.json';
import { createCivilianPlaceholder, createCorgiPlaceholder } from '../../../src/render/npc/placeholders';
import { disposeCharacter } from '../../../src/render/characters/rig';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
test('T-E08-10 @E08 @E08-AC10 corgi fallback has complete required joints/socket, +X and recognizable low proportions', () => {
  const model = createCorgiPlaceholder(), def = manifest.find(a => a.id === 'char.corgi')!;
  for (const name of [...def.requiredNodes, ...def.animatedNodes, ...def.sockets, ...def.frontNodes]) expect(model.getObjectByName(name), name).toBeDefined();
  const size = new Box3().setFromObject(model).getSize(new Vector3()); expect(size.x).toBeGreaterThan(size.y); expect(size.y).toBeLessThan(.9); expect(model.getObjectByName('front')!.position.x).toBeGreaterThan(0);
  expect(model.getObjectByName('packSocket')!.children.length).toBeGreaterThan(0); disposeCharacter(model);
});
test('@E08 civilian batch retains clothes and contains vein/eye geometry without survivor backpack', () => {
  const model = createCivilianPlaceholder(); expect(model.getObjectByName('backpackSocket')!.children).toHaveLength(0);
  const baked = bakeInfected(model); expect(baked.geometry.groups).toHaveLength(0); expect(baked.shirtColor).toBeDefined(); expect(baked.clip.matrices.every(Number.isFinite)).toBe(true);
  let veins = 0; model.traverse(n => { if (n instanceof Mesh && !Array.isArray(n.material) && n.material.name === 'keep_veins') veins++; }); expect(veins).toBe(9); baked.geometry.dispose(); disposeCharacter(model);
});
