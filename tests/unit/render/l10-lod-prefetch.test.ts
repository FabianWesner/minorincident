import { expect, test, vi } from 'vitest';
import { Object3D, Sphere } from 'three/webgpu';
import { DistrictView } from '../../../src/render/DistrictView';
import type { View } from '../../../src/render/View';

/** Off-screen placements must request their next tier before a runner reaches its draw band. */
for (const low of [false, true]) test(`T-E32-28-lods-${low ? 'low' : 'high'} @E32-AC28 two-second walking horizon loads off-screen near tiers without drawing them`, () => {
  const asset = vi.fn(() => new Promise<Object3D>(() => {}));
  const district = Object.assign(Object.create(DistrictView.prototype) as DistrictView, {
    low, registry: { asset }, pending: new Map(), dirtyEntries: new Set(),
    bounds: new Sphere(), frustum: { intersectsSphere: () => false },
    materials: { look: { values: { foliageDensity: 1 } } }, lodPrefetchMetres: 9,
  });
  const ref = new Object3D(); ref.position.x = low ? 22 : 30;
  const batch = () => ({ references: [], children: [], visible: false });
  const entry = { id: 'bld.cure-security-post', refs: [ref], origin: [0, 0], height: 2, radius: 5, bands: [], hero: batch(), near: batch(), far: batch(), nearLoaded: false, loaded: false, lit: false };
  const view = { cameraTarget: { x: 0, z: 0 }, inspectionPose: null } as unknown as View;
  const partition = district as unknown as { partition(entry: unknown, view: View): void };
  partition.partition(entry, view);
  expect(asset).toHaveBeenCalledWith('bld.cure-security-post', false, 'lod1', undefined);
  expect(entry.near.references).toEqual([]); expect(entry.hero.references).toEqual([]);
  asset.mockClear(); Object.assign(district, { pending: new Map(), lodPrefetchMetres: 0 });
  partition.partition(entry, view); expect(asset).not.toHaveBeenCalled();
  // Far regions and low-tier dressing are not promoted by this bounded prefetch.
  ref.position.x = 500; Object.assign(district, { lodPrefetchMetres: 9 });
  partition.partition(entry, view); expect(asset).not.toHaveBeenCalled();
  if (low) {
    ref.position.x = 18; entry.id = 'prop.bench';
    partition.partition(entry, view); expect(asset).not.toHaveBeenCalled();
  }
});
