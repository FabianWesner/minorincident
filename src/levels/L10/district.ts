import authored from '../../../layouts/D-CURE/routes.json' with { type: 'json' };
import type { Point } from '../districts/types';

/** D1–D3 own R1–R6. D4 appends to the same authored route/cell contract. */
export const cure = authored as unknown as {
  chunkSize: number; bounds: Point[]; start: Point;
  regions: { id: string; envelope: [Point, Point]; checkpoint: string; weapon?: string; minutes: number; route: Point[] }[];
  anchors: Record<string, Point>;
  threatDepth: { region: string; routeStart: number; routeEnd: number; resident: { high: [number, number]; low: [number, number] }; dogs?: [number, number]; alphas: [number, number]; alphasLow?: [number, number]; groupSize?: [number, number] }[];
  detours: { id: string; region: string; route: Point[] }[];
};
/** Global coarse pursuit follows the same reachable turn anchors as the detailed route. */
const pursuitPoints = cure.regions.flatMap((r, i) => i ? r.route.slice(1) : r.route);
const pursuitNodeId = ([x, z]: Point) => `cure-route-${pursuitPoints.findIndex(p => p[0] === x && p[1] === z)}`;
// Open ground beside the winding road: enter through the existing northern
// rubble breach, cross the clear eastern verge, then take the straight R7 apron.
// These links retain the road graph (including saved node IDs) and its obstacles.
const pursuitShortcuts: [Point, Point][] = [
  [cure.regions[5].route[1], cure.anchors['corridor-breach']],
  [cure.anchors['corridor-breach'], cure.anchors['r6-r7-seam']],
  [cure.anchors['r6-r7-seam'], cure.regions[6].route[5]],
];
export const curePursuitRoute = {
  // The final delivery approach follows reachable links beyond the camera,
  // with the same 0.7× cruise as detailed movement.
  pressure: { from: pursuitNodeId(cure.regions[5].route[0]), trailM: 120 },
  nodes: pursuitPoints.map(([x, z], i) => ({ id: `cure-route-${i}`, x, z })),
  links: [
    ...pursuitPoints.slice(1).map((_, i) => [`cure-route-${i}`, `cure-route-${i + 1}`] as [string, string]),
    ...pursuitShortcuts.map(([a, b]) => [pursuitNodeId(a), pursuitNodeId(b)] as [string, string]),
  ],
};

