import { expect, test, vi } from 'vitest';
import { Box3, Group, InstancedMesh, Matrix4, Mesh, Scene, Vector3 } from 'three';
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

test('@E19 civilian variety keeps authored gait, sim idle hysteresis and raised ground with shared shading', async () => {
  const { CivilianCrowd } = await import('../../../src/render/npc/CivilianCrowd');
  const { AssetRegistry } = await import('../../../src/assets/registry');
  const { Materials } = await import('../../../src/render/Materials');
  const { Lighting } = await import('../../../src/render/Lighting');
  const { PaletteMaterial } = await import('../../../src/render/PaletteMaterial');
  const { civilianClips, framesPerClip } = await import('../../../src/render/characters/bakeInfected');
  const player = { id: 1, transform: { x: 0, y: .7, z: 0 } };
  const civilian = { id: 2, transform: { x: 3, y: 2.7, z: 0, yaw: 0 },
    civilian: { model: 'npc.civilian-man-b', variant: 'inf.bbq-dad', adult: true, state: 'calm', knockedUntil: 0, entered: 0, until: 180, veins: 0, eyesGlow: false },
    motion: { speed: 0, moving: false, distance: 0 } };
  const world = { tick: 120, entities: { iterate: () => [player, civilian], get: () => player } };
  // Asset loading is stubbed; baking, material graphs and instance updates remain real CPU code.
  const load = vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockImplementation(async () => {
    const root = new Group(); root.userData.placeholder = true; return root;
  });
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  const crowd = new CivilianCrowd(world as unknown as import('../../../src/sim/world/SimWorld').SimWorld, materials);
  try {
    await crowd.init(); expect(crowd.snapshot().instances).toBe(1);
    const meshes: InstancedMesh[] = []; crowd.traverse(n => { if (n instanceof InstancedMesh) meshes.push(n); });
    const mesh = meshes.find(n => n.count === 1)!;
    expect(mesh.material).toBeInstanceOf(PaletteMaterial);
    const matrix = new Matrix4(); mesh.getMatrixAt(0, matrix); expect(matrix.elements[13]).toBeCloseTo(2);
    const clip = () => civilianClips[Math.floor(mesh.geometry.getAttribute('_clip_frame').getX(0) / framesPerClip)];
    expect(clip()).toBe('idle');
    civilian.motion = { speed: 1.5, moving: true, distance: .45 }; world.tick++; crowd.update();
    expect(clip()).toBe('npc-walk-relaxed');
    civilian.motion.speed = .08; civilian.motion.moving = false; world.tick++; crowd.update();
    expect(clip()).toBe('idle');
    civilian.civilian.state = 'down'; civilian.civilian.entered = world.tick; civilian.civilian.until = world.tick + 60; world.tick++; crowd.update(); expect(clip()).toBe('infection-collapse');
    civilian.civilian.state = 'rising'; civilian.civilian.entered = world.tick - 36; civilian.civilian.until = civilian.civilian.entered + 72; crowd.update(); expect(clip()).toBe('infection-rise');
  } finally { crowd.dispose(); materials.dispose(); lighting.dispose(); load.mockRestore(); }
});
