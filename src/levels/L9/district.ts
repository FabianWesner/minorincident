import authored from '../../../layouts/D-CROSSING/routes.json' with { type: 'json' };
import type { Point } from '../districts/types';

/** Greybox route contract shared with Blender and the upcoming streaming/encounter lanes.
 * Risk anchors are encounter opportunities, not mandatory impacts; detours remain open.
 * All intended ground is flat (0 degrees), including off-road connections and chunk seams. */
export const crossing = authored as {
  extent: Point; chunkSize: number; start: Point; outskirts: Point;
  routes: { id: string; surface: 'asphalt' | 'gravel'; width: number; points: Point[]; risks: Point[]; detour: Point[] }[];
  viewpoints: { id: string; from: Point; to: Point }[];
};
export const crossingRouteLength = (points: readonly Point[]): number =>
  points.slice(1).reduce((sum, b, i) => sum + Math.hypot(b[0] - points[i][0], b[1] - points[i][1]), 0);
