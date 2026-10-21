import { test, expect } from 'vitest';
import { BufferAttribute, BoxGeometry, Group, Mesh, Scene, type Material } from 'three/webgpu';
import { DistrictAssets } from '../../../src/assets/DistrictAssets';
import { staticBatchMaterial } from '../../../src/assets/staticBatch';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';

test('district role sharing keeps cached graphs alive until the cache retires', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), assets = new DistrictAssets(materials);
  const internal = assets as unknown as { share(root: Group): void; batchMaterialCache: Map<string, Material> };
  const first = staticBatchMaterial(materials, false, true, false, false, false);
  const borrowed = staticBatchMaterial(materials, false, true, true, false, false);
  internal.batchMaterialCache.set('borrowed', borrowed);
  let firstDisposals = 0, borrowedDisposals = 0;
  first.addEventListener('dispose', () => firstDisposals++);
  borrowed.addEventListener('dispose', () => borrowedDisposals++);
  const geometry = new BoxGeometry(), root = new Group();
  for (const [name, material] of [['static-body', first], ['roof', borrowed], ['static-body', borrowed]] as const) {
    const mesh = new Mesh(geometry, material); mesh.name = name; root.add(mesh);
  }
  internal.share(root);
  expect((root.children[1] as Mesh).material).toBe(borrowed);
  expect((root.children[2] as Mesh).material).toBe(first);
  expect(borrowedDisposals).toBe(0);
  assets.dispose();
  expect(firstDisposals).toBe(1); expect(borrowedDisposals).toBe(1);
  geometry.dispose(); materials.dispose(); lighting.dispose();
});

test('T-E29-19-memory @E29-AC19 district cache drops unused RGB while preserving palette and figure color graphs', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), assets = new DistrictAssets(materials);
  const remember = (assets as unknown as { remember(root: Group): Group }).remember.bind(assets);
  for (const rendering of [false, true]) for (const world of [true, false]) {
    // remember() needs only the presence of a presentation renderer; offline
    // source/bake registries must preserve their exact original RGB arrays.
    Object.assign(assets, { renderer: rendering ? {} : undefined });
    const geometry = new BoxGeometry(), count = geometry.getAttribute('position').count;
    const color = new BufferAttribute(new Float32Array(count * 3), 3), palette = new BufferAttribute(new Float32Array(count), 1);
    geometry.setAttribute('color', color); geometry.setAttribute('_palette', palette);
    const positions = geometry.getAttribute('position'), index = geometry.index;
    const material = staticBatchMaterial(materials, false, true, false, false, false, world);
    const root = new Group(); root.add(new Mesh(geometry, material)); remember(root);
    expect(geometry.hasAttribute('color')).toBe(!rendering || !world);
    if (!rendering || !world) expect(geometry.getAttribute('color')).toBe(color);
    expect(geometry.getAttribute('_palette')).toBe(palette);
    expect(geometry.getAttribute('position')).toBe(positions); expect(geometry.index).toBe(index);
    material.dispose();
  }
  assets.dispose(); materials.dispose(); lighting.dispose();
});

test('T-E29-19-grouping @E29-AC19 L7 LOD batches share only their model figures and retain every corpse', async () => {
  const { CivilianCrowd } = await import('../../../src/render/npc/CivilianCrowd');
  const actors = [
    { id: 1, civilian: { model: 'npc.civilian-man-a' } },
    { id: 2, civilian: { model: 'npc.civilian-woman-a' } },
    { id: 3, corpse: {}, appearance: { asset: 'npc.civilian-man-a' } },
    { id: 4, kind: 'light' },
  ] as unknown as import('../../../src/sim/world/types').EntitySnapshot[];
  const world = { scenario: 'L7', tick: 1, entities: { iterate: () => actors.values(), get: (id: number) => actors.find(e => e.id === id) }, infected: { director: { tier: 'low' } } } as unknown as import('../../../src/sim/world/SimWorld').SimWorld;
  const crowd = new CivilianCrowd(world); crowd.setQuality('low');
  type Batch = { model: string; update(alpha: number, low: boolean, shotId?: number, figures?: readonly typeof actors[number][]): void };
  const batches = (crowd as unknown as { batches: Batch[] }).batches;
  const seen: { model: string; ids: number[] }[] = [];
  for (const batch of batches) batch.update = (_alpha, low, _shot, figures) => {
    expect(low).toBe(true); expect(figures).toBeDefined();
    seen.push({ model: batch.model, ids: figures!.map(e => e.id) });
  };
  crowd.update();
  expect(seen.filter(s => s.model === 'npc.civilian-man-a').map(s => s.ids)).toEqual([[1, 3], [1, 3]]);
  expect(seen.filter(s => s.model === 'npc.civilian-woman-a').map(s => s.ids)).toEqual([[2], [2]]);
  actors.splice(1, 1); seen.length = 0; world.tick++;
  crowd.update();
  expect(seen.filter(s => s.model === 'npc.civilian-woman-a').map(s => s.ids)).toEqual([[], []]);
  expect(seen.filter(s => s.model === 'npc.civilian-man-a').map(s => s.ids)).toEqual([[1, 3], [1, 3]]);
  crowd.dispose();
});
