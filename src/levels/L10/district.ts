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
export const cureRouteLength = (points: readonly Point[]): number => points.slice(1).reduce((sum, b, i) => sum + Math.hypot(b[0] - points[i][0], b[1] - points[i][1]), 0);
/** Global coarse pursuit follows the same reachable turn anchors as the detailed route. */
export const curePursuitRoute = {
  nodes: cure.regions.flatMap((r, i) => i ? r.route.slice(1) : r.route).map(([x, z], i) => ({ id: `cure-route-${i}`, x, z })),
  links: cure.regions.flatMap((r, i) => i ? r.route.slice(1) : r.route).slice(1).map((_, i) => [`cure-route-${i}`, `cure-route-${i + 1}`] as [string, string]),
};

/** Encounter lanes consume route depth, independently of inventory. Counts include mixed threats. */
export const cureThreatAtDepth = (metres: number) => cure.threatDepth.find(row => metres < row.routeEnd) ?? cure.threatDepth.at(-1)!;
