import type { SimWorld } from '../../sim/world/SimWorld';
import type { DistrictLayout, Placement, Point } from '../districts/types';

type CropIndex = Map<string, Placement[]>;
const indexes = new WeakMap<DistrictLayout, CropIndex>();
function cropIndex(layout: DistrictLayout): CropIndex {
  let index = indexes.get(layout);
  if (index) return index;
  index = new Map();
  for (const p of layout.placements) if (p.assetId === 'veg.corn-block') {
    const { min, max } = p.visualAabb;
    for (let x = Math.floor(min[0] / 32); x <= Math.floor(max[0] / 32); x++)
      for (let z = Math.floor(min[2] / 32); z <= Math.floor(max[2] / 32); z++) {
        const key = `${x}:${z}`, rows = index.get(key);
        if (rows) rows.push(p); else index.set(key, [p]);
      }
  }
  indexes.set(layout, index); return index;
}
export function inCorn(world: Pick<SimWorld, 'districts'>, point: Point): boolean {
  if (point[0] < 500 || point[0] > 1240) return false;
  const d = world.districts?.districts.find(d => d.id === 'D-CURE');
  if (!d) return false;
  const x = point[0] - d.origin[0], z = point[1] - d.origin[1];
  return (cropIndex(d.layout).get(`${Math.floor(x / 32)}:${Math.floor(z / 32)}`) ?? []).some(p => x >= p.visualAabb.min[0] && x <= p.visualAabb.max[0] && z >= p.visualAabb.min[2] && z <= p.visualAabb.max[2]);
}
/** Sight also breaks when both endpoints are outside but the ray crosses a standing-crop block. Hearing never uses this. */
export function cornBlocksSight(world: Pick<SimWorld, 'districts'>, from: Point, to: Point): boolean {
  if (Math.min(from[0], to[0]) > 1240 || Math.max(from[0], to[0]) < 500) return false;
  const dx = to[0] - from[0], dz = to[1] - from[1], distance = Math.hypot(dx, dz);
  if (distance <= 3) return false;
  const steps = Math.ceil(distance); // one metre < narrowest crop block; ordinary vision is only 14–16 m
  for (let i = 0; i <= steps; i++) if (inCorn(world, [from[0] + dx * i / steps, from[1] + dz * i / steps])) return true;
  return false;
}
export function cornSightRange(world: Pick<SimWorld, 'districts'>, observer: Point, target: Point): number {
  return inCorn(world, observer) || inCorn(world, target) ? 3 : 14;
}
