import type { DistrictLayout } from './districts/types';
import { overlapsBuilding, overlapsPaving, overlapsRoad } from './districts/validate';

/** Stable grid shared by lawn rendering and simulation. */
export function lawnGrid(lawn: DistrictLayout['lawns'][number]) {
  const width = lawn.max[0] - lawn.min[0], depth = lawn.max[1] - lawn.min[1];
  const nx = Math.max(1, Math.ceil(width / 4)), nz = Math.max(1, Math.ceil(depth / 4));
  return { nx, nz, width: width / nx, depth: depth / nz };
}
export const lawnCellId = (district: string, lawn: number, x: number, z: number) => `${district}/lawn:${lawn}:${x}:${z}`;

/** A cell's fire footprint stays within the lawn and clear of authored paving. */
export function lawnFireCells(layout: DistrictLayout, origin: readonly [number, number]) {
  const cells: { id: string; x: number; z: number; halfX: number; halfZ: number }[] = [];
  for (const [index, lawn] of layout.lawns.entries()) {
    const grid = lawnGrid(lawn);
    for (let i = 0; i < grid.nx; i++) for (let j = 0; j < grid.nz; j++) {
      const x = lawn.min[0] + (i + .5) * grid.width, z = lawn.min[1] + (j + .5) * grid.depth;
      const halfX = grid.width / 2, halfZ = grid.depth / 2;
      const footprint = { min: [x - halfX, 0, z - halfZ] as [number, number, number], max: [x + halfX, 0, z + halfZ] as [number, number, number] };
      if (!overlapsRoad(layout, footprint) && !overlapsPaving(layout, footprint) && !overlapsBuilding(layout, footprint)) cells.push({ id: lawnCellId(layout.district, index, i, j), x: x + origin[0], z: z + origin[1], halfX, halfZ });
    }
  }
  return cells;
}
