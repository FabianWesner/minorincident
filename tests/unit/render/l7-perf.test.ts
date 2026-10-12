import { expect, test, vi } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicNodeMaterial, Object3D, PerspectiveCamera, Scene } from 'three/webgpu';
import { Blasts } from '../../../src/render/vfx/Blasts';
import { FxPool } from '../../../src/render/vfx/FxPool';
import { DistrictView } from '../../../src/render/DistrictView';
import { InstancedGroup } from '../../../src/render/InstancedGroup';
import { Materials } from '../../../src/render/Materials';
import { Lighting } from '../../../src/render/Lighting';
import { Grass, windPhase } from '../../../src/render/Grass';
import { View } from '../../../src/render/View';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import type { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import type { DistrictAssets } from '../../../src/assets/DistrictAssets';

test('T-E29-19-fire-culling @E29-AC19 offscreen fires retain lifetime/light and render again when the camera returns', () => {
  const world = new SimWorld(), particles = new FxPool(512, 'particle');
  const camera = new PerspectiveCamera(60, 1, .1, 600); camera.position.set(0, 9, 30); camera.lookAt(0, 9, 0); camera.updateMatrixWorld();
  const remove = vi.fn(), light = vi.fn(() => ({ remove }));
  const blasts = new Blasts(world, { camera: () => camera, particles, light, shake() {} });
  const fire = (x: number) => world.entities.create({ kind: 'hazard', archetype: 'hazard.fire', faction: 'environment', health: { current: 1, max: 1 }, transform: { x, y: .7, z: 0, yaw: 0 }, hazard: { kind: 'fire', radius: 1.8, activeUntil: 432000, fuseAt: 0, exploded: false, leaked: false } });
  const near = fire(0), distant = fire(270);
  try {
    blasts.set({ quality: 'low' }); blasts.advance(1, 1);
    expect(blasts.snapshot().fireColumns).toBe(2); expect(light).toHaveBeenCalledTimes(2);
    expect(blasts.snapshot().flames).toBe(5); expect(blasts.snapshot().puffs).toBeGreaterThan(0);
    expect(blasts.sourceVisible(20, 0, 8)).toBe(true); // Conservative screen edge.
    expect(blasts.sourceVisible(270, 0, 8)).toBe(false);
    camera.position.x = 270; camera.lookAt(270, 9, 0); camera.updateMatrixWorld();
    blasts.advance(2, 1);
    expect(blasts.snapshot().fireColumns).toBe(2); expect(blasts.snapshot().flames).toBe(5);
    expect(light).toHaveBeenCalledTimes(2); expect(remove).not.toHaveBeenCalled();
    expect(near.hazard!.activeUntil).toBe(432000); expect(distant.hazard!.activeUntil).toBe(432000);
    world.tick = 432000; blasts.advance(3, 1);
    expect(blasts.snapshot().fireColumns).toBe(0); expect(remove).toHaveBeenCalledTimes(2);
  } finally { blasts.dispose(); particles.dispose(); world.dispose(); }
});

test('T-E29-19-static-uploads @E29-AC19 camera motion preserves unchanged collapse/wreck buffers and updates moved or culled instances', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), phase = windPhase();
  const district = new DistrictView({ composition: { id: 'L7' } } as DistrictWorld, materials, {} as DistrictAssets, phase, Grass.material(materials, phase), true);
  const geometry = new BoxGeometry(1, 1, 1), material = new MeshBasicNodeMaterial(), prototype = new Group(); prototype.add(new Mesh(geometry, material));
  const ref = new Object3D(); ref.position.set(0, 0, 0);
  const hero = new InstancedGroup(prototype, [ref]), near = new InstancedGroup(prototype, [ref]), far = new InstancedGroup(prototype, [ref]);
  district.add(hero, near, far);
  const entry = { hero, near, far, refs: [ref], origin: [0, 0], height: 3, radius: 4, half: 2, id: 'veh.military-truck', lit: false, loaded: true, nearLoaded: true, farLoaded: true, bands: [] };
  const internal = district as unknown as { lodBatches: unknown[]; dirtyEntries: Set<unknown> };
  internal.lodBatches.push(entry);
  const view = new View(); view.resize(1280, 720); view.preset('pair', { position: [15, 20, 15], target: [0, 0, 0] });
  view.inspectionPose = { position: [15, 20, 15], target: [0, 0, 0] };
  try {
    district.updateLods(view);
    const mesh = far.children[0] as InstancedMesh, version = mesh.instanceMatrix.version;
    expect(mesh.count).toBe(1);
    view.preset('shake', { position: [15.6, 20, 15], target: [0, 0, 0] }); district.updateLods(view);
    expect(mesh.instanceMatrix.version).toBe(version);
    ref.position.x = 1; internal.dirtyEntries.add(entry); district.updateLods(view);
    expect(mesh.instanceMatrix.version).toBeGreaterThan(version);
    view.preset('away', { position: [270, 20, 15], target: [270, 0, 0] }); district.updateLods(view);
    expect(mesh.count).toBe(0); expect(far.visible).toBe(false);
    view.preset('return', { position: [15, 20, 15], target: [0, 0, 0] }); district.updateLods(view);
    expect(mesh.count).toBe(1); expect(far.visible).toBe(true);
  } finally { hero.dispose(); near.dispose(); far.dispose(); district.dispose(); geometry.dispose(); material.dispose(); materials.dispose(); lighting.dispose(); }
});

