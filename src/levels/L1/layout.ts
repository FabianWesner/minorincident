import type { DistrictLayout, Placement } from '../districts/types';

/**
 * fix65-a (L1-16): the depot side lawn between shop 3 (x -50.8) and the depot kiosk (x -40.4) opened Main Row's frontage onto
 * the rear service strip, and the courier van parked lengthwise across that mouth stood 2.7 m proud of the frontage. Screenshot
 * players walking toward the depot slid into the lawn and looped between the blue bins and the back fence, or pinned
 * themselves against the van's tail. The van now stands in the passage it was authored for (nose into the yard, tail flush
 * with the frontage) and clipped hedge rows close the lawn on both sides of it, so the frontage reads as one continuous wall
 * that leads along the pavement to the counter. The service strip stays reachable from the Juniper end of the north alley.
 * L1 only: L2 builds its own W1 twin of D-GROVE.
 */
export const l1DepotFront = -38.5;
/** prop.hedge runs (x0, x1, pieces) either side of the parked van; prop.hedge is 2.3 m long (local x), 0.88 m deep, 1.56 m tall. */
export const l1DepotHedges: readonly [number, number, number][] = [[-50.8, -47.45, 2], [-44.55, -40.4, 2]];
/** veh.courier-van turned into the passage: collision 5.45 x 2.71 m, so its tail sits 5 cm behind the frontage. */
export const l1DepotVan = { x: -46.0, z: l1DepotFront - 2.7225 - .05, yaw: -Math.PI / 2 } as const;
/**
 * The three Main Row brick shops stand 0.8 m apart visually, but their baked collision leaves 1.53 m slits (x -72.44..-70.91 and
 * -61.94..-60.41) that a courier pressing toward the depot squeezes through into the same rear strip. The terrace reads as one
 * frontage, so its collision is one too. The last two seals close the slivers between the hedge rows and the kiosk / shop 3 walls.
 */
export const l1FrontageSeals: readonly { id: string; x0: number; x1: number; z0: number; z1: number }[] = [
  { id: 'l1-shop-slit-west', x0: -72.5, x1: -70.85, z0: -45.2, z1: -38.4 },
  { id: 'l1-shop-slit-east', x0: -62.0, x1: -60.35, z0: -45.2, z1: -38.4 },
  { id: 'l1-depot-hedge-seal', x0: -40.45, x1: -39.8, z0: -39.45, z1: -38.5 },
  { id: 'l1-depot-hedge-seal-west', x0: -51.5, x1: -50.75, z0: -39.45, z1: -38.4 },
];

export function levelOneLayouts(layouts: DistrictLayout[]): DistrictLayout[] {
  return layouts.map(source => {
    if (source.district !== 'D-GROVE') return source;
    const layout = structuredClone(source), z = l1DepotFront - .44 - .02;
    // The garage-approach sign post blocked the first nav corner for an
    // infected at (17.103, 34.093). Keep it on the kerb, clear of that approach.
    const sign = layout.placements.find(p => p.assetId === 'prop.street-sign' && p.position[0] === 17.5 && p.position[2] === 33.5);
    if (sign) {
      sign.position[0] -= .1;
      sign.visualAabb.min[0] -= .1; sign.visualAabb.max[0] -= .1;
    }
    for (const [run, [x0, x1, pieces]] of l1DepotHedges.entries()) {
      const step = (x1 - x0) / pieces;
      for (let i = 0; i < pieces; i++) {
        const x = x0 + (i + .5) * step;
        const hedge: Placement = { id: `l1-depot-hedge-${run}-${i}`, assetId: 'prop.hedge', position: [x, 0, z], yaw: 0, scale: [step / 2.3, 1, 1], minTier: 0, maxTier: 5,
          allowRoad: false, lightGroup: 'block-0', visualAabb: { min: [x - step / 2, 0, z - .44], max: [x + step / 2, 1.56, z + .44] } };
        layout.placements.push(hedge);
      }
    }
    const van = layout.placements.find(p => p.assetId === 'veh.courier-van');
    if (van) {
      const { x, z: vz, yaw } = l1DepotVan, h = van.visualAabb.max[1];
      van.position = [x, 0, vz]; van.yaw = yaw; van.visualAabb = { min: [x - 1.355, 0, vz - 2.7225], max: [x + 1.355, h, vz + 2.7225] };
    }
    for (const seal of l1FrontageSeals) layout.colliders.push({ id: seal.id, minTier: 0, maxTier: 5, aabb: { min: [seal.x0, 0, seal.z0], max: [seal.x1, 2.4, seal.z1], navBlocker: true } });
    return layout;
  });
}
