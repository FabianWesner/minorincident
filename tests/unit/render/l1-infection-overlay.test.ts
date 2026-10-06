import { Group, InstancedMesh, Scene } from 'three/webgpu';
import { expect, test, vi } from 'vitest';

test('T-E19-18 @E19 @E19-AC18 a turned pedestrian renders as the same person: own model batch, own tint, infection overlay', async () => {
  const { CivilianCrowd } = await import('../../../src/render/npc/CivilianCrowd');
  const { AssetRegistry } = await import('../../../src/assets/registry');
  const { Materials } = await import('../../../src/render/Materials');
  const { Lighting } = await import('../../../src/render/Lighting');
  const { infectedClips, framesPerClip } = await import('../../../src/render/characters/bakeInfected');
  const player = { id: 1, transform: { x: 0, y: .7, z: 0 } };
  const appearance = { entityId: 2, asset: 'npc.civilian-woman-b', tint: '#c4473d', accessories: ['cap'], handProp: null, tier: 'average' as const };
  const person: Record<string, unknown> & { transform: { x: number; y: number; z: number; yaw: number } } = { id: 2, transform: { x: 3, y: .7, z: 0, yaw: 0 }, appearance,
    civilian: { model: 'npc.civilian-woman-b', variant: 'inf.cashier', adult: true, state: 'down', knockedUntil: 0, entered: 100, until: 200, veins: .2, eyesGlow: false, l1: {} },
    infection: { entityId: 2, progress: .5, phase: 'collapse', tier: 'average', startedTick: 60, endsTick: 240, biteSourceId: 9 } };
  const world = { tick: 150, entities: { iterate: () => [player, person], get: () => player } };
  const load = vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockImplementation(async () => { const root = new Group(); root.userData.placeholder = true; return root; });
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  const crowd = new CivilianCrowd(world as unknown as import('../../../src/sim/world/SimWorld').SimWorld, materials);
  const batch = () => { const meshes: InstancedMesh[] = []; crowd.traverse(n => { if (n instanceof InstancedMesh && n.count === 1) meshes.push(n); }); expect(meshes).toHaveLength(1); return meshes[0]; };
  try {
    await crowd.init();
    // Mid-transformation: collapse clip, skin blend and blood on the overlay, the person's own shirt tint.
    let mesh = batch(); const tint = mesh.geometry.getAttribute('_variant'), overlay = mesh.geometry.getAttribute('_overlay');
    const clip = () => infectedClips[Math.floor(batch().geometry.getAttribute('_clip_frame').getX(0) / framesPerClip)];
    expect(clip()).toBe('infection-collapse'); expect(overlay.getX(0)).toBeCloseTo(.2); expect(overlay.getZ(0)).toBeGreaterThan(0);
    const shirt = [tint.getX(0), tint.getY(0), tint.getZ(0)];
    // Risen: no civilian component, an infected brain; still drawn by the same model batch with the same tint.
    delete person.civilian; delete person.infection;
    Object.assign(person, { faction: 'infected', health: { current: 40, max: 40 }, infected: { state: 'chase', hidden: false, until: 0, deadAt: -1 }, combat: {} });
    world.tick++; crowd.update(); mesh = batch();
    expect(mesh.geometry.getAttribute('_variant')).toBe(tint);
    expect([tint.getX(0), tint.getY(0), tint.getZ(0)]).toEqual(shirt);
    expect(overlay.getX(0)).toBeCloseTo(.4); expect(overlay.getY(0)).toBe(1); expect(overlay.getZ(0)).toBe(1);
    person.transform.x += 1; world.tick++; crowd.update(); expect(['infected-run', 'shamble']).toContain(clip());
    // A pooled record reused for another spawn (new id) is not drawn as the former person.
    person.id = 77; world.tick++; crowd.update(); expect(crowd.snapshot().instances).toBe(0);
  } finally { crowd.dispose(); materials.dispose(); lighting.dispose(); load.mockRestore(); }
});