test('T-E29-19-dressing-culling @E29-AC19 distant collapse placements leave the batch and return without losing authored transforms', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), phase = windPhase();
  const district = new DistrictView({ composition: { id: 'L7' } } as DistrictWorld, materials, {} as DistrictAssets, phase, Grass.material(materials, phase), true);
  const geometry = new BoxGeometry(2, 4, 2), material = new MeshBasicNodeMaterial(), prototype = new Group(); prototype.add(new Mesh(geometry, material));
  const refs = [new Object3D(), new Object3D()]; refs[1].position.x = 270; refs.forEach(ref => ref.updateMatrix());
  const batch = new InstancedGroup(prototype, refs.slice()); district.add(batch);
  const internal = district as unknown as { dressingEntries: unknown[] };
  internal.dressingEntries.push({ batch, refs, origin: [0, 0], center: new Object3D().position, radius: 3 });
  const view = new View(); view.resize(1280, 720);
  try {
    view.preset('plaza', { position: [15, 20, 15], target: [0, 0, 0] }); district.updateLods(view);
    expect(batch.references).toEqual([refs[0]]); expect((batch.children[0] as InstancedMesh).count).toBe(1);
    view.preset('northgate', { position: [285, 20, 15], target: [270, 0, 0] }); district.updateLods(view);
    expect(batch.references).toEqual([refs[1]]); expect(refs[1].position.x).toBe(270);
    view.preset('plaza-return', { position: [15, 20, 15], target: [0, 0, 0] }); district.updateLods(view);
    expect(batch.references).toEqual([refs[0]]); expect(refs).toHaveLength(2);
  } finally { batch.dispose(); district.dispose(); geometry.dispose(); material.dispose(); materials.dispose(); lighting.dispose(); }
});

test('T-E29-19-foot-probe @E29-AC19 partial foot probes match full rig probes during a blended pose', async () => {
  const { CrowdFigureProbe } = await import('../../../src/render/characters/CrowdFigureProbe');
  const { CrowdPosePalette } = await import('../../../src/render/characters/CrowdPosePalette');
  const { bakeInfected } = await import('../../../src/render/characters/bakeInfected');
  const { createCivilianPlaceholder } = await import('../../../src/render/npc/placeholders');
  const { disposeCharacter } = await import('../../../src/render/characters/rig');
  const { Matrix4 } = await import('three');
  vi.stubGlobal('location', { search: '?test=1' });
  const model = createCivilianPlaceholder(), baked = bakeInfected(model), palette = new CrowdPosePalette(baked.clip, 2);
  const probe = new CrowdFigureProbe(); probe.sole = .4;
  const matrix = new Matrix4().makeRotationY(.37).setPosition(2, .1, -3);
  try {
    const [outgoing] = palette.sample(1, 'idle', 3.25, 0);
    const sample = () => { probe.begin(); probe.add(1, 'idle', .2, matrix, palette, 7.4, outgoing, .45); probe.draw(); return structuredClone(probe.figures[0]); };
    CrowdFigureProbe.joints = true; const full = sample(); CrowdFigureProbe.joints = false; const partial = sample();
    expect(full.joints).toBeDefined(); expect(partial.joints).toBeUndefined(); expect(partial.drawn).toBe(true);
    for (const key of ['feet', 'soles'] as const) for (const [i, point] of full[key]!.entries()) for (const [axis, value] of point.entries()) expect(partial[key]![i][axis]).toBeCloseTo(value, 6);
    expect(partial.scale).toEqual(full.scale);
  } finally { CrowdFigureProbe.joints = false; vi.unstubAllGlobals(); palette.texture.dispose(); baked.geometry.dispose(); disposeCharacter(model); }
});
