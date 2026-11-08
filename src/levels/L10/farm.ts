import type { SimWorld } from '../../sim/world/SimWorld';
import type { DistrictLayout, Point } from '../districts/types';

/** L10's standing-crop footprints are authored as lawn strips in D-CURE's layout bake. */
type CropIndex = Map<string, DistrictLayout['lawns'][number][]>;
const indexes = new WeakMap<DistrictLayout, CropIndex>();
function cropIndex(layout: DistrictLayout): CropIndex {
  let index = indexes.get(layout);
  if (index) return index;
  index = new Map();
  for (const lawn of layout.lawns) {
    for (let x = Math.floor(lawn.min[0] / 32); x <= Math.floor(lawn.max[0] / 32); x++)
      for (let z = Math.floor(lawn.min[1] / 32); z <= Math.floor(lawn.max[1] / 32); z++) {
        const key = `${x}:${z}`, rows = index.get(key);
        if (rows) rows.push(lawn); else index.set(key, [lawn]);
      }
  }
  indexes.set(layout, index);
  return index;
}

export function inCorn(world: Pick<SimWorld, 'districts'>, point: Point): boolean {
  const district = world.districts?.districts.find(d => d.id === 'D-CURE');
  if (!district) return false;
  const x = point[0] - district.origin[0], z = point[1] - district.origin[1];
  return (cropIndex(district.layout).get(`${Math.floor(x / 32)}:${Math.floor(z / 32)}`) ?? [])
    .some(lawn => x >= lawn.min[0] && x <= lawn.max[0] && z >= lawn.min[1] && z <= lawn.max[1]);
}

/** Tall dry crop breaks infected sight; sound and the corgi warning remain unaffected. */
export function cornSightRange(world: Pick<SimWorld, 'districts'>, observer: Point, target: Point): number {
  return inCorn(world, observer) || inCorn(world, target) ? 3 : 14;
}
