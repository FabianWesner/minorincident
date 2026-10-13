import type { DistrictLayout, Point } from '../../levels/districts/types';
import type { QualityTier } from '../../core/Quality';

/** Global anchors stay stable while each region's geometry uses a cell-local origin.
 * This pure selection contract is also usable by collider/nav ownership in S4/E32. */
export interface TerrainChunk { id: string; origin: Point; max: Point }
export const terrainChunkBudgets = { high: 25, low: 9 } as const;
export const terrainPrefetchSeconds = 2;
export function localTerrainPoint(chunk: TerrainChunk, global: Point): Point {
  return [global[0] - chunk.origin[0], global[1] - chunk.origin[1]];
}
/** A square neighbourhood shifted towards two seconds of maximum-speed travel.
 * With 100 m cells and 18 m/s, both the current and predicted cell remain covered. */
export function selectTerrainChunks(chunks: readonly TerrainChunk[], size: number, focus: Point, velocity: Point, tier: QualityTier, maxSpeed = 18): TerrainChunk[] {
  if (!chunks.length) return [];
  const minX = Math.min(...chunks.map(c => c.origin[0])), minZ = Math.min(...chunks.map(c => c.origin[1]));
  const length = Math.hypot(...velocity), lead = length > .1 ? maxSpeed * terrainPrefetchSeconds / length : 0;
  const radius = tier === 'high' ? 2 : 1;
  const x = Math.floor((focus[0] + velocity[0] * lead - minX) / size), z = Math.floor((focus[1] + velocity[1] * lead - minZ) / size);
  return chunks.filter(c => Math.abs(Math.round((c.origin[0] - minX) / size) - x) <= radius && Math.abs(Math.round((c.origin[1] - minZ) / size) - z) <= radius)
    .sort((a, b) => Math.hypot(a.origin[0] + size / 2 - focus[0], a.origin[1] + size / 2 - focus[1]) - Math.hypot(b.origin[0] + size / 2 - focus[0], b.origin[1] + size / 2 - focus[1]));
}

/** Consume the Blender ownership table for both Crossing and Cure, with the composition origin applied once. */
export function layoutTerrainChunks(layout: DistrictLayout, origin: Point = [0, 0]): TerrainChunk[] {
  return (layout.terrainChunks ?? []).map(c => ({ id: c.id, origin: [c.origin[0] + origin[0], c.origin[1] + origin[1]], max: [c.origin[0] + origin[0] + c.size, c.origin[1] + origin[1] + c.size] }));
}
