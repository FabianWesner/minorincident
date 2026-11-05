import type { DistrictLayout } from './districts/types';

/** PO #17b: Kessler's refuge is at Harbor Street's far west end, beyond the eastern street escape.
 * Swap two existing frontage shells, including their authored solids. L4 and its L5 twin share the same entrance.
 * The sealed underground room remains on its existing island.
 */
export function moveFairhavenCellar(layout: DistrictLayout): void {
  // The authored layout also holds the sealed east backyards (x 85..135), so its document bounds are a stepped polygon. L4/L5 play on the
  // original rectangle: navigation, the infected ground and the perimeter are exactly what they were; the backyards are scenery beyond its fence.
  layout.bounds = [[-85, -65], [85, -65], [85, 65], [-85, 65], [-85, -65]];
  const hardware = layout.placements.find(p => p.assetId === 'bld.kessler-hardware');
  const corner = layout.placements.find(p => p.id === 'bld.apartment-block-b:217');
  if (!hardware || !corner) return;
  const dx = corner.position[0] - hardware.position[0], dz = corner.position[2] - hardware.position[2];
  // Centre the wider apartment in the 12.8 m gap between the two existing south-front shops.
  for (const [p, x, z] of [[hardware, dx, dz], [corner, -dx - .42, -dz]] as const) {
    p.position[0] += x; p.position[2] += z;
    if (p.visualAabb) for (const v of [p.visualAabb.min, p.visualAabb.max]) { v[0] += x; v[2] += z; }
    for (const c of layout.colliders.filter(c => c.id === p.id)) for (const v of [c.aabb.min, c.aabb.max]) { v[0] += x; v[2] += z; }
  }
  const door = layout.anchors['kessler-cellar-door'];
  door.position[0] += dx; door.position[2] += dz;
  // The moved shells keep their visible street-facing doors as refuge anchors.
  layout.anchors['refuge-door-1'].position = [...door.position];
  layout.anchors['refuge-door-43'].position = [corner.position[0], 0, corner.position[2] + 5.94];
}
