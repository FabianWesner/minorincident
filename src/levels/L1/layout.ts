import type { DistrictLayout, Placement } from '../districts/types';

/**
 * fix65-a (L1-16): the depot side lawn between the courier van's tail (x -46.1) and the depot kiosk (x -40.4) opened Main Row's
 * shop frontage onto the rear service strip. Screenshot players walking toward the depot slid into it and looped between the
 * blue bins and the back fence. A clipped hedge row flush with the shop and kiosk fronts (z -38.5) closes that mouth, so the
 * frontage reads as one continuous wall that leads along the pavement to the counter. The service strip stays reachable from
 * the Juniper end of the north alley. L1 only: L2 builds its own W1 twin of D-GROVE.
 */
export const l1DepotHedge = { x0: -46.1, x1: -40.4, front: -38.5, pieces: 3 } as const;
/**
 * The three Main Row brick shops stand 0.8 m apart visually, but their baked collision leaves 1.53 m slits (x -72.44..-70.91 and
 * -61.94..-60.41) that a courier pressing toward the depot squeezes through into the same rear strip. The terrace reads as one
 * frontage, so its collision is one too. The last seal closes the 0.5 m sliver between the hedge and the kiosk's west wall.
 */
export const l1FrontageSeals: readonly { id: string; x0: number; x1: number; z0: number; z1: number }[] = [
  { id: 'l1-shop-slit-west', x0: -72.5, x1: -70.85, z0: -45.2, z1: -38.4 },
  { id: 'l1-shop-slit-east', x0: -62.0, x1: -60.35, z0: -45.2, z1: -38.4 },
  { id: 'l1-depot-hedge-seal', x0: -40.45, x1: -39.8, z0: -39.45, z1: -38.5 },
];

export function levelOneLayouts(layouts: DistrictLayout[]): DistrictLayout[] {
  return layouts.map(source => {
    if (source.district !== 'D-GROVE') return source;
    const layout = structuredClone(source), { x0, x1, front, pieces } = l1DepotHedge;
    // prop.hedge: 2.3 m long (local x), 0.88 m deep, 1.56 m tall.
    const step = (x1 - x0) / pieces, sx = step / 2.3, z = front - .44 - .02;
    for (let i = 0; i < pieces; i++) {
      const x = x0 + (i + .5) * step;
      const hedge: Placement = { id: `l1-depot-hedge-${i}`, assetId: 'prop.hedge', position: [x, 0, z], yaw: 0, scale: [sx, 1, 1], minTier: 0, maxTier: 5,
        allowRoad: false, lightGroup: 'block-0', visualAabb: { min: [x - step / 2, 0, z - .44], max: [x + step / 2, 1.56, z + .44] } };
      layout.placements.push(hedge);
    }
    for (const seal of l1FrontageSeals) layout.colliders.push({ id: seal.id, minTier: 0, maxTier: 5, aabb: { min: [seal.x0, 0, seal.z0], max: [seal.x1, 2.4, seal.z1], navBlocker: true } });
    return layout;
  });
}
