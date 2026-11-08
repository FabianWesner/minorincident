import authored from '../../../layouts/D-CURE/routes.json' with { type: 'json' };
import type { Point } from '../districts/types';
import { cureEscapeGaps } from '../../data/l10Story';

/** D1–D3 own R1–R6. D4 appends to the same authored route/cell contract. */
export const cure = authored as unknown as {
  chunkSize: number; bounds: Point[]; start: Point;
  regions: { id: string; envelope: [Point, Point]; checkpoint: string; minutes: number; route: Point[] }[];
  anchors: Record<string, Point>;
  threatDepth: { region: string; routeStart: number; routeEnd: number; resident: { high: [number, number]; low: [number, number] }; dogs?: [number, number]; alphas: [number, number]; alphasLow?: [number, number]; groupSize?: [number, number] }[];
  detours: { id: string; region: string; route: Point[] }[];
};
/** Global coarse pursuit follows the same reachable turn anchors as the detailed route. */
const walkedPoints = cure.regions.flatMap((r, i) => i ? r.route.slice(1) : r.route);
const pursuitPoints: Point[] = [];
for (let i = 0; i < walkedPoints.length; i++) {
  const p = walkedPoints[i], previous = walkedPoints[i - 1];
  const gap = previous && cureEscapeGaps.find(g => previous[1] === g.z && p[1] === g.z && previous[0] < g.x && p[0] >= g.x);
  if (gap) pursuitPoints.push([gap.x - 5, gap.z], [gap.x - 5, gap.detourZ], [gap.x + 5, gap.detourZ], [gap.x + 5, gap.z]);
  if (!gap || p[0] !== gap.x) pursuitPoints.push(p);
}
const pursuitNodeId = ([x, z]: Point) => `cure-route-${pursuitPoints.findIndex(p => p[0] === x && p[1] === z)}`;
// Open ground beside the winding road: enter through the existing northern
// rubble breach, cross the clear eastern verge, then take the straight R7 apron.
// These links retain the road graph (including saved node IDs) and its obstacles.
const pursuitShortcuts: [Point, Point][] = [
  [cure.regions[5].route[1], [cureEscapeGaps[2].x - 5, cureEscapeGaps[2].z]],
  [[cureEscapeGaps[2].x + 5, cureEscapeGaps[2].z], cure.anchors['r6-r7-seam']],
  [cure.anchors['r6-r7-seam'], cure.regions[6].route[5]],
];
export const curePursuitRoute = {
  // The final delivery approach closes the distant pursuit gap along these
  // reachable links; nearby pursuit uses the fast-stalker cruise speed.
  pressure: { from: pursuitNodeId(cure.regions[5].route[0]), trailM: 120 },
  nodes: pursuitPoints.map(([x, z], i) => ({ id: `cure-route-${i}`, x, z })),
  links: [
    ...pursuitPoints.slice(1).map((_, i) => [`cure-route-${i}`, `cure-route-${i + 1}`] as [string, string]),
    ...pursuitShortcuts.map(([a, b]) => [pursuitNodeId(a), pursuitNodeId(b)] as [string, string]),
  ],
};

